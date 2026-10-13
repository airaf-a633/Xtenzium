import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DialerReport } from '../../../types/database';
import { dayStartInZone, outcomeLabel } from '../../../lib/dialer-calls';
import {
  Card, CardHeader, EmptyState, ErrorState, PageHeader, SegmentedControl, Skeleton, Stat,
  TableShell, Td, Th, Tr,
} from '../../../components/crm/ui';

type Range = 'today' | '7d' | '30d' | 'all';
const PKT = 'Asia/Karachi';

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

/* A bar is a label, a length and a number — no chart library needed for
   rows of counts, and it prints cleanly. */
const Bar = ({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) => (
  <div className="flex items-center gap-3 text-[13px]">
    <span className="w-[150px] shrink-0 truncate text-crm-ink-2">{label}</span>
    <span className="h-2 flex-1 overflow-hidden rounded-full bg-crm-line">
      <span
        className="block h-full rounded-full bg-crm-copper"
        style={{ width: `${max === 0 ? 0 : Math.max(2, Math.round((value / max) * 100))}%` }}
      />
    </span>
    <span className="w-[88px] shrink-0 text-right tabular-nums text-crm-ink">
      {value}
      {sub && <span className="text-crm-ink-3"> {sub}</span>}
    </span>
  </div>
);

const Reports = () => {
  const [range, setRange] = useState<Range>('7d');
  const [report, setReport] = useState<DialerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const from =
      range === 'today' ? dayStartInZone(new Date(now), PKT)
      : range === '7d' ? new Date(now - 7 * 86400000)
      : range === '30d' ? new Date(now - 30 * 86400000)
      : new Date(0);

    supabase
      .rpc('dialer_report', { p_from: from.toISOString(), p_to: new Date(now + 86400000).toISOString(), p_tz: PKT })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(error.message);
        else {
          setReport(data as DialerReport);
          setFailed(null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const t = report?.totals;
  const f = report?.funnel;
  const funnel: [string, number][] = f
    ? [['Leads called', f.leads_called], ['Spoke to someone', f.conversations], ['Interested', f.interested], ['Meeting agreed', f.meetings], ['Deal created', f.deals], ['Deal won', f.won]]
    : [];

  return (
    <div className="flex max-w-[900px] flex-col gap-5">
      <PageHeader title="Dialer reports" subtitle="How the calling is going. Days are Karachi days." />

      <SegmentedControl
        label="Date range"
        value={range}
        onChange={v => {
          setLoading(true);
          setRange(v);
        }}
        options={[
          { value: 'today', label: 'Today' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'all', label: 'All time' },
        ]}
      />

      {failed && <ErrorState title="The report couldn’t load" body={failed} />}
      {loading && <Skeleton className="h-[240px] w-full" />}

      {!loading && report && t && t.dials === 0 && (
        <EmptyState title="No calls in this range" body="Pick a longer range, or wait for the rep to log some calls." />
      )}

      {!loading && report && t && t.dials > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Dials" value={t.dials.toLocaleString()} />
            <Stat label="Conversations" value={t.conversations.toLocaleString()} sub={`${pct(t.conversations, t.dials)} of dials`} />
            <Stat label="Interested" value={t.interested.toLocaleString()} sub={`${pct(t.interested, t.conversations)} of convos`} />
            <Stat label="Meetings" value={t.meetings.toLocaleString()} sub={`${pct(t.meetings, t.conversations)} of convos`} tone="success" />
          </div>

          <Card>
            <CardHeader title="Funnel (unique leads)" />
            <div className="flex flex-col gap-2 p-4">
              {funnel.map(([label, n], i) => (
                <Bar key={label} label={label} value={n} max={funnel[0][1]} sub={i === 0 ? '' : pct(n, funnel[i - 1][1])} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Per day" />
            <div className="flex flex-col gap-2 p-4">
              {report.by_day.map(d => (
                <Bar
                  key={d.day}
                  label={d.day}
                  value={d.dials}
                  max={Math.max(...report.by_day.map(x => x.dials))}
                  sub={`${d.conversations} talk · ${d.meetings} mtg`}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Best hours to call (prospect’s local time)" />
            <div className="flex flex-col gap-2 p-4">
              {report.by_hour.map(h => (
                <Bar
                  key={h.hour}
                  label={hourLabel(h.hour)}
                  value={h.conversations}
                  max={Math.max(1, ...report.by_hour.map(x => x.conversations))}
                  sub={`of ${h.dials} (${pct(h.conversations, h.dials)})`}
                />
              ))}
              <p className="m-0 mt-1 text-[12px] text-crm-ink-3">
                Bars show conversations; the figure after shows the share of dials in that hour that reached someone.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Outcomes" />
            <div className="flex flex-col gap-2 p-4">
              {report.by_outcome.map(o => (
                <Bar key={o.outcome} label={outcomeLabel(o.outcome)} value={o.n} max={report.by_outcome[0].n} sub={pct(o.n, t.dials)} />
              ))}
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader title="By tier" />
              <TableShell className="border-0">
                <thead>
                  <tr><Th>Tier</Th><Th align="right">Dials</Th><Th align="right">Talk</Th><Th align="right">Mtgs</Th></tr>
                </thead>
                <tbody>
                  {report.by_tier.map(r => (
                    <Tr key={r.tier}>
                      <Td className="font-medium text-crm-ink">{r.tier}</Td>
                      <Td align="right">{r.dials}</Td>
                      <Td align="right">{r.conversations}</Td>
                      <Td align="right">{r.meetings}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
            </Card>
            <Card>
              <CardHeader title="By list" />
              <TableShell className="border-0">
                <thead>
                  <tr><Th>List</Th><Th align="right">Dials</Th><Th align="right">Talk</Th><Th align="right">Mtgs</Th></tr>
                </thead>
                <tbody>
                  {report.by_list.map(r => (
                    <Tr key={r.list}>
                      <Td className="max-w-[160px] truncate font-medium text-crm-ink">{r.list}</Td>
                      <Td align="right">{r.dials}</Td>
                      <Td align="right">{r.conversations}</Td>
                      <Td align="right">{r.meetings}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
