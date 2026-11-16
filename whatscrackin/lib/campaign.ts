// Where a checkup lead came from, from the link's ?src= (e.g. ?src=cbp on the Tampa cards). A short lowercase slug or null.
export function cleanCampaign(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,23}$/.test(s) ? s : null;
}
