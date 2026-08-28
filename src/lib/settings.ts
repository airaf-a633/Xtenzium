import { supabase } from './supabase';
import { DEFAULT_USD_TO_PKR } from './money';

/* Re-exported so the many callers that already import conversion from
   here keep working. The implementations live in ./money. */
export { DEFAULT_USD_TO_PKR, toUsd, toPkr } from './money';

export async function getUsdToPkrRate(): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'usd_to_pkr').maybeSingle();
  const n = data ? Number(data.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_PKR;
}
