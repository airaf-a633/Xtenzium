import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { renderSummary, type SummaryData } from '../../../lib/daily-summary';
import { Badge, Button, Card, CardHeader, ErrorState, PageHeader, SegmentedControl, Skeleton, useToast } from '../../../components/crm/ui';

type Period = '24' | '72' | '168';

interface SendResult {
  sent: boolean;
  reason?: string;
  to?: string[];
  error?: string;
}

const REASON: Record<string, string> = {
  not_configured: 'Email sending isn’t set up yet. Add RESEND_API_KEY and SUMMARY_FROM in Vercel (steps below), then try again.',
  no_recipients: 'There is nobody to send it to — no active admin has an email address, and SUMMARY_TO isn’t set.',
  dry_run: 'Preview only.',
};

/* What the morning email says, on a page — so you can see it, copy it,
   and test the email setup with one click before trusting the cron. */
const Summary = () => {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>('24');
  const [data, setData] = useState<SummaryData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - Number(period) * 3_600_000);
    supabase.rpc('dialer_summary', { p_from: from.toISOString(), p_to: to.toISOString() }).then(({ data: d, error }) => {
      if (cancelled) return;
      if (error) setFailed(error.message.includes('does not exist') ? 'Run migration 025 first.' : error.message);
      else {
        setFailed(null);
        setData(d as SummaryData);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const rendered = data ? renderSummary(data, { crmUrl: `${window.location.origin}/crm` }) : null;

  const copy = async () => {
    if (!rendered) return;
    try {
      await navigator.clipboard.writeText(`${rendered.subject}\n\n${rendered.text}`);
      toast('Summary copied', 'success');
    } catch {
      toast('Couldn’t copy.', 'danger');
    }
  };

  const sendNow = async () => {
    setSending(true);
    setResult(null);
    const { data: session } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/daily-summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session?.access_token ?? ''}` },
        body: JSON.stringify({ hours: Number(period) }),
      });
      const out = (await res.json().catch(() => ({}))) as SendResult;
      setResult(res.ok ? out : { sent: false, error: out.error ?? `Request failed (${res.status})` });
    } catch {
      setResult({ sent: false, error: 'Couldn’t reach the server.' });
    }
    setSending(false);
  };

  return (
    <div className="flex max-w-[820px] flex-col gap-4">
      <PageHeader title="Daily summary" subtitle="What the rep did, and what’s waiting on you. The same text goes out by email each morning." />

      <SegmentedControl
        label="Period"
        value={period}
        onChange={v => {
          setLoading(true);
          setPeriod(v);
        }}
        options={[
          { value: '24', label: 'Last 24 hours' },
          { value: '72', label: '3 days' },
          { value: '168', label: '7 days' },
        ]}
      />

      {failed && <ErrorState title="The summary couldn’t load" body={failed} />}
      {loading && <Skeleton className="h-[260px] w-full" />}

      {!loading && rendered && (
        <Card>
          <CardHeader title={rendered.subject} />
          <pre className="m-0 whitespace-pre-wrap p-4 font-[inherit] text-[13.5px] leading-relaxed text-crm-ink-2">{rendered.text}</pre>
          <div className="flex flex-wrap items-center gap-2 border-t border-crm-line p-4">
            <Button onClick={copy}>Copy text</Button>
            <Button variant="primary" loading={sending} onClick={sendNow}>Email it to me now</Button>
            {result && (
              result.sent ? (
                <Badge tone="success" dot>Sent to {result.to?.join(', ')}</Badge>
              ) : (
                <span className="text-[12.5px] text-crm-warning">{result.error ?? REASON[result.reason ?? ''] ?? 'Not sent.'}</span>
              )
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Setting up the morning email" />
        <div className="flex flex-col gap-2 p-4 text-[13px] leading-relaxed text-crm-ink-2">
          <p className="m-0">It’s scheduled for 03:00 UTC (08:00 in Karachi) every day. To turn it on, add these in Vercel → Settings → Environment Variables, then redeploy:</p>
          <ul className="m-0 pl-5">
            <li><code>CRON_SECRET</code> — any long random string (Vercel Cron uses it to prove a request is genuine).</li>
            <li><code>RESEND_API_KEY</code> — from resend.com; the free tier is plenty for one email a day.</li>
            <li><code>SUMMARY_FROM</code> — a sender Resend has verified, e.g. <code>Xtenzium &lt;summary@xtenzium.com&gt;</code>.</li>
            <li><code>SUMMARY_TO</code> — optional, comma-separated. Leave it out to send to every admin.</li>
          </ul>
          <p className="m-0">Until then, “Email it to me now” shows you exactly what would be sent and nothing leaves the CRM.</p>
        </div>
      </Card>
    </div>
  );
};

export default Summary;
