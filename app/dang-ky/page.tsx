import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SignupForm } from "@/components/SignupForm";
export default function SignupPage() {
  return <><SiteHeader /><main className="auth-wrap"><div className="auth-card"><p className="overline">NPT DUY STUDIO</p><h1>Tạo tài khoản</h1><p className="muted mt-2">Bắt đầu xây dựng dự án của bạn.</p><SignupForm /><Link href="/login" className="back-link">← Đã có tài khoản? Đăng nhập</Link></div></main></>;
}
