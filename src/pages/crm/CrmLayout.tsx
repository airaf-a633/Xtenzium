import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { CrmThemeProvider, useCrmTheme } from '../../components/crm/CrmThemeProvider';
import { ToastProvider, Avatar, IconButton, Mark, Menu } from '../../components/crm/ui';
import { CommandProvider, useCommands } from '../../components/crm/CommandProvider';
import NotificationBell from '../../components/crm/NotificationBell';
import { usePresence } from '../../components/crm/useRealtimeRows';
import { supabase } from '../../lib/supabase';
import type { TeamMember } from '../../types/database';
import { LANDING_PATH, type LandingView } from '../../lib/landing';
import { cn } from '../../lib/utils';

const icon = (path: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

const NAV_ITEMS = [
  { path: '/crm', label: 'Dashboard', exact: true, icon: icon('M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z') },
  { path: '/crm/my-work', label: 'My work', exact: false, icon: icon('M9 11.5 11.5 14 16 8.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18') },
  { path: '/crm/pipeline', label: 'Pipeline', exact: false, icon: icon('M3 6h18M6 12h12M10 18h4') },
  { path: '/crm/clients', label: 'Clients', exact: false, icon: icon('M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75') },
  { path: '/crm/projects', label: 'Projects', exact: false, icon: icon('M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z') },
  { path: '/crm/tasks', label: 'Tasks', exact: false, icon: icon('M9 11.5 11.5 14 16 8.5M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10') },
  { path: '/crm/team', label: 'Team', exact: false, icon: icon('M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5M4.5 20.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5') },
];

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
  </svg>
);

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const PaletteButton = () => {
  const { openPalette } = useCommands();
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={openPalette}
      className="flex w-full cursor-pointer items-center gap-2 rounded-crm-md border border-crm-line bg-crm-ground px-2.5 py-1.5 text-[12.5px] text-crm-ink-3 transition-colors duration-150 ease-crm hover:border-crm-line-hi hover:text-crm-ink-2"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      Search
      <kbd className="ml-auto font-crm-mono text-[10px] text-crm-faint">
        {isMac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  );
};

const Sidebar = ({
  onNavigate,
  members,
  me,
  alsoHere,
}: {
  onNavigate?: () => void;
  members: TeamMember[];
  me: TeamMember | null;
  alsoHere: string[];
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useCrmTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate('/crm/login', { replace: true });
  };

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const name = me?.name ?? user?.email?.split('@')[0] ?? 'You';
  const membersById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);

  return (
    <div className="flex h-full flex-col bg-crm-surface">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 border-b border-crm-line px-4 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-crm-sm bg-crm-copper text-crm-copper-ink">
          <Mark className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block font-crm-display text-[13.5px] font-bold leading-tight tracking-[-0.01em] text-crm-ink">
            Xtenzium
          </span>
          <span className="block font-crm-mono text-[10px] uppercase tracking-[0.14em] text-crm-ink-3">
            CRM
          </span>
        </span>
      </div>

      {/* Palette trigger — the shortcut is discoverable because the
          button spells it out. */}
      <div className="px-2 pt-2">
        <PaletteButton />
      </div>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="CRM sections">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path, item.exact);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-crm-md px-2.5 py-2 text-[13.5px] no-underline',
                'transition-colors duration-150 ease-crm',
                active
                  ? 'bg-crm-copper-quiet font-medium text-crm-copper'
                  : 'text-crm-ink-2 hover:bg-crm-raised hover:text-crm-ink',
              )}
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}

        <div className="my-2 border-t border-crm-line" />

        <NavLink
          to="/crm/settings"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-crm-md px-2.5 py-2 text-[13px] text-crm-ink-3 no-underline transition-colors duration-150 ease-crm hover:bg-crm-raised hover:text-crm-ink-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.4.64.73.83" />
          </svg>
          Settings
        </NavLink>

        <NavLink
          to="/admin/leads"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-crm-md px-2.5 py-2 text-[13px] text-crm-ink-3 no-underline transition-colors duration-150 ease-crm hover:bg-crm-raised hover:text-crm-ink-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5.5h16v13H4zM4 7l8 5.5L20 7" />
          </svg>
          Leads &amp; blog
        </NavLink>
      </nav>

      {/* Who else is looking at this page. Seeing that someone is
          already on the board prevents most collisions rather than
          resolving them afterwards. */}
      {alsoHere.length > 0 && (
        <div className="flex items-center gap-2 border-t border-crm-line px-3 py-2">
          <span className="flex -space-x-1.5">
            {alsoHere.slice(0, 3).map(n => (
              <Avatar key={n} name={n} size="xs" className="ring-2 ring-crm-surface" />
            ))}
          </span>
          <span className="truncate text-[11.5px] text-crm-ink-3">
            {alsoHere.length === 1 ? `${alsoHere[0].split(' ')[0]} is here too` : `${alsoHere.length} others here`}
          </span>
        </div>
      )}

      {/* Account */}
      <div className="flex items-center gap-2 border-t border-crm-line p-2.5">
        <Menu
          label="Account"
          align="start"
          items={[
            {
              label: signingOut ? 'Signing out…' : 'Sign out',
              disabled: signingOut,
              onSelect: handleSignOut,
              tone: 'danger',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4h4M16 16.5 20.5 12 16 7.5M20.5 12H9" />
                </svg>
              ),
            },
          ]}
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-crm-md px-1.5 py-1.5 text-left transition-colors duration-150 ease-crm hover:bg-crm-raised"
            >
              <Avatar name={name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium capitalize text-crm-ink">{name}</span>
                <span className="block truncate text-[11.5px] text-crm-ink-3">{user?.email}</span>
              </span>
            </button>
          )}
        />
        <NotificationBell me={me} membersById={membersById} />
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          size="sm"
          onClick={toggleTheme}
          icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        />
      </div>
    </div>
  );
};

