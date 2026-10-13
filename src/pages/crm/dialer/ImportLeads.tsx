import { useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { parseCsv } from '../../../lib/csv';
import {
  FIELDS, autoMap, prepareRows, summarize,
  type FieldKey, type KnownKeys, type Mapping,
} from '../../../lib/dialer-import';
import {
  Button, ButtonLink, Card, CardHeader, ErrorState, Input, PageHeader, Select,
  TableShell, Td, Th, Tr, useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const CHUNK = 500;
const FIELD_OPTIONS = FIELDS.map(f => ({ value: f.key, label: f.label + (f.required ? ' *' : '') }));

interface Parsed {
  filename: string;
  headers: string[];
  rows: string[][];
}

type Phase = 'pick' | 'review' | 'importing' | 'done';

const today = () => new Date().toISOString().slice(0, 10);

const Count = ({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'muted' }) => (
  <div className="rounded-crm-md border border-crm-line bg-crm-surface px-3.5 py-3">
    <p className="m-0 font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">{label}</p>
    <p
      className={cn(
        'm-0 mt-1 text-[22px] font-semibold tabular-nums',
        tone === 'good' && 'text-crm-success',
        tone === 'warn' && 'text-crm-warning',
        (!tone || tone === 'muted') && 'text-crm-ink',
      )}
    >
      {value.toLocaleString()}
    </p>
  </div>
);

const ImportLeads = () => {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [known, setKnown] = useState<KnownKeys>({ phones: [], domains: [], dnc_phones: [], dnc_domains: [] });
  const [listName, setListName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; skipped: number; listId: string } | null>(null);

  const usFlagColumn = useMemo(() => {
    const i = parsed?.headers.findIndex(h => h.toLowerCase().replace(/[^a-z]/g, '') === 'phoneisus') ?? -1;
    return i >= 0 ? i : null;
  }, [parsed]);

  const prepared = useMemo(
    () => (parsed ? prepareRows(parsed.headers, parsed.rows, mapping, known, usFlagColumn) : []),
    [parsed, mapping, known, usFlagColumn],
  );
  const summary = useMemo(() => summarize(prepared), [prepared]);
  const nameMapped = Object.values(mapping).includes('company_name');

  const readFile = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setError('That doesn’t look like a CSV file.');
      return;
    }
    const raw = await file.text();
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const [head, ...body] = parseCsv(text).filter(r => r.some(c => c.trim()));
    if (!head || body.length === 0) {
      setError('The file has no data rows.');
      return;
    }
    const headers = head.map(h => h.trim());

    const { data, error: keysError } = await supabase.rpc('dialer_known_keys');
    if (keysError) {
      setError(`Couldn’t check for duplicates: ${keysError.message}`);
      return;
    }
    setKnown(data as KnownKeys);
    setParsed({ filename: file.name, headers, rows: body });
    setMapping(autoMap(headers));
    setListName(`${file.name.replace(/\.csv$/i, '')} · ${today()}`);
    setPhase('review');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const setField = (col: number, key: FieldKey | '') => {
    setMapping(m => {
      const next: Mapping = { ...m };
      /* One column per field: choosing a field that's already taken
         releases it from the other column rather than importing twice. */
      if (key) for (const k of Object.keys(next)) if (next[Number(k)] === key) next[Number(k)] = '';
      next[col] = key;
      return next;
    });
  };

  const runImport = async () => {
    if (!parsed) return;
    const toWrite = prepared.filter(p => p.record).map(p => p.record!);
    setPhase('importing');
    setProgress({ done: 0, total: toWrite.length });

    const { data: list, error: listError } = await supabase
      .from('call_lists')
      .insert({ name: listName.trim() || parsed.filename, source_filename: parsed.filename })
      .select()
      .single();
    if (listError || !list) {
      setError(listError?.message ?? 'Couldn’t create the list.');
      setPhase('review');
      return;
    }

    let imported = 0;
    for (let i = 0; i < toWrite.length; i += CHUNK) {
      const { data, error: chunkError } = await supabase.rpc('import_call_leads', {
        p_list_id: list.id,
        p_rows: toWrite.slice(i, i + CHUNK),
      });
      if (chunkError) {
        /* Keep what went in; say how far it got. Re-importing the same
           file later is safe — duplicates are skipped. */
        await supabase.from('call_lists').update({ row_count: imported }).eq('id', list.id);
        setError(`Stopped after ${imported.toLocaleString()} leads: ${chunkError.message}. Re-uploading the file is safe — leads already in are skipped.`);
        setPhase('review');
        return;
      }
      imported += data as number;
      setProgress({ done: Math.min(i + CHUNK, toWrite.length), total: toWrite.length });
    }

    const skipped = parsed.rows.length - imported;
    await supabase.from('call_lists').update({ row_count: imported, skipped_count: skipped }).eq('id', list.id);
    setResult({ imported, skipped, listId: list.id });
    setPhase('done');
    toast(`${imported.toLocaleString()} leads imported`, 'success');
  };

  const reset = () => {
    setParsed(null);
    setError(null);
    setResult(null);
    setPhase('pick');
    if (fileInput.current) fileInput.current.value = '';
  };

  const sample = (col: number) => parsed?.rows.find(r => r[col]?.trim())?.[col]?.trim() ?? '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Import leads"
        subtitle="Upload a CSV. Phones are cleaned, duplicates and do-not-call numbers are dropped, and nothing is saved until you confirm."
        back={{ to: '/crm/dialer', label: 'Dialer' }}
      />

      {error && <ErrorState title="Import problem" body={error} />}

      {phase === 'pick' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-crm-lg border border-dashed px-6 py-14 text-center transition-colors',
            dragging ? 'border-crm-copper bg-crm-copper/5' : 'border-crm-line-hi bg-crm-surface',
          )}
        >
          <p className="m-0 text-[14px] text-crm-ink">Drop a CSV here</p>
          <p className="m-0 text-[12.5px] text-crm-ink-3">or</p>
          <Button variant="primary" onClick={() => fileInput.current?.click()}>
            Choose file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && void readFile(e.target.files[0])}
          />
        </div>
      )}

      {(phase === 'review' || phase === 'importing') && parsed && (
        <>
          <Card>
            <CardHeader title={`${parsed.filename} · ${parsed.rows.length.toLocaleString()} rows`} />
            <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
              <Count label="Ready to call" value={summary.callable} tone="good" />
              <Count label="No phone (outreach only)" value={summary.noPhone} tone="muted" />
              <Count label="Unreadable number" value={summary.badPhone} tone="warn" />
              <Count label="Non-US numbers" value={summary.nonUs} tone="muted" />
              <Count label="Duplicates in file" value={summary.dupFile} tone="warn" />
              <Count label="Already in CRM" value={summary.dupExisting} tone="warn" />
              <Count label="Do not call" value={summary.dnc} tone="warn" />
              <Count label="Missing name" value={summary.noName} tone="warn" />
            </div>
            <p className="m-0 border-t border-crm-line px-4 py-3 text-[12.5px] text-crm-ink-3">
              <strong className="text-crm-ink">{summary.toImport.toLocaleString()}</strong> will be imported ·
              Tier A {summary.byTier.A} · B {summary.byTier.B} · C {summary.byTier.C}
              {summary.byTier.none ? ` · untiered ${summary.byTier.none}` : ''}
            </p>
          </Card>

          <Card>
            <CardHeader title="Column mapping" />
            <div className="p-4">
              {!nameMapped && (
                <p className="m-0 mb-3 text-[13px] text-crm-danger">
                  Pick which column is the company name — every lead needs one.
                </p>
              )}
              <TableShell>
                <thead>
                  <tr>
                    <Th>CSV column</Th>
                    <Th>Example</Th>
                    <Th>Goes into</Th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((h, i) => (
                    <Tr key={i}>
                      <Td className="font-medium text-crm-ink">{h || `(column ${i + 1})`}</Td>
                      <Td className="max-w-[260px] truncate">{sample(i)}</Td>
                      <Td>
                        <Select
                          label={`Field for ${h || `column ${i + 1}`}`}
                          className="w-[220px] [&>label]:sr-only"
                          placeholder="Keep as extra info"
                          options={FIELD_OPTIONS}
                          value={mapping[i] ?? ''}
                          onChange={e => setField(i, e.target.value as FieldKey | '')}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <Input
                className="min-w-[260px] flex-1"
                label="List name"
                value={listName}
                onChange={e => setListName(e.target.value)}
              />
              <Button onClick={reset} disabled={phase === 'importing'}>Start over</Button>
              <Button
                variant="primary"
                loading={phase === 'importing'}
                disabled={!nameMapped || summary.toImport === 0}
                onClick={runImport}
              >
                {phase === 'importing'
                  ? `Importing ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
                  : `Import ${summary.toImport.toLocaleString()} leads`}
              </Button>
            </div>
          </Card>
        </>
      )}

      {phase === 'done' && result && (
        <Card>
          <CardHeader title="Import complete" />
          <div className="flex flex-col gap-3 p-4">
            <p className="m-0 text-[14px] text-crm-ink">
              <strong>{result.imported.toLocaleString()}</strong> leads imported
              {result.skipped > 0 && <> · {result.skipped.toLocaleString()} skipped (duplicates, do-not-call or missing name)</>}
            </p>
            <div className="flex gap-2">
              <ButtonLink to="/crm/dialer" variant="primary">Back to dialer</ButtonLink>
              <Button onClick={reset}>Import another file</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ImportLeads;
