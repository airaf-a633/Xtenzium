import { supabase } from './supabase';
import { toDateInput } from './date';
import type { Task } from '../types/database';

/* The only task helper that talks to the network. It lives apart from
   lib/tasks.ts so that file stays pure — priority config, duration
   parsing and board grouping can then be exercised directly, without
   standing up a Supabase client to do it. */
export async function spawnNextRecurrence(task: Task): Promise<Task | null> {
  if (!task.recurrence_days) return null;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + task.recurrence_days);
  const { data } = await supabase
    .from('tasks')
    .insert({
      project_id: task.project_id,
      title: task.title,
      /* toDateInput, not toISOString().slice(0,10) — the latter writes
         the UTC date, which is yesterday for anyone west of UTC and,
         late in the evening, for Karachi too. */
      due_date: toDateInput(nextDue),
      status: 'pending',
      assigned_to: task.assigned_to,
      recurrence_days: task.recurrence_days,
      /* A repeat inherits how the original was set up, not the
         defaults — otherwise every recurrence of an urgent weekly
         check quietly becomes normal priority. */
      priority: task.priority,
      estimate_minutes: task.estimate_minutes,
    })
    .select()
    .single();
  return (data as Task) ?? null;
}
