/* Dialer CSV import — everything that can be decided without a browser.

   Phone cleaning, timezone-from-HQ, header → field mapping, and the
   dedupe verdict for every row. Pure functions, so the 2,000-row file
   can be exercised in a check instead of by clicking. The page only
   does I/O: read the file, call the RPCs, draw the preview. */

/* ─── Phones ───────────────────────────────────────────────

   No libphonenumber: ~95% of this data is US numbers in one format,
   and the library would add more to the bundle than this whole file.
   Anything it can't make sense of is reported as invalid, never
   guessed at. */

export interface NormalizedPhone {
  e164: string | null;
  isUs: boolean;
}

const NONE: NormalizedPhone = { e164: null, isUs: false };

/** NANP: area code and exchange both start 2–9. */
const isNanp = (ten: string) => /^[2-9]\d{2}[2-9]\d{6}$/.test(ten);

export function normalizePhone(raw: string | null | undefined, hintedUs = false): NormalizedPhone {
  const s = (raw ?? '').trim();
  if (!s) return NONE;

  const hasPlus = s.startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return NONE;

  /* "+0017178849789" and "0017178849789" are both an international
     prefix written twice; strip every leading 00. */
  let international = hasPlus;
  if (digits.startsWith('00')) {
    digits = digits.replace(/^0+/, '');
    international = true;
  }
  if (!digits) return NONE;

  if (!international) {
    if (digits.length === 10 && isNanp(digits)) return { e164: `+1${digits}`, isUs: true };
    if (digits.length === 11 && digits.startsWith('1') && isNanp(digits.slice(1))) {
      return { e164: `+${digits}`, isUs: true };
    }
    /* Not a US shape. If the source insists it's US, it's broken; else
       the digits already carry a country code (the file writes foreign
       numbers as "61 2 8973 1908"). */
    if (hintedUs) return NONE;
  }

  if (digits.length < 8 || digits.length > 15) return NONE;
  if (digits.startsWith('1') && digits.length === 11) {
    return isNanp(digits.slice(1)) ? { e164: `+${digits}`, isUs: true } : NONE;
  }
  return { e164: `+${digits}`, isUs: false };
}

/* ─── Timezones ────────────────────────────────────────────

   From the HQ state. States that straddle zones get the zone most of
   their population is in — good enough to decide "is it business hours
   there", and a rep calling at 9:05 instead of 9:00 hurts nobody. */

const STATES: Record<string, [abbr: string, tz: string]> = {
  alabama: ['AL', 'America/Chicago'], alaska: ['AK', 'America/Anchorage'],
  arizona: ['AZ', 'America/Phoenix'], arkansas: ['AR', 'America/Chicago'],
  california: ['CA', 'America/Los_Angeles'], colorado: ['CO', 'America/Denver'],
  connecticut: ['CT', 'America/New_York'], delaware: ['DE', 'America/New_York'],
  'district of columbia': ['DC', 'America/New_York'], florida: ['FL', 'America/New_York'],
  georgia: ['GA', 'America/New_York'], hawaii: ['HI', 'Pacific/Honolulu'],
  idaho: ['ID', 'America/Denver'], illinois: ['IL', 'America/Chicago'],
  indiana: ['IN', 'America/New_York'], iowa: ['IA', 'America/Chicago'],
  kansas: ['KS', 'America/Chicago'], kentucky: ['KY', 'America/New_York'],
  louisiana: ['LA', 'America/Chicago'], maine: ['ME', 'America/New_York'],
  maryland: ['MD', 'America/New_York'], massachusetts: ['MA', 'America/New_York'],
  michigan: ['MI', 'America/New_York'], minnesota: ['MN', 'America/Chicago'],
  mississippi: ['MS', 'America/Chicago'], missouri: ['MO', 'America/Chicago'],
  montana: ['MT', 'America/Denver'], nebraska: ['NE', 'America/Chicago'],
  nevada: ['NV', 'America/Los_Angeles'], 'new hampshire': ['NH', 'America/New_York'],
  'new jersey': ['NJ', 'America/New_York'], 'new mexico': ['NM', 'America/Denver'],
  'new york': ['NY', 'America/New_York'], 'north carolina': ['NC', 'America/New_York'],
  'north dakota': ['ND', 'America/Chicago'], ohio: ['OH', 'America/New_York'],
  oklahoma: ['OK', 'America/Chicago'], oregon: ['OR', 'America/Los_Angeles'],
  pennsylvania: ['PA', 'America/New_York'], 'rhode island': ['RI', 'America/New_York'],
  'south carolina': ['SC', 'America/New_York'], 'south dakota': ['SD', 'America/Chicago'],
  tennessee: ['TN', 'America/Chicago'], texas: ['TX', 'America/Chicago'],
  utah: ['UT', 'America/Denver'], vermont: ['VT', 'America/New_York'],
  virginia: ['VA', 'America/New_York'], washington: ['WA', 'America/Los_Angeles'],
  'west virginia': ['WV', 'America/New_York'], wisconsin: ['WI', 'America/Chicago'],
  wyoming: ['WY', 'America/Denver'],
};
const BY_ABBR = Object.fromEntries(
  Object.values(STATES).map(([abbr, tz]) => [abbr, tz] as const),
);

