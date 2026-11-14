import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <><SiteHeader /><main className="auth-wrap"><div className="auth-card"><p className="overline">FOUNDER ACCESS</p><h1>Tạo mật khẩu mới</h1>{user?.email ? <><p className="muted mt-2">Tài khoản: {user.email}</p><ResetPasswordForm /></> : <><p className="muted mt-3">Liên kết không còn hiệu lực hoặc đã được sử dụng.</p><Link href="/quen-mat-khau" className="back-link">Yêu cầu liên kết mới</Link></>}</div></main></>;
}
