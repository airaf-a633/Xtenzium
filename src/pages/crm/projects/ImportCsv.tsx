import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { parseCsv } from '../../../lib/csv';
import Banner from '../../../components/crm/Banner';
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

const formatMoney = (n: number) => `PKR ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const cardStyle: React.CSSProperties = { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 };

const ImportCsv = () => {
  const navigate = useNavigate();
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
    <div style={{ maxWidth: 960 }}>
      <Link to="/crm/projects" style={{ color: '#555', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Back to projects
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Import Projects from CSV</h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
          Upload a CSV with columns like Project Name, Client, Start Date, Status, Contract (PKR), Paid (PKR). Clients that don't exist yet will be created automatically.
        </p>
      </div>

      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Banner type="success" message={`Imported ${result.projects} project${result.projects === 1 ? '' : 's'}${result.clients > 0 ? ` and created ${result.clients} new client${result.clients === 1 ? '' : 's'}` : ''}.`} />
          </div>
          <button
            onClick={() => navigate('/crm/projects')}
            style={{ padding: '10px 18px', background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}
          >
            View projects →
          </button>
        </div>
      )}
      {parseError && <Banner type="error" message={parseError} />}
      {importError && <Banner type="error" message={importError} />}

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!clientsLoaded}
            style={{
              padding: '10px 18px', background: '#1e1e1e', color: '#ddd', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: clientsLoaded ? 'pointer' : 'not-allowed',
            }}
          >
            Choose CSV file
          </button>
          <span style={{ color: fileName ? '#aaa' : '#444', fontSize: 13.5 }}>
            {fileName || 'No file selected'}
          </span>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ color: '#888', fontSize: 13.5 }}>
              {importableRows.length} row{importableRows.length === 1 ? '' : 's'} ready to import
              {newClientNames.length > 0 && ` · ${newClientNames.length} new client${newClientNames.length === 1 ? '' : 's'} will be created`}
              {blockedRows.length > 0 && ` · ${blockedRows.length} row${blockedRows.length === 1 ? '' : 's'} skipped (no client name)`}
            </div>
            <button
              onClick={handleImport}
              disabled={importing || importableRows.length === 0}
              style={{
                padding: '10px 20px', background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: (importing || importableRows.length === 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {importing ? 'Importing…' : `Import ${importableRows.length} project${importableRows.length === 1 ? '' : 's'}`}
            </button>
          </div>

          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['Project', 'Client', 'Start', 'Status', 'Contract', 'Paid', 'Issues'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#444', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.rowNumber} style={{ borderBottom: '1px solid #1a1a1a', opacity: r.clientName ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 14px', color: '#ddd' }}>{r.projectName}</td>
                    <td style={{ padding: '10px 14px', color: r.clientName ? '#aaa' : '#ef4444' }}>
                      {r.clientName || 'missing'}
                      {r.isNewClient && <span style={{ marginLeft: 6, fontSize: 10.5, color: '#3b82f6', background: '#3b82f622', padding: '1px 6px', borderRadius: 10 }}>new</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>{r.startDateIso ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#888', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{r.status.replace('_', ' ')}</td>
                    <td style={{ padding: '10px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>{formatMoney(r.totalValue)}</td>
                    <td style={{ padding: '10px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>{formatMoney(r.amountPaid)}</td>
                    <td style={{ padding: '10px 14px', color: '#f59e0b', fontSize: 12 }}>
                      {r.issues.length > 0 ? r.issues.join('; ') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportCsv;
