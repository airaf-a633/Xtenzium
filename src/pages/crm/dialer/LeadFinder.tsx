import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import { formatInZone, formatPhone } from '../../../lib/dialer-calls';
import { Badge, Button, Card, CardHeader, Input } from '../../../components/crm/ui';

const WORKABLE = ['new', 'retry', 'callback', 'nurture', 'followup', 'meeting', 'exhausted', 'lost', 'disqualified', 'bad_data'];

/* Two things the queue can't do on its own: show what's coming up (the
   rep's promised callbacks) and find one company again — a prospect
   calling back, or "call my direct line" — without waiting for the queue. */
const LeadFinder = ({ tz, refreshKey, onPick }: { tz: string; refreshKey: number; onPick: (lead: CallLead) => void }) => {
  const [open, setOpen] = useState(false);
  const [callbacks, setCallbacks] = useState<CallLead[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CallLead[] | 'error' | null>(null);
  // Characters that mean something to the filter syntax are dropped, not escaped.
  const term = q.trim().replace(/[%,()*"\\]/g, ' ').trim();

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    supabase
      .from('call_leads')
      .select('*')
      .eq('status', 'callback')
      .order('next_call_at', { ascending: true })
      .limit(15)
      .then(({ data }) => {
        if (!cancelled) setCallbacks((data ?? []) as CallLead[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  useEffect(() => {
    if (term.length < 3) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      const digits = term.replace(/\D/g, '');
      const filter = [`company_name.ilike.%${term}%`, digits.length >= 4 ? `phone_e164.ilike.%${digits}%` : null].filter(Boolean).join(',');
      supabase
        .from('call_leads')
        .select('*')
        .or(filter)
        .limit(8)
        .then(({ data, error }) => {
          if (!cancelled) setHits(error ? 'error' : ((data ?? []) as CallLead[]));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const row = (l: CallLead, extra?: string) => (
    <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
      <strong className="text-crm-ink">{l.company_name}</strong>
      <span className="font-crm-mono text-crm-ink-2">{formatPhone(l.phone_e164, l.phone_raw)}</span>
      <Badge tone="neutral">{l.status}</Badge>
      {extra && <span className="text-crm-ink-3">{extra}</span>}
      {l.status !== 'dnc' && WORKABLE.includes(l.status) && (
        <Button variant="ghost" className="ml-auto" onClick={() => onPick(l)}>Work this lead</Button>
      )}
    </li>
  );

  return (
    <Card>
      <CardHeader
        title="Find a lead · upcoming callbacks"
        action={<Button variant="ghost" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'}</Button>}
      />
      {open && (
        <div className="flex flex-col">
          <div className="p-4 pb-2">
            <Input label="Search company or phone" value={q} onChange={e => setQ(e.target.value)} placeholder="At least 3 characters" />
          </div>
          {term.length >= 3 && hits && (
            <ul className="m-0 list-none divide-y divide-crm-line p-0">
              {hits === 'error' ? (
                <li className="px-4 py-2.5 text-[13px] text-crm-danger">The search failed — try again.</li>
              ) : hits.length === 0 ? (
                <li className="px-4 py-2.5 text-[13px] text-crm-ink-3">No match.</li>
              ) : (
                hits.map(l => row(l))
              )}
            </ul>
          )}
          <p className="m-0 border-t border-crm-line px-4 pt-3 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">
            Callbacks you've promised
          </p>
          <ul className="m-0 list-none divide-y divide-crm-line p-0">
            {callbacks.length === 0 ? (
              <li className="px-4 py-2.5 text-[13px] text-crm-ink-3">None scheduled.</li>
            ) : (
              callbacks.map(l => row(l, l.next_call_at ? formatInZone(new Date(l.next_call_at), tz) : undefined))
            )}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default LeadFinder;
