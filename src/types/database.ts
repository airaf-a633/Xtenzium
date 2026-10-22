export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type BlogStatus = 'draft' | 'published';
export type ProjectStatus = 'proposal' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ActivityType = 'note' | 'call' | 'meeting' | 'email' | 'status_change';
/* Kept as-is: the pending/done column still exists and is still the
   source of truth for every query written before migration 007. */
export type TaskStatus = 'pending' | 'done';
export type TaskStatusKind = 'open' | 'active' | 'done';
/* 1 = Urgent … 4 = Low. Numeric so ORDER BY is already correct. */
export type TaskPriority = 1 | 2 | 3 | 4;
export type DealStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
export type DealSource = 'contact' | 'estimate' | 'referral' | 'outbound' | 'repeat' | 'manual';
export type DealActivityType = 'note' | 'call' | 'meeting' | 'email' | 'stage_change' | 'created';

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: Record<string, unknown>;
  cover_image: string | null;
  category: string | null;
  tags: string[];
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  total_value: number;
  amount_paid: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  project_id: string;
  type: ActivityType;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  recurrence_days: number | null;
  /* ── Added in 007 ── */
  priority: TaskPriority;
  status_id: string | null;
  parent_task_id: string | null;
  rank: number;
  estimate_minutes: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStatusRow {
  id: string;
  key: string;
  label: string;
  kind: TaskStatusKind;
  tone: string;
  position: number;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface TaskDependency {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface TaskTimeEntry {
  id: string;
  task_id: string;
  member_id: string | null;
  minutes: number;
  spent_on: string;
  note: string | null;
  created_at: string;
}

export interface TaskActiveTimer {
  member_id: string;
  task_id: string;
  started_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  designation: string | null;
  /* Nullable on purpose: a team member can exist before they have a
     login, and every row that predates migration 006 has none. */
  user_id: string | null;
  created_at: string;
}

export type UserRole = 'admin' | 'caller';

/* One row per login. `role` decides what the database lets them touch —
   see migration 016. A login with no profile row has no access at all. */
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  timezone: string;
  daily_dial_target: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/* ─── Dialer (migration 017) ─────────────────────────────── */

export type CallLeadStatus =
  | 'new' | 'retry' | 'callback' | 'followup' | 'meeting' | 'nurture' | 'lost'
  | 'disqualified' | 'bad_data' | 'dnc' | 'exhausted' | 'no_phone';

export interface CallList {
  id: string;
  name: string;
  source_filename: string | null;
  row_count: number;
  skipped_count: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface CallLead {
  id: string;
  list_id: string;
  company_name: string;
  phone_raw: string | null;
  phone_e164: string | null;
  phone_is_us: boolean | null;
  email: string | null;
  website: string | null;
  domain: string | null;
  contact_url: string | null;
  profile_url: string | null;
  hq: string | null;
  state: string | null;
  timezone: string | null;
  team_size: string | null;
  hourly_rate_usd: number | null;
  services: string | null;
  works_count: number | null;
  tier: 'A' | 'B' | 'C' | 'D' | null;
  /* Which kind of company this is (migration 028). */
  segment: 'agency' | 'dev_shop' | null;
  score: number | null;
  why: string | null;
  source: string | null;
  extra: Record<string, string>;
  contact_name: string | null;
  contact_title: string | null;
  status: CallLeadStatus;
  attempt_count: number;
  last_called_at: string | null;
  next_call_at: string | null;
  assigned_to: string | null;
  deal_id: string | null;
  /* Email outreach (migration 024), independent of the call status. */
  outreach_touches: number;
  outreach_due: string | null;
  outreach_last_at: string | null;
  /* Skip snoozes a lead until the rep’s next morning (migration 026). */
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachActivity {
  id: string;
  lead_id: string;
  actor_id: string | null;
  action:
    | 'emailed' | 'followed_up' | 'form_sent' | 'email_found'
    | 'replied' | 'not_interested' | 'bad_contact' | 'opted_out' | 'note';
  note: string | null;
  touch: number | null;
  created_at: string;
}

export interface CallActivity {
  id: string;
  lead_id: string;
  caller_id: string | null;
  outcome: string;
  reason_tags: string[];
  note: string | null;
  flagged: boolean;
  flag_resolved_at: string | null;
  flag_resolved_by: string | null;
  created_at: string;
}

export interface DncEntry {
  id: string;
  phone_e164: string | null;
  domain: string | null;
  reason: string | null;
  added_by: string | null;
  added_at: string;
}

export interface FollowupItem {
  id: string;
  lead_id: string;
  type: 'email_info' | 'email_proposal' | 'linkedin' | 'admin_call';
  note: string | null;
  status: 'queued' | 'sent' | 'done' | 'cancelled';
  requested_by: string | null;
  /* The team member who has taken this on (a @mention or an admin sets it). */
  assignee_id: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface EmailTemplate {
  type: FollowupItem['type'] | 'outreach_first' | 'outreach_followup';
  subject: string;
  body: string;
  updated_by: string | null;
  updated_at: string;
}

export interface CallScript {
  id: string;
  title: string;
  body: string;
  /* null = shown for every segment. */
  segment: 'agency' | 'dev_shop' | null;
  sort_order: number;
  updated_at: string;
}

export interface DialerSettings {
  id: boolean;
  no_answer_days: number;
  voicemail_days: number;
  gatekeeper_name_days: number;
  gatekeeper_blocked_days: number;
  nurture_outsources_days: number;
  nurture_timing_days: number;
  max_attempts: number;
  /* One due retry for every N dials (0 = fresh leads always first). */
  retry_every: number;
  /* After this many missed calls, email opens as a second channel (0 = never). */
  email_after_attempts: number;
  /* When the owner takes meetings — hours in meeting_owner_tz, may wrap midnight. */
  meeting_owner_tz: string;
  meeting_hours_from: number;
  meeting_hours_to: number;
  meeting_default_minutes: number;
  /* The Google Voice number prospects see, as +1XXXXXXXXXX (migration 029). */
  caller_id_number: string | null;
  updated_at: string;
}

export interface Meeting {
  id: string;
  lead_id: string;
  deal_id: string | null;
  google_event_id: string | null;
  meet_link: string | null;
  calendar_link: string | null;
  starts_at: string;
  ends_at: string;
  attendee_name: string | null;
  attendee_email: string | null;
  rep_id: string | null;
  rep_email: string | null;
  status: 'scheduled' | 'held' | 'no_show' | 'cancelled';
  created_at: string;
}

export interface GoogleStatus {
  connected: boolean;
  email?: string;
  status?: 'ok' | 'error';
  error?: string | null;
  connected_at?: string;
}

export interface DialerListSummary {
  id: string;
  name: string;
  created_at: string;
  /** Leads that could still be dialled (US number, not closed out). */
  in_play: number;
  /** Of those, how many the queue would offer this minute. */
  callable_now: number;
  /** Tier D leads: kept, never dialled unless asked for. */
  parked: number;
}

export interface DialerReport {
  totals: { dials: number; conversations: number; interested: number; meetings: number };
  by_day: { day: string; dials: number; conversations: number; meetings: number }[];
  by_outcome: { outcome: string; n: number }[];
  by_tier: { tier: string; dials: number; conversations: number; meetings: number }[];
  by_list: { list: string; dials: number; conversations: number; meetings: number }[];
  by_hour: { hour: number; dials: number; conversations: number }[];
  funnel: { leads_called: number; conversations: number; interested: number; meetings: number; deals: number; won: number };
}

export interface Deal {
  id: string;
  title: string;
  lead_id: string | null;
  client_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  stage: DealStage;
  value: number;
  currency: string;
  probability: number;
  expected_close: string | null;
  owner_id: string | null;
  source: DealSource;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  project_id: string | null;
  rank: number;
  stage_changed_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  type: DealActivityType;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface UserPreference {
  member_id: string;
  landing_view: 'dashboard' | 'my_work' | 'pipeline' | 'tasks';
  theme: 'dark' | 'light';
  updated_at: string;
}

export type NotificationType = 'mention' | 'assignment' | 'deal_stage' | 'deal_owner' | 'comment' | 'followup';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  /* No foreign key on purpose — a notification about a deleted task is
     still a true record of what happened. */
  entity_type: 'task' | 'deal' | 'project' | 'lead';
  entity_id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export type ViewEntity = 'tasks' | 'deals' | 'projects' | 'clients';

export interface SavedView {
  id: string;
  name: string;
  entity: ViewEntity;
  /* Shape is validated client-side by configToView — the column is
     jsonb precisely so a new filter field doesn't need a migration. */
  config: unknown;
  owner_id: string | null;
  shared: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export type TestimonialPlacement = 'any' | 'home' | 'work' | 'estimate';

export interface Testimonial {
  id: string;
  quote: string;
  /* All three optional: the useful middle ground exists, where a client
     will let their words be used but not their name. */
  author_name: string | null;
  author_role: string | null;
  company: string | null;
  project: string | null;
  placement: TestimonialPlacement;
  status: 'draft' | 'published';
  /* Not a workflow state — a permission. See 014_testimonials.sql. */
  consent: boolean;
  consent_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: Lead & Record<string, unknown>;
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'notes'> & {
          id?: string;
          status?: LeadStatus;
          notes?: string | null;
          updated_at?: string;
        };
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>;
        Relationships: [];
      };
      blogs: {
        Row: Blog & Record<string, unknown>;
        Insert: Omit<Blog, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          status?: BlogStatus;
          tags?: string[];
          updated_at?: string;
        };
        Update: Partial<Omit<Blog, 'id' | 'created_at'>>;
        Relationships: [];
      };
      clients: {
        Row: Client & Record<string, unknown>;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'lead_id'> & {
          id?: string;
          updated_at?: string;
          lead_id?: string | null;
        };
        Update: Partial<Omit<Client, 'id' | 'created_at'>>;
        Relationships: [];
      };
      projects: {
        Row: Project & Record<string, unknown>;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Project, 'id' | 'created_at'>>;
        Relationships: [];
      };
      activities: {
        Row: Activity & Record<string, unknown>;
        Insert: Omit<Activity, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Activity, 'id' | 'created_at'>>;
        Relationships: [];
      };
      tasks: {
        Row: Task & Record<string, unknown>;
        Insert: Omit<
          Task,
          | 'id' | 'created_at' | 'updated_at' | 'description' | 'recurrence_days'
          | 'priority' | 'status_id' | 'parent_task_id' | 'rank'
          | 'estimate_minutes' | 'started_at' | 'completed_at'
          | 'project_id' | 'due_date' | 'assigned_to'
        > & {
          id?: string;
          updated_at?: string;
          description?: string | null;
          recurrence_days?: number | null;
          project_id?: string | null;
          due_date?: string | null;
          assigned_to?: string | null;
          priority?: TaskPriority;
          status_id?: string | null;
          parent_task_id?: string | null;
          rank?: number;
          estimate_minutes?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
        Relationships: [];
      };
      deals: {
        Row: Deal & Record<string, unknown>;
        Insert: Partial<Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'title'>> & {
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Deal, 'id' | 'created_at'>>;
        Relationships: [];
      };
      deal_activities: {
        Row: DealActivity & Record<string, unknown>;
        Insert: Omit<DealActivity, 'id' | 'created_at' | 'created_by' | 'type'> & {
          id?: string;
          type?: DealActivityType;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<DealActivity, 'id' | 'created_at'>>;
        Relationships: [];
      };
      task_statuses: {
        Row: TaskStatusRow & Record<string, unknown>;
        Insert: Partial<TaskStatusRow> & { key: string; label: string; kind: TaskStatusKind };
        Update: Partial<TaskStatusRow>;
        Relationships: [];
      };
      task_checklist_items: {
        Row: TaskChecklistItem & Record<string, unknown>;
        Insert: Partial<Omit<TaskChecklistItem, 'task_id' | 'label'>> & { task_id: string; label: string };
        Update: Partial<TaskChecklistItem>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskComment & Record<string, unknown>;
        Insert: Partial<Omit<TaskComment, 'task_id' | 'body'>> & { task_id: string; body: string };
        Update: Partial<TaskComment>;
        Relationships: [];
      };
      task_attachments: {
        Row: TaskAttachment & Record<string, unknown>;
        Insert: Partial<Omit<TaskAttachment, 'task_id' | 'storage_path' | 'file_name'>> & {
          task_id: string;
          storage_path: string;
          file_name: string;
        };
        Update: Partial<TaskAttachment>;
        Relationships: [];
      };
      task_dependencies: {
        Row: TaskDependency & Record<string, unknown>;
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: Partial<TaskDependency>;
        Relationships: [];
      };
      task_time_entries: {
        Row: TaskTimeEntry & Record<string, unknown>;
        Insert: Partial<Omit<TaskTimeEntry, 'task_id' | 'minutes'>> & { task_id: string; minutes: number };
        Update: Partial<TaskTimeEntry>;
        Relationships: [];
      };
      task_active_timers: {
        Row: TaskActiveTimer & Record<string, unknown>;
        Insert: { member_id: string; task_id: string; started_at?: string };
        Update: Partial<TaskActiveTimer>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMember & Record<string, unknown>;
        Insert: Omit<TeamMember, 'id' | 'created_at' | 'designation' | 'user_id'> & {
          id?: string;
          created_at?: string;
          designation?: string | null;
          user_id?: string | null;
        };
        Update: Partial<Omit<TeamMember, 'id' | 'created_at'>>;
        Relationships: [];
      };
      call_lists: {
        Row: CallList & Record<string, unknown>;
        Insert: Pick<CallList, 'name'> & Partial<Omit<CallList, 'id' | 'created_at'>>;
        Update: Partial<Pick<CallList, 'name' | 'row_count' | 'skipped_count'>>;
        Relationships: [];
      };
      call_leads: {
        Row: CallLead & Record<string, unknown>;
        /* Bulk inserts go through import_call_leads(); single inserts are admin-only. */
        Insert: Pick<CallLead, 'list_id' | 'company_name'> & Partial<Omit<CallLead, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<CallLead, 'id' | 'list_id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      call_activities: {
        Row: CallActivity & Record<string, unknown>;
        Insert: Pick<CallActivity, 'lead_id' | 'outcome'> & Partial<Omit<CallActivity, 'id' | 'created_at'>>;
        /* Only the owner resolving a flag ever updates a row. */
        Update: Partial<Pick<CallActivity, 'flag_resolved_at' | 'flag_resolved_by'>>;
        Relationships: [];
      };
      outreach_activities: {
        Row: OutreachActivity & Record<string, unknown>;
        /* Written only by log_outreach(); there is no client insert. */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplate & Record<string, unknown>;
        Insert: Pick<EmailTemplate, 'type'> & Partial<Pick<EmailTemplate, 'subject' | 'body'>>;
        Update: Partial<Pick<EmailTemplate, 'subject' | 'body'>>;
        Relationships: [];
      };
      call_scripts: {
        Row: CallScript & Record<string, unknown>;
        Insert: Pick<CallScript, 'title'> & Partial<Pick<CallScript, 'body' | 'sort_order' | 'segment'>>;
        Update: Partial<Pick<CallScript, 'title' | 'body' | 'sort_order' | 'segment'>>;
        Relationships: [];
      };
      dialer_settings: {
        Row: DialerSettings & Record<string, unknown>;
        Insert: never;
        Update: Partial<Omit<DialerSettings, 'id' | 'updated_at'>>;
        Relationships: [];
      };
      meetings: {
        Row: Meeting & Record<string, unknown>;
        /* Rows are written by /api/google with the service key; admins may edit. */
        Insert: never;
        Update: Partial<Pick<Meeting, 'status'>>;
        Relationships: [];
      };
      dnc_list: {
        Row: DncEntry & Record<string, unknown>;
        Insert: Partial<Omit<DncEntry, 'id' | 'added_at'>>;
        Update: never;
        Relationships: [];
      };
      followup_queue: {
        Row: FollowupItem & Record<string, unknown>;
        Insert: Pick<FollowupItem, 'lead_id' | 'type'> & Partial<Omit<FollowupItem, 'id' | 'created_at'>>;
        Update: Partial<Pick<FollowupItem, 'status' | 'handled_by' | 'handled_at' | 'note' | 'assignee_id'>>;
        Relationships: [];
      };
      profiles: {
        Row: Profile & Record<string, unknown>;
        /* Inserts come from the auth.users trigger or the service-role
           API; the browser only ever updates. */
        Insert: never;
        Update: Partial<Pick<Profile, 'full_name' | 'role' | 'timezone' | 'daily_dial_target' | 'active'>>;
        Relationships: [];
      };
      notifications: {
        Row: Notification & Record<string, unknown>;
        /* Insert is never used from the client — rows come only from
           SECURITY DEFINER triggers, and there is no INSERT policy. */
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreference & Record<string, unknown>;
        Insert: Partial<UserPreference> & { member_id: string };
        Update: Partial<UserPreference>;
        Relationships: [];
      };
      saved_views: {
        Row: SavedView & Record<string, unknown>;
        Insert: Partial<Omit<SavedView, 'name' | 'entity'>> & { name: string; entity: ViewEntity };
        Update: Partial<Omit<SavedView, 'id' | 'created_at'>>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSetting & Record<string, unknown>;
        Insert: Omit<AppSetting, 'updated_at'> & { updated_at?: string };
        Update: Partial<AppSetting>;
        Relationships: [];
      };

      /* Client testimonials, from 014.
         `status` and `consent` are separate on purpose: status is whether
         we are ready to show a quote, consent is whether we are allowed
         to. The RLS policy requires both, so the site cannot serve one
         that has not been agreed to. */
      testimonials: {
        Row: Testimonial & Record<string, unknown>;
        Insert: Omit<Testimonial, 'id' | 'created_at' | 'updated_at' | 'published_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: Partial<Omit<Testimonial, 'id'>>;
        Relationships: [];
      };

      /* Search Console rows, from 015. Written by the daily sync with the
         service role, which is why there is no anon insert policy. */
      search_queries: {
        Row: {
          day: string;
          query: string;
          page: string;
          clicks: number;
          impressions: number;
          position: number | null;
          fetched_at: string;
        } & Record<string, unknown>;
        Insert: {
          day: string;
          query: string;
          page: string;
          clicks?: number;
          impressions?: number;
          position?: number | null;
          fetched_at?: string;
        };
        Update: Partial<{
          clicks: number;
          impressions: number;
          position: number | null;
          fetched_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      /* Aggregates from 007. Read-only, so only Row is meaningful. */
      task_time_totals: {
        Row: { task_id: string; logged_minutes: number } & Record<string, unknown>;
        Relationships: [];
      };
      project_time_totals: {
        Row: {
          project_id: string;
          logged_minutes: number | null;
          estimated_minutes: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };

      /* Site analytics, from 011. Aggregated in SQL rather than in the
         page: `page_events` grows per interaction rather than per record,
         so counting it in the browser would move megabytes to produce
         five numbers. */
      analytics_daily: {
        Row: {
          day: string;
          pageviews: number;
          visitors: number;
          form_submits: number;
          estimates_completed: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_pages: {
        Row: {
          path: string;
          pageviews: number;
          visitors: number;
          avg_scroll_percent: number | null;
          form_submits: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_attribution: {
        Row: {
          referring_host: string | null;
          landing_path: string;
          sessions: number;
          leads: number;
          conversion_percent: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };

      /* Dimensions, from 013. Every one carries `day` so the dashboard's
         date range applies to all of them — `analytics_pages` above did
         not, and the range silently governed half the screen. */
      analytics_session_facts: {
        Row: {
          visitor: string;
          day: string;
          dow: number;
          hour: number;
          seconds: number;
          landing_path: string | null;
          referring_host: string | null;
          device: string | null;
          country: string | null;
          city: string | null;
          browser: string | null;
          os: string | null;
          pageviews: number;
          max_scroll: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_when: {
        Row: {
          day: string;
          dow: number;
          hour: number;
          sessions: number;
          pageviews: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_referrers: {
        Row: {
          day: string;
          referring_host: string | null;
          sessions: number;
          pageviews: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_devices: {
        Row: {
          day: string;
          device: string | null;
          browser: string | null;
          os: string | null;
          sessions: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_geo: {
        Row: {
          day: string;
          country: string | null;
          city: string | null;
          sessions: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_quality: {
        Row: {
          day: string;
          sessions: number;
          bounced: number;
          avg_pageviews: number | null;
          avg_seconds: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_outbound: {
        Row: {
          day: string;
          host: string | null;
          clicks: number;
        } & Record<string, unknown>;
        Relationships: [];
      };
      analytics_realtime: {
        Row: {
          path: string;
          visitors: number;
          last_seen: string;
        } & Record<string, unknown>;
        Relationships: [];
      };

      /* Search Console, from 015. Copied in daily by api/gsc-sync.ts,
         because the query someone typed is not in the referrer and has
         not been for a decade. */
      search_console_queries: {
        Row: {
          day: string;
          query: string;
          clicks: number;
          impressions: number;
          position: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };
      search_console_pages: {
        Row: {
          day: string;
          page: string;
          clicks: number;
          impressions: number;
          position: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };
      search_console_daily: {
        Row: {
          day: string;
          clicks: number;
          impressions: number;
          queries: number;
          ctr_percent: number | null;
          position: number | null;
        } & Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      dialer_known_keys: {
        Args: Record<string, never>;
        Returns: { phones: string[]; domains: string[]; dnc_phones: string[]; dnc_domains: string[]; companies: { n: string; s: string | null }[] };
      };
      google_status: {
        Args: Record<string, never>;
        Returns: GoogleStatus;
      };
      google_disconnect: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      meeting_set_status: {
        Args: { p_meeting_id: string; p_status: 'held' | 'no_show' | 'cancelled' };
        Returns: undefined;
      };
      dialer_mentionables: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
      dialer_assign_followup: {
        Args: { p_id: string; p_member: string | null };
        Returns: undefined;
      };
      outreach_list: {
        Args: { p_tab: string; p_limit?: number; p_offset?: number; p_tiers?: string[] | null; p_search?: string | null };
        Returns: CallLead[];
      };
      outreach_counts: {
        Args: { p_tiers?: string[] | null };
        Returns: { to_email: number; find_email: number; due: number; waiting: number; after_call: number; sent_today: number };
      };
      log_outreach: {
        Args: { p_lead_id: string; p_action: string; p_note?: string | null; p_email?: string | null };
        Returns: { status: string; touches: number; next_touch_at: string | null; sequence_done: boolean };
      };
      dialer_summary: {
        Args: { p_from: string; p_to: string };
        Returns: import('../lib/daily-summary').SummaryData;
      };
      dialer_tier_counts: {
        Args: { p_list_id?: string | null };
        Returns: { A: number; B: number; C: number; none: number };
      };
      retier_leads: {
        Args: { p_list_id: string; p_from: string; p_to: string };
        Returns: number;
      };
      retier_by_score: {
        Args: { p_list_id: string; p_a: number; p_b: number };
        Returns: number;
      };
      undo_last_call: {
        Args: { p_activity_id: string };
        Returns: { lead_id: string; status: CallLeadStatus };
      };
      dialer_list_summary: {
        Args: Record<string, never>;
        Returns: DialerListSummary[];
      };
      dialer_next_lead: {
        Args: {
          p_skip?: string[];
          p_ignore_hours?: boolean;
          p_list_id?: string | null;
          /* 'A' 'B' 'C' and '-' for untiered; null = any. */
          p_tiers?: string[] | null;
          /* Pretend this many more calls were logged (pre-loading the next lead). */
          p_assume_dials?: number;
        };
        Returns: CallLead[];
      };
      log_call: {
        Args: {
          p_lead_id: string;
          p_outcome: string;
          p_tags?: string[];
          p_note?: string | null;
          p_flagged?: boolean;
          p_at?: string | null;
          p_contact_name?: string | null;
          p_contact_title?: string | null;
          p_contact_email?: string | null;
        };
        Returns: {
          status: CallLeadStatus;
          next_call_at: string | null;
          followup: string | null;
          deal_id: string | null;
          attempts: number;
          mentioned: number;
          activity_id: string;
        };
      };
      dialer_report: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: DialerReport;
      };
      dialer_board_counts: {
        Args: Record<string, never>;
        Returns: Record<string, number>;
      };
      dialer_skip_lead: {
        Args: { p_lead_id: string };
        Returns: string;
      };
      dialer_create_lead: {
        Args: {
          p_company: string; p_phone_raw: string | null; p_e164: string | null; p_is_us: boolean | null;
          p_contact_name?: string | null; p_contact_title?: string | null; p_email?: string | null;
          p_website?: string | null; p_domain?: string | null;
        };
        Returns: { lead: CallLead; existing: boolean };
      };
      dialer_report_segments: {
        Args: { p_from: string; p_to: string };
        Returns: { segment: string; dials: number; conversations: number; meetings: number }[];
      };
      dialer_fix_phone: {
        Args: { p_lead_id: string; p_raw: string; p_e164: string; p_is_us: boolean };
        Returns: string;
      };
      dialer_unskip_lead: {
        Args: { p_lead_id: string };
        Returns: undefined;
      };
      import_call_leads: {
        Args: { p_list_id: string; p_rows: unknown };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
