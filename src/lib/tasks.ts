import { supabase } from './supabase';
import type { Task } from '../types/database';

export async function spawnNextRecurrence(task: Task): Promise<Task | null> {
  if (!task.recurrence_days) return null;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + task.recurrence_days);
  const { data } = await supabase.from('tasks').insert({
    project_id: task.project_id,
    title: task.title,
    due_date: nextDue.toISOString().slice(0, 10),
    status: 'pending',
    assigned_to: task.assigned_to,
    recurrence_days: task.recurrence_days,
  }).select().single();
  return (data as Task) ?? null;
}
