import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { DEFAULT_USD_TO_PKR } from '../../../lib/settings';
import type { TeamMember } from '../../../types/database';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  SkeletonRows,
  useToast,
} from '../../../components/crm/ui';

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const Team = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const [rateInput, setRateInput] = useState(String(DEFAULT_USD_TO_PKR));
  const [rateSaving, setRateSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('team_members').select('*').order('name'),
        supabase.from('app_settings').select('value').eq('key', 'usd_to_pkr').maybeSingle(),
      ]);

    fetchAll().then(([m, setting]) => {
      if (cancelled) return;
      if (m.error) {
        setFailed(m.error.message);
        setLoading(false);
        return;
      }
      setMembers((m.data ?? []) as TeamMember[]);
      if (setting.data) setRateInput((setting.data as { value: string }).value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const me = useMemo(
    () => members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [members, user],
  );

  const addMember = async () => {
    if (!name.trim()) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('team_members')
      .insert({ name: name.trim(), designation: designation.trim() || null })
      .select()
      .single();
    setAdding(false);
    if (error || !data) {
      toast('That member didn’t save.', 'danger');
      return;
    }
    setMembers(list => [...list, data as TeamMember].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    setDesignation('');
    toast(`${(data as TeamMember).name} added`, 'success');
  };

  const removeMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.name}? Tasks assigned to them become unassigned.`)) return;
    const previous = members;
    setMembers(list => list.filter(m => m.id !== member.id));
    const { error } = await supabase.from('team_members').delete().eq('id', member.id);
    if (error) {
      setMembers(previous);
      toast('Couldn’t remove that member.', 'danger');
    }
  };

  /* Claiming, rather than an admin assigning accounts.
     Listing auth users needs a service-role key, which must never reach
     the browser — so each person claims their own row instead. The
     unique index on user_id means an existing claim has to be released
     first, which is why this is two writes rather than one. */
  const claim = async (member: TeamMember) => {
    if (!user) return;
    setLinking(member.id);

    if (me && me.id !== member.id) {
      const { error: releaseError } = await supabase
        .from('team_members')
        .update({ user_id: null })
        .eq('id', me.id);
      if (releaseError) {
        setLinking(null);
        toast('Couldn’t move your link off the previous member.', 'danger');
        return;
      }
    }

    const { data, error } = await supabase
      .from('team_members')
      .update({ user_id: user.id })
      .eq('id', member.id)
      .select()
      .single();
    setLinking(null);

    if (error || !data) {
      toast(
        error?.message.includes('duplicate') || error?.code === '23505'
          ? 'Another account already claims that member.'
          : 'That link didn’t save.',
        'danger',
      );
      return;
    }

    setMembers(list =>
      list.map(m => {
        if (m.id === member.id) return data as TeamMember;
        if (m.user_id === user.id) return { ...m, user_id: null };
        return m;
      }),
    );
    toast(`You are now ${(data as TeamMember).name}`, 'success');
  };

  const release = async (member: TeamMember) => {
    setLinking(member.id);
    const { error } = await supabase
      .from('team_members')
      .update({ user_id: null })
      .eq('id', member.id);
    setLinking(null);
    if (error) {
      toast('Couldn’t unlink that member.', 'danger');
      return;
    }
    setMembers(list => list.map(m => (m.id === member.id ? { ...m, user_id: null } : m)));
    toast('Unlinked', 'info');
  };

  const saveRate = async () => {
    const value = Number(rateInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast('The rate has to be a positive number.', 'danger');
      return;
    }
    setRateSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'usd_to_pkr', value: String(value) });
    setRateSaving(false);
    if (error) {
      toast('That rate didn’t save.', 'danger');
      return;
    }
    toast('Rate saved', 'success');
  };

  return (
    <div className="max-w-[820px]">
      <PageHeader
        title="Team"
        subtitle="Who work can be assigned to, and the rate used to combine PKR and USD."
      />

      {failed && <ErrorState title="The team couldn’t load" body={failed} />}

      {!failed && (
        <div className="flex flex-col gap-5">
          {/* ── Identity ──────────────────────────────────────── */}
          <Card>
            <CardHeader title="Your account" />
            <div className="p-4">
              {me ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={me.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] font-medium text-crm-ink">{me.name}</p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-crm-ink-3">{user?.email}</p>
                  </div>
                  <Badge tone="success" dot>
                    Linked
                  </Badge>
                  <Button size="sm" onClick={() => release(me)} loading={linking === me.id}>
                    Unlink
                  </Button>
                </div>
              ) : (
                <div className="rounded-crm-md border border-crm-warning/30 bg-crm-warning-quiet px-3.5 py-3">
                  <p className="m-0 text-[13px] font-medium text-crm-warning">
                    You’re signed in as {user?.email}, but not linked to a team member
                  </p>
                  <p className="m-0 mt-1 text-[12.5px] text-crm-ink-2">
                    Pick yourself from the list below. Until you do, the CRM can’t tell which work is
                    yours — My Work stays empty, the notification bell is hidden, and comments and
                    logged time aren’t attributed to anyone.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* ── Members ───────────────────────────────────────── */}
          <Card>
            <CardHeader title="Team members" />
            <div className="p-4">
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <Input
                  className="min-w-[160px] flex-1"
                  label="Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="Sara Khan"
                />
                <Input
                  className="min-w-[160px] flex-1"
                  label="Designation"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="Electronics Lead"
                />
                <Button
                  variant="primary"
                  loading={adding}
                  disabled={!name.trim()}
                  onClick={addMember}
                >
                  Add member
                </Button>
              </div>

              {loading ? (
                <SkeletonRows rows={4} />
              ) : members.length === 0 ? (
                <EmptyState
                  className="border-0"
                  title="No team members yet"
                  body="Add everyone who work gets assigned to. You can link your own account once you’re on the list."
                />
              ) : (
                <ul className="m-0 list-none p-0">
                  {members.map(m => {
                    const isMe = me?.id === m.id;
                    const claimedByOther = Boolean(m.user_id) && !isMe;
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center gap-3 border-b border-crm-line py-2.5 last:border-b-0"
                      >
                        <Avatar name={m.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[13.5px] text-crm-ink">{m.name}</p>
                          {m.designation && (
                            <p className="m-0 mt-0.5 truncate text-[12px] text-crm-ink-3">
                              {m.designation}
                            </p>
                          )}
                        </div>

                        {isMe && (
                          <Badge tone="copper" dot>
                            You
                          </Badge>
                        )}
                        {claimedByOther && <Badge tone="neutral">Linked</Badge>}

                        {!isMe && (
                          <Button
                            size="sm"
                            loading={linking === m.id}
                            onClick={() => claim(m)}
                            title={
                              claimedByOther
                                ? 'Claim this member for your account instead'
                                : 'Link this member to your account'
                            }
                          >
                            This is me
                          </Button>
                        )}

                        <IconButton
                          label={`Remove ${m.name}`}
                          size="sm"
                          icon={<XIcon />}
                          onClick={() => removeMember(m)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* ── Exchange rate ─────────────────────────────────── */}
          <Card>
            <CardHeader title="Exchange rate" />
            <div className="p-4">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  className="w-[160px]"
                  label="1 USD equals (PKR)"
                  type="number"
                  min={1}
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                />
                <Button variant="primary" loading={rateSaving} onClick={saveRate}>
                  Save rate
                </Button>
              </div>
              <p className="m-0 mt-3 text-[12.5px] text-crm-ink-3">
                Combines PKR and USD totals into one figure on the dashboard, the pipeline forecast
                and client pages. Every converted number says so where it appears.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Team;