/** "Coral Gables, Florida" → FL / America/New_York. "United States" → nothing. */
export function stateFromHq(hq: string | null | undefined): { state: string | null; timezone: string | null } {
  const tail = (hq ?? '').split(',').pop()?.trim() ?? '';
  if (!tail) return { state: null, timezone: null };
  const named = STATES[tail.toLowerCase()];
  if (named) return { state: named[0], timezone: named[1] };
  const abbr = tail.toUpperCase();
  if (abbr.length === 2 && BY_ABBR[abbr]) return { state: abbr, timezone: BY_ABBR[abbr] };
  return { state: null, timezone: null };
}

/* ─── Domains ──────────────────────────────────────────── */

export function domainOf(url: string | null | undefined): string | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  try {
    const host = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase();
    const bare = host.replace(/^www\./, '');
    return bare.includes('.') ? bare : null;
  } catch {
    return null;
  }
}

/* A company whose "website" is a social or directory page would share a
   domain with every other company on that platform, and all but the first
   would be thrown out as duplicates. Those hosts are not a dedupe key. */
const PLATFORM_DOMAINS = [
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com',
  'pinterest.com', 'linktr.ee', 'behance.net', 'dribbble.com', 'clutch.co', 'upwork.com', 'fiverr.com', 'yelp.com',
  'google.com', 'g.page', 'goo.gl', 'bbb.org', 'crunchbase.com', 'github.com', 'medium.com', 'goodfirms.co',
  'designrush.com', 'themanifest.com', 'wa.me', 'bit.ly',
];

export const isPlatformDomain = (host: string | null): boolean =>
  !!host && PLATFORM_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));

const dedupeDomain = (host: string | null): string | null => (isPlatformDomain(host) ? null : host);

/** "2.12555E+09": a phone number after a spreadsheet got hold of it. The digits are gone. */
export const looksExcelDamaged = (raw: string | null): boolean =>
  !!raw && /^\s*[+-]?\d(\.\d+)?\s*e\s*[+-]?\d+\s*$/i.test(raw);

export function segmentFrom(raw: string | null): 'agency' | 'dev_shop' | null {
  const v = (raw ?? '').toLowerCase();
  if (!v) return null;
  const dev = /\b(dev|devs|developer|developers|development|software|engineering|engineers?)\b/.test(v);
  const agency = /\b(agency|agencies|design|creative|marketing|branding|brand)\b/.test(v);
  // Both ("Web Design & Development Agency") is a coin toss: say nothing and let the import's choice apply.
  if (dev === agency) return null;
  return dev ? 'dev_shop' : 'agency';
}

