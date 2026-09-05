import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCrmTheme } from './CrmThemeProvider';
import CommandPalette, { type PaletteData } from './CommandPalette';
import ShortcutsDialog from './ShortcutsDialog';
import type { Client, Deal, Project, Task, TaskStatusRow, TeamMember } from '../../types/database';

const EMPTY: PaletteData = { tasks: [], deals: [], projects: [], clients: [], members: [], statuses: [] };

interface CommandApi {
  openPalette: () => void;
  openShortcuts: () => void;
}

const CommandContext = createContext<CommandApi | null>(null);

/* Typing in a field should never trigger a shortcut. Checked by
   element rather than by tracking focus ourselves, so it stays correct
   for anything mounted later. */
const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
};

/* `g` then a letter, the way Linear and GitHub do it. A chord rather
   than a modifier because the CRM's single letters are cheap and the
   pause between the two keys is what makes it feel deliberate. */
const GOTO: Record<string, string> = {
  d: '/crm',
  p: '/crm/pipeline',
  c: '/crm/clients',
  r: '/crm/projects',
  t: '/crm/tasks',
  m: '/crm/team',
};

export const CommandProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleTheme } = useCrmTheme();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [data, setData] = useState<PaletteData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const gPressed = useRef(false);
  const gTimer = useRef<number | null>(null);

  /* Loaded on first open, not on mount: most sessions never touch the
     palette, and the CRM shell shouldn't pay for it. */
  const load = useCallback(async () => {
    setLoading(true);
    const [tasks, deals, projects, clients, members, statuses] = await Promise.all([
      supabase.from('tasks').select('*').limit(500),
      supabase.from('deals').select('*').limit(500),
      supabase.from('projects').select('*').limit(500),
      supabase.from('clients').select('*').limit(500),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('task_statuses').select('*').order('position'),
    ]);
    setData({
      tasks: (tasks.data ?? []) as Task[],
      deals: (deals.data ?? []) as Deal[],
      projects: (projects.data ?? []) as Project[],
      clients: (clients.data ?? []) as Client[],
      members: (members.data ?? []) as TeamMember[],
      statuses: (statuses.data ?? []) as TaskStatusRow[],
    });
    setLoading(false);
    loadedRef.current = true;
  }, []);

  const openPalette = useCallback(() => {
    setPaletteOpen(true);
    if (!loadedRef.current) load();
  }, [load]);

  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  const me = useMemo(
    () => data.members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [data.members, user],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      /* Cmd/Ctrl+K works everywhere, including inside a field — it's
         the one shortcut that has to be unconditional. */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => {
          if (!o && !loadedRef.current) load();
          return !o;
        });
        return;
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      /* Second half of a `g` chord. */
      if (gPressed.current) {
        const target = GOTO[e.key.toLowerCase()];
        gPressed.current = false;
        if (gTimer.current) window.clearTimeout(gTimer.current);
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }

      if (e.key === 'g') {
        gPressed.current = true;
        /* The chord expires, so a stray `g` doesn't swallow the next
           keystroke a minute later. */
        gTimer.current = window.setTimeout(() => {
          gPressed.current = false;
        }, 1200);
        return;
      }

      if (e.key === '/' || e.key === 'c') {
        e.preventDefault();
        openPalette();
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gTimer.current) window.clearTimeout(gTimer.current);
    };
  }, [navigate, openPalette, load]);

  const api = useMemo(() => ({ openPalette, openShortcuts }), [openPalette, openShortcuts]);

  return (
    <CommandContext.Provider value={api}>
      {children}
      {/* Mounted only while open, so opening it IS the reset — no
          effect required to clear last time's query and screen. */}
      {paletteOpen && (
      <CommandPalette
        onClose={() => setPaletteOpen(false)}
        data={data}
        loading={loading}
        me={me}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onToggleTheme={toggleTheme}
        onDataChanged={load}
      />
      )}
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </CommandContext.Provider>
  );
};

export const useCommands = (): CommandApi => {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error('useCommands must be used inside a CommandProvider');
  return ctx;
};
