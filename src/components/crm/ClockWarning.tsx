import { useSyncExternalStore } from 'react';
import { SKEW_WARN_MS, describeSkew, getHealth, subscribeHealth } from '../../lib/auth-health';

/* Shown only when the computer's clock is visibly wrong, or this browser
   has been refreshing its login unusually often. Both end in being signed
   out repeatedly, and neither is something the person can guess — so say
   what it is and how to fix it. */
const ClockWarning = () => {
  const h = useSyncExternalStore(subscribeHealth, getHealth);
  const wrong = Math.abs(h.skewMs) >= SKEW_WARN_MS;
  if (!wrong && !h.refreshStorm) return null;

  return (
    <div role="alert" className="border-b border-crm-warning/30 bg-crm-warning-quiet px-4 py-2.5 text-[13px] text-crm-ink-2">
      {wrong ? (
        <>
          <strong className="text-crm-warning">This computer’s clock is {h.skewMs > 0 ? 'ahead' : 'behind'} by {describeSkew(h.skewMs)}.</strong>{' '}
          A wrong clock or time zone can sign you out repeatedly. Fix it in Windows: <em>Settings → Time &amp; language → Date &amp; time</em>, then turn on
          “Set time automatically” and “Set time zone automatically”. Then reload this page.
        </>
      ) : (
        <>
          <strong className="text-crm-warning">This browser has been renewing its login unusually often.</strong> The CRM paused it to avoid being
          blocked. If you keep getting signed out, check the computer’s date, time and time zone, and close any duplicate CRM tabs.
        </>
      )}
    </div>
  );
};

export default ClockWarning;