/* ─── Column mapping ───────────────────────────────────────

   A header is matched on its letters only, so "Phone Number",
   "phone_number" and "PHONE-NUMBER" are the same thing. Within a
   field, an earlier synonym beats a later one — that is how a file with
   both `hourly_rate` ("$150/hr") and `rate_usd` (150) picks the number. */

export type FieldKey =
  | 'company_name' | 'phone' | 'email' | 'website' | 'contact_url' | 'profile_url'
  | 'hq' | 'team_size' | 'hourly_rate_usd' | 'services' | 'works_count'
  | 'tier' | 'score' | 'why' | 'source' | 'contact_name' | 'contact_title' | 'segment';

export interface FieldDef {
  key: FieldKey;
  label: string;
  required?: boolean;
  synonyms: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'company_name', label: 'Company name', required: true,
    synonyms: ['name', 'companyname', 'company', 'agencyname', 'agency', 'business', 'businessname'] },
  { key: 'phone', label: 'Phone', synonyms: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile'] },
  { key: 'email', label: 'Email', synonyms: ['roleemail', 'email', 'emailaddress', 'contactemail'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'site', 'web', 'url', 'domain'] },
  { key: 'contact_url', label: 'Contact page', synonyms: ['contacturl', 'contactpage'] },
  { key: 'profile_url', label: 'Profile link', synonyms: ['profileurl', 'profile', 'profilelink'] },
  { key: 'hq', label: 'HQ / location', synonyms: ['hq', 'headquarters', 'location', 'address', 'city'] },
  { key: 'team_size', label: 'Team size', synonyms: ['team', 'teamsize', 'employees', 'size'] },
  { key: 'hourly_rate_usd', label: 'Hourly rate (USD)', synonyms: ['rateusd', 'hourlyrateusd', 'hourlyrate', 'rate'] },
  { key: 'services', label: 'Services', synonyms: ['services', 'service'] },
  { key: 'works_count', label: 'Projects / works count', synonyms: ['workscount', 'works', 'projects'] },
  { key: 'tier', label: 'Tier', synonyms: ['tier', 'priority', 'grade'] },
  { key: 'score', label: 'Score', synonyms: ['score', 'leadscore', 'rating'] },
  { key: 'why', label: 'Talking points (why)', synonyms: ['why', 'notes', 'reason', 'talkingpoints'] },
  { key: 'source', label: 'Source', synonyms: ['source', 'origin'] },
  { key: 'contact_name', label: 'Contact name', synonyms: ['contactname', 'contactperson', 'decisionmaker'] },
  { key: 'contact_title', label: 'Contact title', synonyms: ['contacttitle', 'jobtitle', 'title', 'role'] },
  { key: 'segment', label: 'Segment (agency / dev shop)', synonyms: ['segment', 'leadtype', 'companytype'] },
];

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Column index → field key, or '' for "don't map". */
export type Mapping = Record<number, FieldKey | ''>;

export function autoMap(headers: string[]): Mapping {
  const norm = headers.map(letters);
  const mapping: Mapping = {};
  headers.forEach((_, i) => (mapping[i] = ''));
  const taken = new Set<number>();

  for (const field of FIELDS) {
    let best = -1;
    let bestRank = Infinity;
    norm.forEach((h, i) => {
      if (taken.has(i)) return;
      const rank = field.synonyms.indexOf(h);
      if (rank !== -1 && rank < bestRank) {
        best = i;
        bestRank = rank;
      }
    });
    if (best !== -1) {
      mapping[best] = field.key;
      taken.add(best);
    }
  }
  return mapping;
}

/* ─── Rows ─────────────────────────────────────────────── */

export type LeadStatus = 'new' | 'no_phone' | 'bad_data';

