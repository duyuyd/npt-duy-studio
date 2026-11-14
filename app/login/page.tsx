import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return <><SiteHeader /><main className="auth-wrap"><div className="auth-card"><p className="overline">FOUNDER ACCESS</p><h1>Chào mừng trở lại.</h1><p className="muted mt-2">Đăng nhập bằng tài khoản Supabase của bạn.</p><LoginForm /><Link className="back-link" href="/">← Trở về trang chủ</Link></div></main></>;
}
