import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  // Verify identity with Supabase Auth; do not authorize from a client-side claim.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") {
    return <><SiteHeader /><main className="auth-wrap"><div className="auth-card"><p className="overline">FOUNDER ACCESS</p><h1>Không có quyền truy cập</h1><p className="muted mt-3">Chỉ tài khoản Founder đã được cấp quyền mới có thể sửa cấu hình nền tảng.</p><Link href="/" className="back-link">← Về trang chủ</Link></div></main></>;
  }
  return <><SiteHeader /><SettingsForm email={user.email ?? ""} /></>;
}