const Shell = () => {
  const { theme } = useCrmTheme();
  const { user } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [alsoHere, setAlsoHere] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('team_members')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setMembers((data ?? []) as TeamMember[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const me = useMemo(
    () => members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [members, user],
  );

  /* Presence is per page: knowing someone is in the CRM somewhere is
     noise; knowing they're on the board you're about to drag a card
     around is not. */
  usePresence(location.pathname, me, setAlsoHere);

  /* Land where this person chose to land — but only once per session,
     and only from /crm itself. Redirecting every time someone clicks
     Dashboard would make the nav item unusable for anyone whose
     landing view is something else. */
  const landingApplied = useRef(false);
  const shellNavigate = useNavigate();
  useEffect(() => {
    if (landingApplied.current || !me) return;
    landingApplied.current = true;
    if (location.pathname !== '/crm') return;

    supabase
      .from('user_preferences')
      .select('landing_view')
      .eq('member_id', me.id)
      .maybeSingle()
      .then(({ data }) => {
        const view = (data as { landing_view?: string } | null)?.landing_view;
        const path = LANDING_PATH[(view ?? 'dashboard') as LandingView];
        if (path && path !== '/crm') shellNavigate(path, { replace: true });
      });
  }, [me, location.pathname, shellNavigate]);

  /* Close the mobile drawer on navigation — leaving it open over the
     page someone just asked for is the classic mobile nav bug. Done
     during render rather than in an effect: React supports adjusting
     state when a prop changes, and it avoids painting the drawer over
     the new page for one frame. Covers back/forward too, which a click
     handler alone would miss. */
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
  }

  return (
    <div className="crm-root min-h-screen" data-crm-theme={theme}>
      <Helmet>
        {/* Loaded here rather than in index.css so the marketing site
            never downloads three faces it doesn't use. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap"
        />
      </Helmet>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] border-r border-crm-line lg:block">
        <Sidebar members={members} me={me} alsoHere={alsoHere} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[248px] border-r border-crm-line shadow-crm-pop lg:hidden">
            <Sidebar onNavigate={() => setDrawerOpen(false)} members={members} me={me} alsoHere={alsoHere} />
          </aside>
        </>
      )}

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-crm-line bg-crm-surface px-3 py-2 lg:hidden">
        <IconButton label="Open navigation" icon={<MenuIcon />} onClick={() => setDrawerOpen(true)} />
        <span className="font-crm-display text-[14px] font-bold tracking-[-0.01em] text-crm-ink">Xtenzium CRM</span>
      </div>

      <main className="min-h-screen p-4 sm:p-6 lg:ml-[212px] lg:p-8">
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const CrmLayout = () => (
  <CrmThemeProvider>
    <ToastProvider>
      <CommandProvider>
        <Shell />
      </CommandProvider>
    </ToastProvider>
  </CrmThemeProvider>
);

export default CrmLayout;
