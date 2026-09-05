import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { parseCsv } from '../../../lib/csv';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  PageHeader,
  TableShell,
  Td,
  Th,
  Tr,
} from '../../../components/crm/ui';
import { formatMoney as formatPkr } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import type { Client, Project, ProjectStatus } from '../../../types/database';

interface ParsedRow {
  rowNumber: number;
  projectName: string;
  clientName: string;
  startDateRaw: string;
  startDateIso: string | null;
  statusRaw: string;
  status: ProjectStatus;
  totalValue: number;
  amountPaid: number;
  notes: string;
  isNewClient: boolean;
  issues: string[];
}

const parseDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const parseMoney = (raw: string): number => {
  const cleaned = raw.replace(/["$,]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const mapStatus = (raw: string): ProjectStatus => {
  const s = raw.trim().toLowerCase();
  if (s.includes('progress')) return 'active';
  if (s.includes('complet') || s === 'done') return 'completed';
  if (s.includes('hold')) return 'on_hold';
  if (s.includes('cancel')) return 'cancelled';
  return 'proposal';
};

const formatMoney = (n: number) => formatPkr(n);


const ImportCsv = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [existingClients, setExistingClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ clients: number; projects: number } | null>(null);

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => {
      setExistingClients((data ?? []) as Client[]);
      setClientsLoaded(true);
    });
  }, []);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const table = parseCsv(text).filter(r => r.some(c => c.trim() !== ''));
        const headerIndex = table.findIndex(r => r.some(c => c.trim().toLowerCase() === 'project name'));
        if (headerIndex === -1) {
          setParseError('Could not find a "Project Name" column in this file. Expected a header row with columns like Project Name, Client, Start Date, Status, Contract (PKR), Paid (PKR).');
          setRows([]);
          return;
        }

        const header = table[headerIndex].map(h => h.trim().toLowerCase());
        const findCol = (pred: (h: string) => boolean) => header.findIndex(pred);
        const nameIdx = findCol(h => h.includes('project name'));
        const clientIdx = findCol(h => h === 'client' || h.includes('client'));
        const dateIdx = findCol(h => h.includes('start date') || h === 'date');
        const statusIdx = findCol(h => h === 'status');
        const contractIdx = findCol(h => h.includes('contract'));
        const paidIdx = findCol(h => h.includes('paid'));
        const notesIdx = findCol(h => h === 'notes');

        const existingNames = new Set(existingClients.map(c => c.name.trim().toLowerCase()));
        const seenInBatch = new Set<string>();

        const parsed: ParsedRow[] = [];
        table.slice(headerIndex + 1).forEach((r, i) => {
          const projectName = (r[nameIdx] ?? '').trim();
          if (!projectName || projectName.toLowerCase() === 'totals') return;

          const clientName = clientIdx >= 0 ? (r[clientIdx] ?? '').trim() : '';
          const startDateRaw = dateIdx >= 0 ? (r[dateIdx] ?? '').trim() : '';
          const statusRaw = statusIdx >= 0 ? (r[statusIdx] ?? '').trim() : '';
          const contractRaw = contractIdx >= 0 ? (r[contractIdx] ?? '') : '';
          const paidRaw = paidIdx >= 0 ? (r[paidIdx] ?? '') : '';
          const notes = notesIdx >= 0 ? (r[notesIdx] ?? '').trim() : '';

          const issues: string[] = [];
          if (!clientName) issues.push('Missing client name');

          const startDateIso = parseDate(startDateRaw);
          if (startDateRaw && !startDateIso) issues.push(`Unrecognized date "${startDateRaw}"`);

          const totalValue = parseMoney(contractRaw);
          let amountPaid = parseMoney(paidRaw);
          if (amountPaid > totalValue) {
            issues.push(`Paid (${formatMoney(amountPaid)}) exceeds contract (${formatMoney(totalValue)}) — capped`);
            amountPaid = totalValue;
          }

          const key = clientName.toLowerCase();
          const isNewClient = !!clientName && !existingNames.has(key) && !seenInBatch.has(key);
          if (clientName) seenInBatch.add(key);

          parsed.push({
            rowNumber: headerIndex + 2 + i,
            projectName, clientName, startDateRaw, startDateIso,
            statusRaw, status: mapStatus(statusRaw),
            totalValue, amountPaid, notes, isNewClient, issues,
          });
        });

        setRows(parsed);
      } catch {
        setParseError('Failed to parse this file — is it a valid CSV export?');
        setRows([]);
      }
    };
    reader.readAsText(file);
  };

  const importableRows = rows.filter(r => r.clientName);
  const blockedRows = rows.filter(r => !r.clientName);
  const newClientNames = Array.from(new Set(importableRows.filter(r => r.isNewClient).map(r => r.clientName)));

  const handleImport = async () => {
    if (importableRows.length === 0) return;
    setImporting(true);
    setImportError(null);

    try {
      const clientIdByName = new Map<string, string>();
      existingClients.forEach(c => clientIdByName.set(c.name.trim().toLowerCase(), c.id));

      if (newClientNames.length > 0) {
        const { data: createdClients, error: clientsError } = await supabase
          .from('clients')
          .insert(newClientNames.map(name => ({ name, company: null, email: null, phone: null, notes: null })))
          .select();
        if (clientsError) throw new Error(clientsError.message);
        (createdClients as Client[]).forEach(c => clientIdByName.set(c.name.trim().toLowerCase(), c.id));
      }

      const projectPayloads = importableRows.map(r => ({
        client_id: clientIdByName.get(r.clientName.toLowerCase())!,
        name: r.projectName,
        description: null,
        status: r.status,
        total_value: r.totalValue,
        amount_paid: r.amountPaid,
        currency: 'PKR',
        start_date: r.startDateIso,
        end_date: null,
      }));

      const { data: createdProjects, error: projectsError } = await supabase
        .from('projects')
        .insert(projectPayloads)
        .select();
      if (projectsError) throw new Error(projectsError.message);

      const created = createdProjects as Project[];
      const notesToInsert = importableRows
        .map((r, i) => ({ row: r, project: created[i] }))
        .filter(x => x.row.notes && x.project)
        .map(x => ({
          project_id: x.project.id,
          type: 'note' as const,
          content: `Imported from CSV: ${x.row.notes}`,
          created_by: null,
        }));
      if (notesToInsert.length > 0) {
        await supabase.from('activities').insert(notesToInsert);
      }

      setResult({ clients: newClientNames.length, projects: created.length });
      setRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-[980px]">
      <PageHeader
        title="Import projects"
        back={{ to: '/crm/projects', label: 'Back to projects' }}
        subtitle="A CSV with Project Name, Client, Start Date, Status, Contract and Paid. Clients that don\u2019t exist yet are created for you."
        actions={
          result ? (
            <ButtonLink to="/crm/projects" variant="primary">
              View projects
            </ButtonLink>
          ) : undefined
        }
      />

      {result && (
        <div className="mb-4 rounded-crm-md border border-crm-success/30 bg-crm-success-quiet px-3.5 py-3">
          <p className="m-0 text-[13px] font-medium text-crm-success">
            Imported {result.projects} {result.projects === 1 ? 'project' : 'projects'}
            {result.clients > 0
              ? `, and created ${result.clients} new ${result.clients === 1 ? 'client' : 'clients'}`
              : ''}
            .
          </p>
        </div>
      )}

      {parseError && (
        <div className="mb-4">
          <ErrorState title="That file couldn\u2019t be read" body={parseError} />
        </div>
      )}
      {importError && (
        <div className="mb-4">
          <ErrorState title="The import stopped" body={importError} />
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
          <Button
            variant="secondary"
            disabled={!clientsLoaded}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose CSV file
          </Button>
          <span className={cn('text-[13px]', fileName ? 'text-crm-ink-2' : 'text-crm-faint')}>
            {fileName || 'No file selected'}
          </span>
        </div>
      </Card>

      {rows.length > 0 && (
        <>
          {/* Nothing is written until this button is pressed \u2014 everything
              above is a preview of what would happen. */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13px] text-crm-ink-2">
              <span className="crm-num font-medium text-crm-ink">{importableRows.length}</span>{' '}
              {importableRows.length === 1 ? 'row' : 'rows'} ready
              {newClientNames.length > 0 && (
                <>
                  {' \u00b7 '}
                  <span className="text-crm-info">
                    {newClientNames.length} new{' '}
                    {newClientNames.length === 1 ? 'client' : 'clients'}
                  </span>
                </>
              )}
              {blockedRows.length > 0 && (
                <>
                  {' \u00b7 '}
                  <span className="text-crm-warning">
                    {blockedRows.length} skipped, no client name
                  </span>
                </>
              )}
            </p>
            <Button
              variant="primary"
              loading={importing}
              disabled={importableRows.length === 0}
              onClick={handleImport}
            >
              Import {importableRows.length}{' '}
              {importableRows.length === 1 ? 'project' : 'projects'}
            </Button>
          </div>

          <TableShell>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Client</Th>
                <Th>Start</Th>
                <Th>Status</Th>
                <Th align="right">Contract</Th>
                <Th align="right">Paid</Th>
                <Th>Issues</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <Tr key={r.rowNumber} className={cn(!r.clientName && 'opacity-50')}>
                  <Td className="text-crm-ink">{r.projectName}</Td>
                  <Td>
                    {r.clientName ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-crm-ink-2">{r.clientName}</span>
                        {r.isNewClient && <Badge tone="info">new</Badge>}
                      </span>
                    ) : (
                      <span className="text-crm-danger">missing</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap font-crm-mono text-[12px] text-crm-ink-3">
                    {r.startDateIso ?? '\u2014'}
                  </Td>
                  <Td className="whitespace-nowrap capitalize text-crm-ink-3">
                    {r.status.replace('_', ' ')}
                  </Td>
                  <Td align="right" className="whitespace-nowrap font-crm-mono text-[12px]">
                    {formatMoney(r.totalValue)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap font-crm-mono text-[12px]">
                    {formatMoney(r.amountPaid)}
                  </Td>
                  <Td className="text-[12px] text-crm-warning">
                    {r.issues.length > 0 ? r.issues.join('; ') : ''}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </>
      )}
    </div>
  );
};

export default ImportCsv;
