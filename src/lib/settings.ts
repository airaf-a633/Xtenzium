import { supabase } from './supabase';

export const DEFAULT_USD_TO_PKR = 280;

export async function getUsdToPkrRate(): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'usd_to_pkr').maybeSingle();
  const n = data ? Number(data.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_PKR;
}

export function toUsd(amount: number, currency: string, usdToPkrRate: number): number {
  return currency.trim().toUpperCase() === 'USD' ? amount : amount / usdToPkrRate;
}
