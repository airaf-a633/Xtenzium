import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR } from '../../lib/settings';
import { formatMoney } from '../../lib/money';
import { PRIORITY_LABEL, PRIORITY_TONE, formatDuration } from '../../lib/tasks';
import { dealNudges, sortNudges, taskNudges } from '../../lib/notifications';
import { parseDateOnly, today } from '../../lib/date';
import { attentionOf, isOpen } from '../../lib/deals';
import type { Deal, Project, Task, TeamMember } from '../../types/database';
import {
  Badge,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  ErrorState,
  Label,
  PageHeader,
  SkeletonRows,
  SkeletonTiles,
  Stat,
} from '../../components/crm/ui';
import { cn } from '../../lib/utils';

/* One question: what is on me, right now.

   Deliberately not configurable and deliberately short. A "my work"
   page that can be filtered into a second dashboard stops being the
   thing you open first. */
const MyWork = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loggedByTask, setLoggedByTask] = useState<Record<string, number>>({});
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('deals').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('team_members').select('*').order('name'),
        supabase.from('task_time_totals').select('*'),
        getUsdToPkrRate(),
      ]);

    fetchAll().then(([t, d, p, m, time, usdRate]) => {
      if (cancelled) return;
      if (t.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      setTasks((t.data ?? []) as Task[]);
      setDeals((d.data ?? []) as Deal[]);
      setProjects((p.data ?? []) as Project[]);
      setMembers((m.data ?? []) as TeamMember[]);
      setLoggedByTask(
        Object.fromEntries(
          ((time.data ?? []) as Array<{ task_id: string; logged_minutes: number }>).map(r => [
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

  const me = useMemo(
    () => members.find(x => x.user_id && x.user_id === user?.id) ?? null,
    [members, user],
  );
  const projectsById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  const myTasks = useMemo(
    () =>
      tasks
        .filter(t => me && t.assigned_to === me.id && t.status !== 'done' && !t.parent_task_id)
        /* Overdue first, then by date, then by priority — the order you
           would actually work them in. */
        .sort((a, b) => {
          const ad = a.due_date ?? '9999';
          const bd = b.due_date ?? '9999';
          return ad.localeCompare(bd) || a.priority - b.priority;
        }),
    [tasks, me],
  );

  const myDeals = useMemo(
    () =>
      deals
        .filter(d => me && d.owner_id === me.id && isOpen(d.stage))
        .filter(d => attentionOf(d) !== 'none'),
    [deals, me],
  );

  const nudges = useMemo(
    () =>
      me
        ? sortNudges([...dealNudges(deals, me.id), ...taskNudges(tasks, me.id)])
        : [],
    [deals, tasks, me],
  );

  const overdue = myTasks.filter(
    t => t.due_date != null && parseDateOnly(t.due_date) < today(),
  ).length;
  const dueToday = myTasks.filter(
    t => t.due_date != null && parseDateOnly(t.due_date).getTime() === today().getTime(),
  ).length;

  const first = me?.name.split(' ')[0] ?? 'you';

  return (
    <div>
      <PageHeader
        title="My work"
        subtitle={
          loading
            ? undefined
            : me
              ? `${myTasks.length} open on ${first}${overdue > 0 ? ` · ${overdue} overdue` : ''}`
              : undefined
        }
      />

      {failed && (
        <ErrorState
          title="Couldn’t load your work"
          body="This is a connection problem, not your data. Reload and try again."
        />
      )}

      {!failed && !loading && !me && (
        <ErrorState
          title="Your account isn’t linked to a team member yet"
          body="Open Team and press “This is me” next to your name. Until then the CRM can’t tell which work is yours — everything still works, it just can’t be filtered to you."
        />
      )}

      {!failed && (loading || me) && (
        <>
          <section className="mb-5" aria-label="Summary">
            {loading ? (
              <SkeletonTiles count={4} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat label="Open tasks" value={myTasks.length} />
                <Stat
                  label="Overdue"
                  value={overdue}
                  tone={overdue > 0 ? 'danger' : 'success'}
                  sub={overdue === 0 ? 'Nothing has slipped' : 'Past the due date'}
                />
                <Stat label="Due today" value={dueToday} tone={dueToday > 0 ? 'copper' : 'ink'} />
                <Stat
                  label="Deals needing you"
                  value={myDeals.length}
                  tone={myDeals.length > 0 ? 'warning' : 'success'}
                  sub={myDeals.length === 0 ? 'All have a next step' : 'No step, late, or cold'}
                />
              </div>
            )}
          </section>

          {!loading && nudges.length > 0 && (
            <section className="mb-5">
              <Label className="mb-2 block">Needs you first</Label>
              <div className="flex flex-col gap-1.5">
                {nudges.slice(0, 5).map(n => (
                  <Link
                    key={n.id}
                    to={n.entity === 'deal' ? '/crm/pipeline' : '/crm/tasks'}
                    className="flex items-center gap-2.5 rounded-crm-md border border-crm-line bg-crm-surface px-3.5 py-2.5 no-underline transition-colors duration-150 ease-crm hover:border-crm-line-hi hover:bg-crm-raised"
                  >
                    <Dot tone={n.tone} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-crm-ink">{n.title}</span>
                    <span className="shrink-0 text-[12px] text-crm-ink-3">{n.body}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid items-start gap-5 lg:[grid-template-columns:1.5fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader
                title="Your tasks"
                action={
                  <Link
                    to="/crm/tasks"
                    className="text-[12.5px] text-crm-ink-3 no-underline transition-colors duration-150 ease-crm hover:text-crm-copper"
                  >
                    All tasks →
                  </Link>
                }
              />
              {loading ? (
                <SkeletonRows rows={5} className="p-4" />
              ) : myTasks.length === 0 ? (
                <EmptyState
                  className="m-4 border-0"
                  title="Nothing assigned to you"
                  body="When someone assigns you a task it lands here, and you’ll hear about it in the bell."
                />
              ) : (
                <ul className="m-0 list-none p-0">
                  {myTasks.slice(0, 12).map(t => {
                    const late = t.due_date != null && parseDateOnly(t.due_date) < today();
                    const project = t.project_id ? projectsById[t.project_id] : null;
                    const logged = loggedByTask[t.id] ?? 0;
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 border-b border-crm-line px-4 py-2.5 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-crm-ink">{t.title}</span>
                          <span className="block truncate text-[11.5px] text-crm-ink-3">
                            {project?.name ?? 'No project'}
                            {logged > 0 && ` · ${formatDuration(logged)} logged`}
                          </span>
                        </span>
                        {t.priority <= 2 && (
                          <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                        )}
                        <span
                          className={cn(
                            'crm-num shrink-0 font-crm-mono text-[11.5px]',
                            late ? 'text-crm-danger' : 'text-crm-faint',
                          )}
                        >
                          {t.due_date
                            ? parseDateOnly(t.due_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Your deals"
                action={
                  <Link
                    to="/crm/pipeline"
                    className="text-[12.5px] text-crm-ink-3 no-underline transition-colors duration-150 ease-crm hover:text-crm-copper"
                  >
                    Pipeline →
                  </Link>
                }
              />
              {loading ? (
                <SkeletonRows rows={4} className="p-4" />
              ) : myDeals.length === 0 ? (
                <EmptyState
                  className="m-4 border-0"
                  title="Every deal has a next step"
                  body="Deals only appear here when they need something — no agreed action, an overdue one, or going quiet."
                />
              ) : (
                <ul className="m-0 list-none p-0">
                  {myDeals.slice(0, 10).map(d => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 border-b border-crm-line px-4 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-crm-ink">{d.title}</span>
                        <span className="block truncate text-[11.5px] text-crm-ink-3">
                          {d.next_action ?? 'No next step agreed'}
                        </span>
                      </span>
                      <span className="crm-num shrink-0 font-crm-mono text-[11.5px] text-crm-ink-2">
                        {formatMoney(Number(d.value) * (d.currency === 'USD' ? rate : 1))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MyWork;
