import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ "lien-ket"?: string }> }) {
  const params = await searchParams;
  return <><SiteHeader /><main className="auth-wrap"><div className="auth-card"><p className="overline">FOUNDER ACCESS</p><h1>Đặt lại mật khẩu</h1><p className="muted mt-2">Nhập email tài khoản để nhận liên kết tạo mật khẩu mới.</p>{params["lien-ket"] === "khong-hop-le" && <p role="alert" className="form-error mt-4">Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.</p>}<ForgotPasswordForm /><Link className="back-link" href="/login">← Quay lại đăng nhập</Link></div></main></>;
}