/** Exactly the shape import_call_leads() reads (migration 017). */
export interface LeadRecord {
  company_name: string;
  phone_raw: string | null;
  phone_e164: string | null;
  phone_is_us: boolean | null;
  email: string | null;
  website: string | null;
  domain: string | null;
  contact_url: string | null;
  profile_url: string | null;
  hq: string | null;
  state: string | null;
  timezone: string | null;
  team_size: string | null;
  hourly_rate_usd: number | null;
  services: string | null;
  works_count: number | null;
  tier: 'A' | 'B' | 'C' | 'D' | null;
  segment: 'agency' | 'dev_shop' | null;
  score: number | null;
  why: string | null;
  source: string | null;
  extra: Record<string, string>;
  status: LeadStatus;
}

export type Verdict =
  | 'ok'            // will import, callable
  | 'no_phone'      // will import, nothing to dial (outreach by email / contact form)
  | 'bad_phone'     // will import as bad_data: had a phone we couldn't read, and no email
  | 'dup_file'      // same phone/domain earlier in this file
  | 'held_back'     // the person chose not to import this tier value
  | 'dup_existing'  // already in the CRM
  | 'dnc'           // on the do-not-call list
  | 'no_name';      // nothing to call it

export interface PreparedRow {
  /** 1-based, counting the header as row 1, so it matches a spreadsheet. */
  rowNumber: number;
  verdict: Verdict;
  record: LeadRecord | null;
  /** A phone cell that Excel/Sheets turned into 2.12E+09. Nothing usable is left in it. */
  excelDamaged?: boolean;
  /** Set when a different phone/domain hides what looks like the same company. It is still imported. */
  possibleDup?: 'existing' | 'file';
}

export interface KnownKeys {
  phones: string[];
  domains: string[];
  dnc_phones: string[];
  dnc_domains: string[];
  /** Existing leads, for the "same company, different phone" warning (migration 026). */
  companies?: { n: string; s: string | null }[];
}

const COMPANY_NOISE = new Set(['llc', 'inc', 'incorporated', 'ltd', 'limited', 'co', 'corp', 'corporation', 'company', 'the', 'and', 'group', 'agency', 'studio', 'studios', 'digital', 'marketing', 'media']);

/** "Acme Digital, LLC" and "ACME" compare equal. A name that is only noise keeps its words. */
export function companyKey(name: string, state: string | null): string | null {
  const words = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const core = words.filter(w => !COMPANY_NOISE.has(w));
  const key = (core.length ? core : words).join('');
  if (key.length < 3) return null;
  return `${key}|${(state ?? '').toLowerCase()}`;
}

const clean = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  return s ? s : null;
};

const toNumber = (v: string | null): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && /\d/.test(v) ? n : null;
};

const toInt = (v: string | null): number | null => {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
};

/* ─── Tiers ────────────────────────────────────────────────

   Files name their priority in whatever way suits them: "A - call
   first", "Hot", "1", "Tier B". guessTier understands the common ones;
   anything it can't read is left for the person importing to decide in
   the preview, never guessed silently. */

/** 'D' = parked (kept, never dialled unless asked for). 'skip' = don't import the row at all. */
export type TierValue = 'A' | 'B' | 'C' | 'D' | 'skip' | null;
/** What to do with each distinct value in the file's tier column. Keyed by the trimmed raw value. */
export type TierMap = Record<string, TierValue>;
/** For files with a score but no tier: A at or above `a`, B at or above `b`, otherwise C. */
export interface ScoreRule {
  a: number;
  b: number;
}

const TIER_WORDS: Record<string, TierValue> = {
  hot: 'A', high: 'A', top: 'A', best: 'A', priority: 'A', gold: 'A', platinum: 'A', one: 'A', first: 'A', '1': 'A',
  warm: 'B', medium: 'B', med: 'B', mid: 'B', silver: 'B', two: 'B', second: 'B', '2': 'B',
  cold: 'C', low: 'C', bronze: 'C', three: 'C', third: 'C', '3': 'C',
};

