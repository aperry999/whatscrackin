import { db } from './db';

export type Settings = {
  defaultGoal: number;
  revealPct: number;
  suggestFromBreweries: boolean;
};

const DEFAULTS: Settings = { defaultGoal: 100, revealPct: 75, suggestFromBreweries: true };

export async function getSettings(): Promise<Settings> {
  const rows = await db()<{ key: string; value: string }[]>`select key, value from settings`;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const int = (k: string, d: number) => {
    const n = parseInt(map.get(k) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    defaultGoal: int('default_goal', DEFAULTS.defaultGoal),
    revealPct: Math.min(100, int('reveal_pct', DEFAULTS.revealPct)),
    suggestFromBreweries: map.has('suggest_from_breweries')
      ? map.get('suggest_from_breweries') === 'true'
      : DEFAULTS.suggestFromBreweries,
  };
}

export async function saveSettings(s: Settings) {
  const pairs: [string, string][] = [
    ['default_goal', String(s.defaultGoal)],
    ['reveal_pct', String(s.revealPct)],
    ['suggest_from_breweries', String(s.suggestFromBreweries)],
  ];
  for (const [key, value] of pairs) {
    await db()`insert into settings (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value`;
  }
}
