export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type BlogStatus = 'draft' | 'published';

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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