export function guessTier(raw: string | null | undefined): TierValue {
  const v = (raw ?? '').trim().toLowerCase().replace(/^tier[\s:_-]*/, '');
  if (!v) return null;
  const letter = /^([abcd])\b/.exec(v);
  if (letter) return letter[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
  const first = v.replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean)[0] ?? '';
  return TIER_WORDS[v] ?? TIER_WORDS[first] ?? null;
}

/** The distinct non-empty values in one column, most common first. */
export function distinctValues(rows: string[][], col: number): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = (r[col] ?? '').trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export interface TierOptions {
  tierMap?: TierMap;
  scoreRule?: ScoreRule | null;
  /** Applied to every row that doesn't carry its own segment column. */
  segment?: 'agency' | 'dev_shop' | null;
}

/** The tier for one row: the person's mapping, else the guess; the score rule only fills in rows with NO tier value at all. */
export function tierFor(rawTier: string | null, score: number | null, opts: TierOptions): TierValue {
  if (rawTier) {
    const mapped = opts.tierMap?.[rawTier];
    return mapped !== undefined ? mapped : guessTier(rawTier);
  }
  if (opts.scoreRule && score !== null) {
    return score >= opts.scoreRule.a ? 'A' : score >= opts.scoreRule.b ? 'B' : 'C';
  }
  return null;
}

/** Turn parsed CSV rows (header excluded) into verdicts + records. */
export function prepareRows(
  headers: string[],
  rows: string[][],
  mapping: Mapping,
  known: KnownKeys,
  /** Which column carries the file's own "is this a US number" flag, if any. */
  usFlagColumn: number | null = null,
  tierOptions: TierOptions = {},
): PreparedRow[] {
  const col = {} as Partial<Record<FieldKey, number>>;
  Object.entries(mapping).forEach(([i, key]) => {
    if (key) col[key] = Number(i);
  });
  const get = (r: string[], key: FieldKey) => (col[key] === undefined ? null : clean(r[col[key]!]));

  const knownPhones = new Set(known.phones);
  const knownDomains = new Set(known.domains);
  const dncPhones = new Set(known.dnc_phones);
  const dncDomains = new Set(known.dnc_domains);
  const seenPhones = new Set<string>();
  const seenDomains = new Set<string>();
  const knownCompanies = new Set((known.companies ?? []).map(c => companyKey(c.n, c.s)).filter((k): k is string => !!k));
  const seenCompanies = new Set<string>();

  const mappedCols = new Set(Object.entries(mapping).filter(([, k]) => k).map(([i]) => Number(i)));
  /* The file's own US flag is consumed by the phone cleaner; it isn't "extra". */
  if (usFlagColumn !== null) mappedCols.add(usFlagColumn);

  return rows.map((r, idx): PreparedRow => {
    const rowNumber = idx + 2;
    const name = get(r, 'company_name');
    if (!name) return { rowNumber, verdict: 'no_name', record: null };

    const phoneRaw = get(r, 'phone');
    const hintedUs = usFlagColumn !== null && /^(yes|true|y|1)$/i.test((r[usFlagColumn] ?? '').trim());
    const damaged = looksExcelDamaged(phoneRaw);
    const phone = damaged ? NONE : normalizePhone(phoneRaw, hintedUs);
    const website = get(r, 'website');
    const domain = dedupeDomain(domainOf(website));
    const email = get(r, 'email')?.toLowerCase() ?? null;
    const hq = get(r, 'hq');
    const geo = stateFromHq(hq);

    const extra: Record<string, string> = {};
    r.forEach((value, i) => {
      if (!mappedCols.has(i) && value.trim() && headers[i]) extra[headers[i]] = value.trim();
    });

    /* Only an unreadable number with nothing else to fall back on is
       "bad data". A lead with no number at all is simply not callable. */
    const score = toInt(get(r, 'score'));
    const status: LeadStatus = phone.e164 ? 'new' : phoneRaw && !email ? 'bad_data' : 'no_phone';

    const tier = tierFor(get(r, 'tier'), score, tierOptions);
    if (tier === 'skip') return { rowNumber, verdict: 'held_back', record: null };

    const record: LeadRecord = {
      company_name: name,
      phone_raw: phoneRaw,
      phone_e164: phone.e164,
      phone_is_us: phone.e164 ? phone.isUs : null,
      email,
      website,
      domain,
      contact_url: get(r, 'contact_url'),
      profile_url: get(r, 'profile_url'),
      hq,
      state: geo.state,
      timezone: geo.timezone,
      team_size: get(r, 'team_size'),
      hourly_rate_usd: toNumber(get(r, 'hourly_rate_usd')),
      services: get(r, 'services'),
      works_count: toInt(get(r, 'works_count')),
      tier,
      segment: segmentFrom(get(r, 'segment')) ?? tierOptions.segment ?? null,
      score,
      why: get(r, 'why'),
      source: get(r, 'source'),
      extra,
      status,
    };

    if ((phone.e164 && dncPhones.has(phone.e164)) || (domain && dncDomains.has(domain))) {
      return { rowNumber, verdict: 'dnc', record: null };
    }
    if ((phone.e164 && knownPhones.has(phone.e164)) || (domain && knownDomains.has(domain))) {
      return { rowNumber, verdict: 'dup_existing', record: null };
    }
    if ((phone.e164 && seenPhones.has(phone.e164)) || (domain && seenDomains.has(domain))) {
      return { rowNumber, verdict: 'dup_file', record: null };
    }
    if (phone.e164) seenPhones.add(phone.e164);
    if (domain) seenDomains.add(domain);

    const ck = companyKey(name, geo.state);
    let possibleDup: PreparedRow['possibleDup'];
    if (ck) {
      if (knownCompanies.has(ck)) possibleDup = 'existing';
      else if (seenCompanies.has(ck)) possibleDup = 'file';
      seenCompanies.add(ck);
    }

    const verdict: Verdict = status === 'new' ? 'ok' : status === 'no_phone' ? 'no_phone' : 'bad_phone';
    return { rowNumber, verdict, record, ...(possibleDup ? { possibleDup } : {}), ...(damaged ? { excelDamaged: true } : {}) };
  });
}

