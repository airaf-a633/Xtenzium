export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type BlogStatus = 'draft' | 'published';
export type ProjectStatus = 'proposal' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ActivityType = 'note' | 'call' | 'meeting' | 'email' | 'status_change';
export type TaskStatus = 'pending' | 'done';

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
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  designation: string | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
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
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'description'> & {
          id?: string;
          updated_at?: string;
          description?: string | null;
        };
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMember & Record<string, unknown>;
        Insert: Omit<TeamMember, 'id' | 'created_at' | 'designation'> & {
          id?: string;
          created_at?: string;
          designation?: string | null;
        };
        Update: Partial<Omit<TeamMember, 'id' | 'created_at'>>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSetting & Record<string, unknown>;
        Insert: Omit<AppSetting, 'updated_at'> & { updated_at?: string };
        Update: Partial<AppSetting>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
