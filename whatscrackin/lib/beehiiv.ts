// Adds a subscriber to the beehiiv publication, tags them with their city and sets the "edition" custom field.
export async function subscribeToBeehiiv(email: string, cityTag: string, edition: string) {
  const key = process.env.BEEHIIV_API_KEY;
  const pub = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pub) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('beehiiv is not configured');
    console.log(`[beehiiv not configured] would subscribe ${email} tagged "${cityTag}", edition "${edition}"`);
    return;
  }
  const base = `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pub)}`;
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const customFields = [{ name: 'edition', value: edition }];

  const res = await fetch(`${base}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: 'whatscrackin.us',
      utm_medium: 'website',
      referring_site: 'https://whatscrackin.us',
      custom_fields: customFields,
    }),
  });
  if (!res.ok) throw new Error(`beehiiv subscribe error ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: { id?: string } };
  const subId = body.data?.id;
  if (!subId) return;

  // Someone already on the list keeps their old fields on the create call, so set the edition explicitly too.
  const upd = await fetch(`${base}/subscriptions/${encodeURIComponent(subId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ custom_fields: customFields }),
  });
  if (!upd.ok) console.error('beehiiv edition update error', upd.status, await upd.text());

  if (cityTag) {
    const tagRes = await fetch(`${base}/subscriptions/${encodeURIComponent(subId)}/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tags: [cityTag] }),
    });
    if (!tagRes.ok) console.error('beehiiv tag error', tagRes.status, await tagRes.text());
  }
}