export interface Summary {
  total: number;
  callable: number;
  noPhone: number;
  badPhone: number;
  dupFile: number;
  dupExisting: number;
  dnc: number;
  noName: number;
  /** Rows that will actually be written. */
  toImport: number;
  nonUs: number;
  /** Rows left out because their tier value was set to "don't import". */
  heldBack: number;
  /** Phone cells a spreadsheet had already ruined (2.1E+09). */
  excelDamaged: number;
  /** Rows that will be imported but look like a company already in the CRM or earlier in the file. */
  possibleDup: number;
  byTier: { A: number; B: number; C: number; D: number; none: number };
}

export function summarize(prepared: PreparedRow[]): Summary {
  const s: Summary = {
    total: prepared.length, callable: 0, noPhone: 0, badPhone: 0, dupFile: 0,
    dupExisting: 0, dnc: 0, noName: 0, toImport: 0, nonUs: 0, possibleDup: 0, heldBack: 0, excelDamaged: 0,
    byTier: { A: 0, B: 0, C: 0, D: 0, none: 0 },
  };
  for (const p of prepared) {
    switch (p.verdict) {
      case 'ok': s.callable++; break;
      case 'no_phone': s.noPhone++; break;
      case 'bad_phone': s.badPhone++; break;
      case 'dup_file': s.dupFile++; break;
      case 'dup_existing': s.dupExisting++; break;
      case 'dnc': s.dnc++; break;
      case 'no_name': s.noName++; break;
      case 'held_back': s.heldBack++; break;
    }
    if (p.record) {
      s.toImport++;
      if (p.record.phone_is_us === false) s.nonUs++;
      s.byTier[p.record.tier ?? 'none']++;
      if (p.possibleDup) s.possibleDup++;
    }
    if (p.excelDamaged) s.excelDamaged++;
  }
  return s;
}
