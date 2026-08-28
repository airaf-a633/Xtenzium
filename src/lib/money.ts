/* Money formatting lived inline in five different files, each with its
   own rounding and separator rules. One implementation now, so a
   figure on the dashboard and the same figure on a board card can
   never disagree about how it's written. */

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/* Conversion lives here rather than in settings.ts because it is pure
   arithmetic. It used to sit next to getUsdToPkrRate(), which meant any
   module that wanted to add two numbers together also had to import the
   Supabase client. The rate still comes from settings; only the maths
   moved. */
export const DEFAULT_USD_TO_PKR = 280;

const isUsd = (currency: string) => currency.trim().toUpperCase() === 'USD';

export const toUsd = (amount: number, currency: string, usdToPkrRate: number): number =>
  isUsd(currency) ? amount : amount / usdToPkrRate;

export const toPkr = (amount: number, currency: string, usdToPkrRate: number): number =>
  isUsd(currency) ? amount * usdToPkrRate : amount;

export const formatMoney = (amount: number, currency = 'PKR') =>
  `${currency} ${GROUPED.format(Math.round(amount))}`;

/* Compact form for board cards and tight columns, where the exact
   rupee never matters but the order of magnitude always does.
   Lakh/crore rather than K/M — this is a Karachi agency reading it. */
export const formatMoneyCompact = (amount: number, currency = 'PKR') => {
  const n = Math.abs(amount);
  if (n >= 10_000_000) return `${currency} ${(amount / 10_000_000).toFixed(n >= 100_000_000 ? 0 : 1)}Cr`;
  if (n >= 100_000) return `${currency} ${(amount / 100_000).toFixed(n >= 1_000_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  return `${currency} ${GROUPED.format(Math.round(amount))}`;
};

/* Currency splits — "PKR 400,000 + USD 2,500" — shown under a
   normalized total so the conversion is never mistaken for the
   money that actually arrived. */
export const formatCurrencySplit = (byCurrency: Record<string, number>) =>
  Object.entries(byCurrency)
    .filter(([, v]) => Math.round(v) !== 0)
    .map(([currency, v]) => `${currency} ${GROUPED.format(Math.round(v))}`)
    .join('  +  ') || '—';
