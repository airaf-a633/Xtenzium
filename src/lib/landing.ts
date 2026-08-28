/* Where each person lands when they open the CRM.

   Kept out of the Settings page because the layout needs it too, and a
   shell importing a constant from a page is backwards — the page owns
   the form, not the vocabulary. */

export type LandingView = 'dashboard' | 'my_work' | 'pipeline' | 'tasks';

export const LANDING_PATH: Record<LandingView, string> = {
  dashboard: '/crm',
  my_work: '/crm/my-work',
  pipeline: '/crm/pipeline',
  tasks: '/crm/tasks',
};

export const LANDING_OPTIONS: Array<{ value: LandingView; label: string }> = [
  { value: 'dashboard', label: 'Dashboard — the business at a glance' },
  { value: 'my_work', label: 'My work — what’s on me today' },
  { value: 'pipeline', label: 'Pipeline — deals first' },
  { value: 'tasks', label: 'Tasks — the board' },
];
