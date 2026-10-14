import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { CrmThemeProvider } from '../../../components/crm/CrmThemeProvider';
import ClockWarning from '../../../components/crm/ClockWarning';
import { ToastProvider, Avatar, Button, Mark } from '../../../components/crm/ui';

/* The caller's whole world: a header and a workspace. No sidebar, no
   command palette, no notification bell — those read tables a caller
   has no access to, and a shell that 403s on load is worse than no
   shell. Admins can open /crm/dialer too (to see what the rep sees),
   and get a way back. */
const Shell = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.full_name ?? user?.email?.split('@')[0] ?? 'You';

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate('/crm/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-crm-ground text-crm-ink">
      <header className="flex items-center gap-3 border-b border-crm-line bg-crm-surface px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-crm-sm bg-crm-copper text-crm-copper-ink">
          <Mark className="h-[18px] w-[18px]" />
        </span>
        <span className="font-crm-display text-[13.5px] font-bold tracking-[-0.01em]">
          Xtenzium <span className="font-normal text-crm-ink-3">· Dialer</span>
        </span>
        <span className="ml-auto flex items-center gap-3">
          {role === 'admin' && (
            <Button size="sm" onClick={() => navigate('/crm')}>
              Back to CRM
            </Button>
          )}
          <Avatar name={name} size="sm" />
          <span className="hidden text-[13px] text-crm-ink-2 sm:inline">{name}</span>
          <Button size="sm" loading={signingOut} onClick={handleSignOut}>
            Sign out
          </Button>
        </span>
      </header>
      <ClockWarning />
      <main className="mx-auto max-w-[960px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

const CallerLayout = () => (
  <CrmThemeProvider>
    <ToastProvider>
      <Shell />
    </ToastProvider>
  </CrmThemeProvider>
);

export default CallerLayout;
