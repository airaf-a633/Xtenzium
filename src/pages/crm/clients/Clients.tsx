import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { clientFields } from '../../../lib/view-fields';
import { applyFilters, applySearch, applySort } from '../../../lib/views';
import { formatMoney } from '../../../lib/money';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR, toPkr } from '../../../lib/settings';
import type { Client, Project, TeamMember } from '../../../types/database';
import {
  Avatar,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  SkeletonTiles,
  Stat,
  TableShell,
  Td,
  Th,
  Tr,
} from '../../../components/crm/ui';
import ViewBar from '../../../components/crm/ViewBar';
import { useView } from '../../../components/crm/useView';
import { cn } from '../../../lib/utils';

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Clients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*'),
        supabase.from('team_members').select('*').order('name'),
        getUsdToPkrRate(),
      ]);

    fetchAll().then(([c, p, m, usdRate]) => {
      if (cancelled) return;
      if (c.error) {
        setFailed(c.error.message);
        setLoading(false);
        return;
      }
      setClients((c.data ?? []) as Client[]);
      setProjects((p.data ?? []) as Project[]);
      setMembers((m.data ?? []) as TeamMember[]);
      setRate(usdRate);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const me = useMemo(
    () => members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [members, user],
  );

  const view = useView('clients', me);
  const fields = useMemo(() => clientFields(), []);

  /* What a client is worth, and what they still owe. Derived from their
     projects rather than stored, so it can never disagree with them. */
  const byClient = useMemo(() => {
    const map: Record<string, { count: number; value: number; outstanding: number }> = {};
    projects.forEach(p => {
      const entry = map[p.client_id] ?? { count: 0, value: 0, outstanding: 0 };
      entry.count += 1;
      entry.value += toPkr(Number(p.total_value), p.currency, rate);
      if (p.status !== 'cancelled') {
        const due = Number(p.total_value) - Number(p.amount_paid);
        if (due > 0) entry.outstanding += toPkr(due, p.currency, rate);
      }
      map[p.client_id] = entry;
    });
    return map;
  }, [projects, rate]);

  const rows = useMemo(
    () =>
      applySort(
        applySearch(applyFilters(clients, view.view.filters, fields), view.view.search, fields),
        view.view.sort,
        fields,
      ),
    [clients, view.view, fields],
  );

  const totalValue = Object.values(byClient).reduce((s, c) => s + c.value, 0);
  const totalOutstanding = Object.values(byClient).reduce((s, c) => s + c.outstanding, 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={loading ? undefined : `${clients.length} total`}
        actions={
          <ButtonLink to="/crm/clients/new" variant="primary" icon={<PlusIcon />}>
            New client
          </ButtonLink>
        }
      />

      {failed && <ErrorState title="Clients couldn’t load" body={failed} />}

      {!failed && (
        <>
          <section className="mb-5" aria-label="Summary">
            {loading ? (
              <SkeletonTiles count={3} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat label="Clients" value={clients.length} />
                <Stat
                  label="Lifetime value"
                  value={formatMoney(totalValue)}
                  sub="Across every project"
                  tone="copper"
                />
                <Stat
                  label="Outstanding"
                  value={formatMoney(totalOutstanding)}
                  sub={totalOutstanding > 0 ? 'Delivered and unpaid' : 'Everything settled'}
                  tone={totalOutstanding > 0 ? 'warning' : 'success'}
                />
              </div>
            )}
          </section>

          <ViewBar
            fields={fields}
            view={view.view}
            onChange={view.setView}
            onReset={view.resetView}
            savedViews={view.savedViews}
            activeViewId={view.activeViewId}
            onApplySaved={view.applySavedView}
            onSave={view.saveView}
            onUpdateActive={view.updateActiveView}
            onDelete={view.deleteView}
            shareUrl={view.shareUrl}
            viewsUnavailable={view.viewsUnavailable}
            searchPlaceholder="Search clients…"
          />

          {loading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={clients.length === 0 ? 'No clients yet' : 'Nothing matches'}
              body={
                clients.length === 0
                  ? 'Add one directly, or win a deal on the pipeline — that creates the client and its first project for you.'
                  : 'No client fits the current filters. Clear them to see everyone.'
              }
              action={
                clients.length === 0 ? (
                  <ButtonLink to="/crm/clients/new" variant="primary" size="sm">
                    Add a client
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Contact</Th>
                  <Th align="right">Projects</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">Outstanding</Th>
                  <Th align="right">Added</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const stats = byClient[c.id] ?? { count: 0, value: 0, outstanding: 0 };
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <Link
                          to={`/crm/clients/${c.id}`}
                          className="inline-flex items-center gap-2.5 no-underline"
                        >
                          <Avatar name={c.name} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-crm-ink">
                              {c.name}
                            </span>
                            {c.company && (
                              <span className="block truncate text-[12px] text-crm-ink-3">
                                {c.company}
                              </span>
                            )}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="text-[13px] text-crm-ink-2 no-underline hover:text-crm-copper"
                          >
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-[13px] text-crm-faint">—</span>
                        )}
                        {c.phone && (
                          <span className="mt-0.5 block text-[12px] text-crm-ink-3">{c.phone}</span>
                        )}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12.5px]">
                        {stats.count || '—'}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12.5px]">
                        {stats.value > 0 ? formatMoney(stats.value) : '—'}
                      </Td>
                      <Td
                        align="right"
                        className={cn(
                          'font-crm-mono text-[12.5px]',
                          stats.outstanding > 0 && 'text-crm-warning',
                        )}
                      >
                        {stats.outstanding > 0 ? formatMoney(stats.outstanding) : '—'}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12px] text-crm-ink-3">
                        {formatDate(c.created_at)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}

          {!loading && (
            <p className="m-0 mt-4 font-crm-mono text-[10.5px] uppercase tracking-[0.1em] text-crm-faint">
              Money normalised at USD 1 = PKR {rate}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Clients;
