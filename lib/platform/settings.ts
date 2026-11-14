export const SETTING_KEYS = ["primary_color", "hero_title", "enable_ai_build"] as const;
export type SettingKey = typeof SETTING_KEYS[number];
export type SettingRow = { key: string; value: unknown; updated_at: string };
export type PlatformSettings = {
  primary_color: string;
  hero_title: string;
  enable_ai_build: boolean;
};

export function parseSettings(rows: SettingRow[]): PlatformSettings | null {
  const settings = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  if (
    typeof settings.primary_color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(settings.primary_color) ||
    typeof settings.hero_title !== "string" || settings.hero_title.trim().length < 1 ||
    Array.from(settings.hero_title.trim()).length > 160 ||
    typeof settings.enable_ai_build !== "boolean"
  ) return null;
  return settings as PlatformSettings;
}

export function mergeRows(current: SettingRow[], incoming: SettingRow[]): SettingRow[] {
  const byKey = new Map(current.map((row) => [row.key, row]));
  let changed = false;
  for (const row of incoming) {
    if (!SETTING_KEYS.includes(row.key as SettingKey) || typeof row.updated_at !== "string") continue;
    const previous = byKey.get(row.key);
    // ISO timestamps retain PostgreSQL's sub-millisecond order; Date.parse would truncate it.
    if (!previous || row.updated_at > previous.updated_at) { byKey.set(row.key, row); changed = true; }
  }
  return changed ? [...byKey.values()] : current;
}
