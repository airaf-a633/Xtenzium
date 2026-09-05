import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR, toPkr } from '../../../lib/settings';
import { formatMoney } from '../../../lib/money';
import { projectFields } from '../../../lib/view-fields';
import { applyFilters, applySearch, applySort } from '../../../lib/views';
import { parseDateOnly } from '../../../lib/date';
import type { Client, Project, ProjectStatus, TeamMember } from '../../../types/database';
import {
  Badge,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  SegmentedControl,
  SkeletonTiles,
  Stat,
  TableShell,
  Td,
  Th,
  Tr,
  useToast,
} from '../../../components/crm/ui';
import ViewBar from '../../../components/crm/ViewBar';
import { useView } from '../../../components/crm/useView';
import ProjectsBoard from './ProjectsBoard';
import ProjectsCalendar from './ProjectsCalendar';
import { cn } from '../../../lib/utils';

const LAYOUTS = [
  { value: 'board' as const, label: 'Board' },
  { value: 'list' as const, label: 'List' },
  { value: 'calendar' as const, label: 'Calendar' },
];
type Layout = (typeof LAYOUTS)[number]['value'];

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Projects = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('board');

  useEffect(() => {
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('team_members').select('*').order('name'),
        getUsdToPkrRate(),
      ]);

    fetchAll().then(([p, c, m, usdRate]) => {
      if (cancelled) return;
      if (p.error) {
        setFailed(p.error.message);
        setLoading(false);
        return;
      }
      setProjects((p.data ?? []) as Project[]);
      setClients((c.data ?? []) as Client[]);
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
  const clientsById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const view = useView('projects', me);
  const fields = useMemo(() => projectFields(clients), [clients]);

  const rows = useMemo(
    () =>
      applySort(
        applySearch(applyFilters(projects, view.view.filters, fields), view.view.search, fields),
        view.view.sort,
        fields,
      ),
    [projects, view.view, fields],
  );

  const changeStatus = async (projectId: string, status: ProjectStatus) => {
    const previous = projects;
    setProjects(list => list.map(p => (p.id === projectId ? { ...p, status } : p)));
    const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
    if (error) {
      setProjects(previous);
      toast('That move didn’t stick — the board has been put back.', 'danger');
    }
  };

  const active = projects.filter(p => p.status === 'active').length;
  const pipeline = projects
    .filter(p => p.status === 'active' || p.status === 'proposal')
    .reduce((s, p) => s + toPkr(Number(p.total_value), p.currency, rate), 0);
  const outstanding = projects
    .filter(p => p.status !== 'cancelled')
    .reduce((s, p) => {
      const due = Number(p.total_value) - Number(p.amount_paid);
      return due > 0 ? s + toPkr(due, p.currency, rate) : s;
    }, 0);

  const formatDate = (iso: string | null) =>
    iso ? parseDateOnly(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={loading ? undefined : `${projects.length} total · ${active} active`}
        actions={
          <>
            <ButtonLink to="/crm/projects/import">Import CSV</ButtonLink>
            <ButtonLink to="/crm/projects/new" variant="primary" icon={<PlusIcon />}>
              New project
            </ButtonLink>
          </>
        }
      />

      {failed && <ErrorState title="Projects couldn’t load" body={failed} />}

      {!failed && (
        <>
          <section className="mb-5" aria-label="Summary">
            {loading ? (
              <SkeletonTiles count={4} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat label="Total" value={projects.length} />
                <Stat label="Active" value={active} tone="success" />
                <Stat
                  label="In flight"
                  value={formatMoney(pipeline)}
                  sub="Active and proposed"
                  tone="copper"
                />
                <Stat
                  label="Outstanding"
                  value={formatMoney(outstanding)}
                  sub={outstanding > 0 ? 'Delivered and unpaid' : 'Everything settled'}
                  tone={outstanding > 0 ? 'warning' : 'success'}
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
            searchPlaceholder="Search projects…"
            /* The board's columns are the statuses — regrouping it would
               promise something drag-to-change can't honour. */
            hideGroup
          >
            <SegmentedControl
              label="Project layout"
              value={layout}
              onChange={setLayout}
              options={LAYOUTS}
            />
          </ViewBar>

          {loading ? (
            <SkeletonTiles count={5} />
          ) : layout === 'board' ? (
            <ProjectsBoard
              projects={rows}
              clientsById={clientsById}
              usdRate={rate}
              onStatusChange={changeStatus}
            />
          ) : layout === 'calendar' ? (
            <ProjectsCalendar projects={rows} clientsById={clientsById} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={projects.length === 0 ? 'No projects yet' : 'Nothing matches'}
              body={
                projects.length === 0
                  ? 'Win a deal on the pipeline and its project is created for you, or add one directly.'
                  : 'No project fits the current filters.'
              }
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Outstanding</Th>
                  <Th align="right">Ends</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const value = toPkr(Number(p.total_value), p.currency, rate);
                  const due = Number(p.total_value) - Number(p.amount_paid);
                  const owed = p.status !== 'cancelled' && due > 0 ? toPkr(due, p.currency, rate) : 0;
                  const paidPct = Number(p.total_value) > 0
                    ? Math.round((Number(p.amount_paid) / Number(p.total_value)) * 100)
                    : 0;
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <Link to={`/crm/projects/${p.id}`} className="block no-underline">
                          <span className="block truncate text-[13.5px] font-medium text-crm-ink">
                            {p.name}
                          </span>
                          <span className="block truncate text-[12px] text-crm-ink-3">
                            {clientsById[p.client_id]?.name ?? 'Unknown client'}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={PROJECT_STATUS_TONE[p.status] ?? 'neutral'} dot>
                          {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12.5px]">
                        {formatMoney(value)}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12.5px] text-crm-ink-3">
                        {paidPct}%
                      </Td>
                      <Td
                        align="right"
                        className={cn('font-crm-mono text-[12.5px]', owed > 0 && 'text-crm-warning')}
                      >
                        {owed > 0 ? formatMoney(owed) : '—'}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12px] text-crm-ink-3">
                        {formatDate(p.end_date)}
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

export default Projects;
