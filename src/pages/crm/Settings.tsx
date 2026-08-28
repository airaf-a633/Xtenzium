import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCrmTheme } from '../../components/crm/CrmThemeProvider';
import type { TeamMember } from '../../types/database';
import { LANDING_OPTIONS, type LandingView } from '../../lib/landing';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Label,
  PageHeader,
  Select,
  useToast,
} from '../../components/crm/ui';

const Settings = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useCrmTheme();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [landing, setLanding] = useState<LandingView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('team_members').select('*').order('name'),
        supabase.from('user_preferences').select('*'),
      ]);

    fetchAll().then(([m, prefs]) => {
      if (cancelled) return;
      const list = (m.data ?? []) as TeamMember[];
      setMembers(list);

      if (prefs.error) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      const mine = list.find(x => x.user_id && x.user_id === user?.id);
      const row = (prefs.data ?? []).find(
        (p: { member_id: string }) => mine && p.member_id === mine.id,
      ) as { landing_view?: LandingView } | undefined;
      if (row?.landing_view) setLanding(row.landing_view);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const me = useMemo(
    () => members.find(x => x.user_id && x.user_id === user?.id) ?? null,
    [members, user],
  );

  const save = async () => {
    if (!me) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ member_id: me.id, landing_view: landing, theme }, { onConflict: 'member_id' });
    setSaving(false);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    toast('Saved — this is where you’ll land next time', 'success');
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Yours only — nobody else sees these" />

      {unavailable && (
        <ErrorState
          title="Preferences need migration 010"
          body="Run 010_user_preferences.sql in the Supabase SQL editor. Until then the theme toggle still works, it just won’t follow you to another machine."
        />
      )}

      {!unavailable && !loading && !me && (
        <ErrorState
          title="Your account isn’t linked to a team member"
          body="Open Team and point your team member at this login. Preferences are stored per person, so there’s nowhere to keep them until then."
        />
      )}

      {!unavailable && me && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="When you open the CRM" />
            <div className="flex flex-col gap-4 p-4">
              <Select
                label="Land on"
                value={landing}
                onChange={e => setLanding(e.target.value as LandingView)}
                options={LANDING_OPTIONS}
                hint="Four people, four jobs — this is per person, not per team."
              />
              <div>
                <Button variant="primary" loading={saving} onClick={save}>
                  Save
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Appearance" />
            <div className="flex flex-col gap-4 p-4">
              <div>
                <Label className="mb-2 block">Theme</Label>
                <div className="flex items-center gap-3">
                  <Button onClick={toggleTheme}>
                    Switch to {theme === 'dark' ? 'light' : 'dark'}
                  </Button>
                  <span className="text-[12.5px] text-crm-ink-3">
                    Currently {theme}
                  </span>
                </div>
                <p className="m-0 mt-2 text-[12px] text-crm-ink-3">
                  Applies immediately and is remembered in this browser. Saving above also stores it
                  against your account, so it follows you to another machine.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;
