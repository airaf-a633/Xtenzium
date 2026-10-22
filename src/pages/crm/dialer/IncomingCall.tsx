import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import { formatPhone } from '../../../lib/dialer-calls';
import { domainOf, isPlatformDomain, normalizePhone } from '../../../lib/dialer-import';
import { Badge, Button, Card, CardHeader, Input, useToast } from '../../../components/crm/ui';

/* Somebody rings back while the rep is on call 15 of the day — a missed
   call, a voicemail returned, or a lead that was never in the list. This
   finds them if we know them (so the call is logged against their history)
   and adds them if we don't, without losing the lead on screen. */
type Typed = { name: string; title: string; email: string };

const IncomingCall = ({
  onPick, confirmSwitch, onClose,
}: {
  onPick: (lead: CallLead, opts?: { confirmed?: boolean; typed?: Typed }) => void;
  confirmSwitch: () => boolean;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [hits, setHits] = useState<CallLead[] | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = normalizePhone(phone, false);
  const digits = phone.replace(/\D/g, '');
  const companyTerm = company.trim().replace(/[%,()*"\\]/g, ' ').trim();

  useEffect(() => {
    const byPhone = digits.length >= 7;
    const byName = companyTerm.length >= 3;
    if (!byPhone && !byName) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      const filter = [byPhone ? `phone_e164.ilike.%${digits}%` : null, byName ? `company_name.ilike.%${companyTerm}%` : null]
        .filter(Boolean)
        .join(',');
      supabase
        .from('call_leads')
        .select('*')
        .or(filter)
        .limit(6)
        .then(({ data, error }) => {
          if (!cancelled) setHits(error ? 'error' : ((data ?? []) as CallLead[]));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [digits, companyTerm]);

  const shown = digits.length >= 7 || companyTerm.length >= 3 ? hits : null;
  const typed: Typed = { name: contact.trim(), title: title.trim(), email: email.trim() };

  const create = async () => {
    if (saving) return;
    if (!confirmSwitch()) return;
    if (!company.trim()) {
      toast('Add the company name.', 'danger');
      return;
    }
    if (phone.trim() && !parsed.e164) {
      toast('That doesn’t look like a phone number.', 'danger');
      return;
    }
    if (!parsed.e164 && !email.trim()) {
      toast('Add a phone number or an email.', 'danger');
      return;
    }
    const host = domainOf(website);
    setSaving(true);
    const { data, error } = await supabase.rpc('dialer_create_lead', {
      p_company: company.trim(),
      p_phone_raw: phone.trim() || null,
      p_e164: parsed.e164,
      p_is_us: parsed.e164 ? parsed.isUs : null,
      p_contact_name: contact.trim() || null,
      p_contact_title: title.trim() || null,
      p_email: email.trim() || null,
      p_website: website.trim() || null,
      p_domain: isPlatformDomain(host) ? null : host,
    });
    setSaving(false);
    if (error || !data?.lead) {
      toast(error?.message ?? 'Couldn’t add them.', 'danger');
      return;
    }
    if (data.existing) {
      const onFile = data.lead.phone_e164;
      toast(
        parsed.e164 && onFile && onFile !== parsed.e164
          ? `Already in the CRM as ${data.lead.company_name} (number on file: ${formatPhone(onFile, data.lead.phone_raw)}). Use “Wrong number? Edit” if this one is better.`
          : `Already in the CRM as ${data.lead.company_name} — opening their history`,
        'info',
      );
    }
    onPick(data.lead, { confirmed: true, typed });
  };

  return (
    <Card>
      <CardHeader title="Incoming call · who's calling?" action={<Button variant="ghost" onClick={onClose}>Close</Button>} />
      <div className="flex flex-col gap-3 p-4">
        <p className="m-0 text-[13px] text-crm-ink-3">
          Type their number or company. If they're already in the list you'll get their history; if not, add them and log the call as usual.
          The lead you were on stays in your queue.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Phone number" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(212) 555-0123" autoFocus />
          <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} />
        </div>

        {shown === 'error' && (
          <p className="m-0 text-[13px] text-crm-danger">The search failed (connection?). Don’t add them yet — try again, or they may already be in the list.</p>
        )}
        {Array.isArray(shown) && (
          <ul className="m-0 list-none divide-y divide-crm-line rounded-crm-md border border-crm-line p-0">
            {shown.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-crm-ink-3">No match — add them below.</li>
            ) : (
              shown.map(l => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]">
                  <strong className="text-crm-ink">{l.company_name}</strong>
                  <span className="font-crm-mono text-crm-ink-2">{formatPhone(l.phone_e164, l.phone_raw)}</span>
                  <Badge tone="neutral">{l.status}</Badge>
                  {l.status !== 'dnc' && (
                    <Button variant="ghost" className="ml-auto" onClick={() => { if (confirmSwitch()) onPick(l, { confirmed: true, typed }); }}>Work this lead</Button>
                  )}
                </li>
              ))
            )}
          </ul>
        )}

        <details className="rounded-crm-md border border-crm-line px-3 py-2" open={Array.isArray(shown) && shown.length === 0}>
          <summary className="cursor-pointer text-[13px] text-crm-ink">Not in the list? Add them</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input label="Contact name" value={contact} onChange={e => setContact(e.target.value)} />
            <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Website" value={website} onChange={e => setWebsite(e.target.value)} />
          </div>
          <div className="mt-3">
            <Button variant="primary" onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add and work this lead'}</Button>
          </div>
        </details>
      </div>
    </Card>
  );
};

export default IncomingCall;
