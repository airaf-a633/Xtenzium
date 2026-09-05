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

export type NotificationType = 'mention' | 'assignment' | 'deal_stage' | 'deal_owner' | 'comment';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  /* No foreign key on purpose — a notification about a deleted task is
     still a true record of what happened. */
  entity_type: 'task' | 'deal' | 'project';
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

      /* Search Console, from 015. Copied in daily by web/api/gsc-sync.ts,
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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
