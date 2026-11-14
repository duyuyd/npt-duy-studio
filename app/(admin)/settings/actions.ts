"use server";

import { createClient } from "@/lib/supabase/server";
import { parseSettings, type PlatformSettings, type SettingRow } from "@/lib/platform/settings";

type SaveResult = { ok: true; rows: SettingRow[] } | { ok: false; error: string };

export async function savePlatformSettings(draft: PlatformSettings): Promise<SaveResult> {
  const primary = draft?.primary_color;
  const hero = typeof draft?.hero_title === "string" ? draft.hero_title.trim() : null;
  const enabled = draft?.enable_ai_build;
  if (typeof primary !== "string" || !/^#[0-9a-fA-F]{6}$/.test(primary) ||
      typeof hero !== "string" || !hero || Array.from(hero).length > 160 || typeof enabled !== "boolean") {
    return { ok: false, error: "Cấu hình chưa hợp lệ. Hãy kiểm tra màu và tiêu đề." };
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") return { ok: false, error: "Tài khoản không có quyền Founder." };
    // SECURITY INVOKER + RLS protect the same mutation even when this action is bypassed.
    const { data, error } = await supabase.rpc("update_platform_settings", {
      p_primary_color: primary, p_hero_title: hero, p_enable_ai_build: enabled
    });
    if (error || !Array.isArray(data) || !parseSettings(data as SettingRow[])) {
      return { ok: false, error: "Không lưu được. Kiểm tra kết nối và thử lại." };
    }
    return { ok: true, rows: data as SettingRow[] };
  } catch {
    return { ok: false, error: "Không kết nối được. Thay đổi chưa được lưu." };
  }
}
