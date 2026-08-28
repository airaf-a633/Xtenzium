import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR } from '../../lib/settings';
import { formatMoney, formatMoneyCompact } from '../../lib/money';
import { formatDuration } from '../../lib/tasks';
import {
  funnel,
  headline,
  lostByMonth,
  lostReasons,
  pipelineByStage,
  receivablesAging,
  teamLoad,
  throughputByMonth,
  winStats,
  wonByMonth,
} from '../../lib/reporting';
import type { Deal, Project, Task, TeamMember } from '../../types/database';
import { ErrorState, PageHeader, SkeletonTiles, Stat } from '../../components/crm/ui';
import { BarRows, ChartCard, Funnel, LineChart } from '../../components/crm/charts/Charts';

const Dashboard = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loggedByTask, setLoggedByTask] = useState<Record<string, number>>({});
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /* Pure I/O — fetches and returns, writes no state. */
    const fetchAll = () =>
      Promise.all([
        supabase.from('deals').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('team_members').select('*').order('name'),
        supabase.from('task_time_totals').select('*'),
        getUsdToPkrRate(),
      ]);

    /* Six requests, issued together — and every figure below is derived
       from what they return. See the note in migration 010 for why the
       aggregation is here rather than in SQL views. */
    fetchAll().then(([dealsResult, projectsResult, tasksResult, membersResult, timeResult, usdRate]) => {
      if (cancelled) return;

      if (projectsResult.error) {
        setFailed(true);
        setLoading(false);
        return;
      }

      setDeals((dealsResult.data ?? []) as Deal[]);
      setProjects((projectsResult.data ?? []) as Project[]);
      setTasks((tasksResult.data ?? []) as Task[]);
      setMembers((membersResult.data ?? []) as TeamMember[]);
      setLoggedByTask(
        Object.fromEntries(
          ((timeResult.data ?? []) as Array<{ task_id: string; logged_minutes: number }>).map(r => [
            r.task_id,
            r.logged_minutes,
          ]),
        ),
      );
      setRate(usdRate);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const top = useMemo(() => headline(deals, projects, tasks, rate), [deals, projects, tasks, rate]);
  const stages = useMemo(() => pipelineByStage(deals, rate), [deals, rate]);
  const steps = useMemo(() => funnel(deals), [deals]);
  const wins = useMemo(() => winStats(deals, rate), [deals, rate]);
  const reasons = useMemo(() => lostReasons(deals), [deals]);
  const aging = useMemo(() => receivablesAging(projects, rate), [projects, rate]);
  const load = useMemo(() => teamLoad(tasks, members, loggedByTask), [tasks, members, loggedByTask]);
  const won = useMemo(() => wonByMonth(deals, rate), [deals, rate]);
  const lost = useMemo(() => lostByMonth(deals, rate), [deals, rate]);
  const throughput = useMemo(() => throughputByMonth(tasks), [tasks]);

  const money = (v: number) => formatMoneyCompact(v);
  const count = (v: number) => String(v);
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={todayLabel}
        actions={
          <Link
            to="/crm/my-work"
            className="text-[12.5px] text-crm-copper no-underline transition-colors duration-150 ease-crm hover:underline"
          >
            My work →
          </Link>
        }
      />

      {failed && (
        <ErrorState
          title="The dashboard couldn’t load"
          body="Your data is fine — this is a connection problem. Reload, and if it persists check the project’s API status."
        />
      )}

      {!failed && (
        <>
          {/* Five numbers in the order a business reads them: what's
              coming, what's owed, how often we win, how big, what's late. */}
          <section className="mb-5" aria-label="Headline">
            {loading ? (
              <SkeletonTiles count={5} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat
                  label="Weighted pipeline"
                  value={formatMoney(top.weightedPipeline)}
                  sub={`${top.openDeals} open ${top.openDeals === 1 ? 'deal' : 'deals'}`}
                  tone="copper"
                />
                <Stat
                  label="Outstanding"
                  value={formatMoney(top.outstanding)}
                  sub="Delivered and unpaid"
                  tone={top.outstanding > 0 ? 'warning' : 'success'}
                />
                <Stat
                  label="Win rate"
                  value={wins.winRate === null ? '—' : `${wins.winRate}%`}
                  sub={
                    wins.won + wins.lost === 0
                      ? 'No closed deals yet'
                      : `${wins.won} won of ${wins.won + wins.lost}`
                  }
                  tone="success"
                />
                <Stat
                  label="Average won deal"
                  value={wins.averageWon === 0 ? '—' : formatMoney(wins.averageWon)}
                  sub={wins.won === 0 ? 'Nothing won yet' : `Across ${wins.won}`}
                />
                <Stat
                  label="Overdue tasks"
                  value={top.overdueTasks}
                  sub={`${top.activeProjects} active projects`}
                  tone={top.overdueTasks > 0 ? 'danger' : 'success'}
                />
              </div>
            )}
          </section>

          {loading ? (
            <SkeletonTiles count={4} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Won and lost"
                hint="By month, normalised to PKR"
                rows={won.map((p, i) => [
                  p.label,
                  `won ${formatMoney(p.value)} · lost ${formatMoney(lost[i]?.value ?? 0)}`,
                ])}
              >
                <LineChart
                  format={formatMoney}
                  series={[
                    { name: 'Won', slot: 1, points: won },
                    { name: 'Lost', slot: 2, points: lost },
                  ]}
                />
              </ChartCard>

              <ChartCard
                title="Pipeline by stage"
                hint="Weighted — value × probability"
                rows={stages.map(s => [s.label, `${formatMoney(s.weighted)} · ${s.count} deals`])}
              >
                <BarRows
                  ordinal
                  format={money}
                  data={stages.map(s => ({
                    label: s.label,
                    value: s.weighted,
                    meta: `${s.count} deals`,
                  }))}
                />
              </ChartCard>

              <ChartCard
                title="How far deals get"
                hint="Open and won only — the stage a lost deal died in isn’t recorded yet"
                rows={steps.map(s => [
                  s.label,
                  `${s.reached} reached${s.conversion === null ? '' : ` · ${s.conversion}% of previous`}`,
                ])}
              >
                <Funnel steps={steps} />
              </ChartCard>

              <ChartCard
                title="Receivables"
                hint="Aged from each project’s end date"
                rows={aging.map(b => [b.label, `${formatMoney(b.value)} · ${b.count} projects`])}
              >
                <BarRows
                  ordinal
                  format={money}
                  data={aging.map(b => ({
                    label: b.label,
                    value: b.value,
                    meta: `${b.count} projects`,
                  }))}
                />
              </ChartCard>

              <ChartCard
                title="Team load"
                hint="Open tasks, most overdue first"
                rows={load.map(l => [
                  l.name,
                  `${l.open} open · ${l.overdue} overdue · ${formatDuration(l.loggedMinutes)} logged`,
                ])}
              >
                <BarRows
                  format={count}
                  data={load.map(l => ({
                    label: l.name,
                    value: l.open,
                    meta: `${l.overdue} overdue`,
                  }))}
                />
              </ChartCard>

              <ChartCard
                title="Why deals are lost"
                hint={reasons.length === 0 ? 'Nothing lost yet' : 'Grouped on the recorded reason'}
                rows={reasons.map(r => [r.label, String(r.value)])}
              >
                <BarRows format={count} data={reasons} />
              </ChartCard>

              <ChartCard
                title="Tasks completed"
                hint="By month"
                rows={throughput.map(p => [p.label, String(p.value)])}
              >
                <LineChart
                  format={count}
                  series={[{ name: 'Completed', slot: 3, points: throughput }]}
                />
              </ChartCard>
            </div>
          )}

          {!loading && (
            <p className="m-0 mt-5 font-crm-mono text-[10.5px] uppercase tracking-[0.1em] text-crm-faint">
              Money normalised at USD 1 = PKR {rate}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
