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
  content: Record<string, unknown>; // Tiptap JSON
  cover_image: string | null;
  category: string | null;
  tags: string[];
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'> & {
          status?: LeadStatus;
          notes?: string | null;
        };
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>;
      };
      blogs: {
        Row: Blog;
        Insert: Omit<Blog, 'id' | 'created_at' | 'updated_at'> & {
          status?: BlogStatus;
          tags?: string[];
        };
        Update: Partial<Omit<Blog, 'id' | 'created_at'>>;
      };
    };
  };
}
