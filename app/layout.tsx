import type { Metadata } from "next";
import { PlatformProvider } from "@/lib/platform/PlatformProvider";
import { SETTING_KEYS, parseSettings, type SettingRow } from "@/lib/platform/settings";
import { themeStyle } from "@/lib/platform/theme";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NPT Duy Studio", description: "Không gian tạo sản phẩm số." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let rows: SettingRow[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("platform_settings").select("key,value,updated_at").in("key", [...SETTING_KEYS]);
    if (!error && data) rows = data as SettingRow[];
  } catch {
    // The provider displays a clear setup/connection message; it never fabricates settings.
  }
  const settings = parseSettings(rows);
  return <html lang="vi" style={settings ? themeStyle(settings.primary_color) : undefined}><body><PlatformProvider initialRows={rows}>{children}</PlatformProvider></body></html>;
}
