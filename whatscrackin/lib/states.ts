// US states: two-letter codes and names. Safe to import in client components.

export const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
export const STATE_CODES = new Set(Object.values(STATES));
export const STATE_NAMES = Object.fromEntries(Object.entries(STATES).map(([n, c]) => [c, n.replace(/\b\w/g, (x) => x.toUpperCase()).replace(' Of ', ' of ')]));

export function cleanState(raw: string | null | undefined): string | null {
  const s = (raw || '').trim().replace(/\./g, '');
  if (!s) return null;
  if (STATE_CODES.has(s.toUpperCase())) return s.toUpperCase();
  return STATES[s.toLowerCase()] || null;
}

export const stateName = (code: string) => STATE_NAMES[code] || code;

// For the checkup form's dropdown, sorted by name.
export const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => ({ code, name }));
