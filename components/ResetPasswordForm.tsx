"use client";
import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/auth/actions";
const initial: AuthState = { error: "", message: "" };
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  if (state.message) return <div className="mt-8"><p role="status">{state.message}</p><Link className="primary-button mt-4" href="/dashboard">Mở dự án của tôi</Link></div>;
  return <form action={action} className="form-stack mt-8"><label className="field-label">Mật khẩu mới<input className="field-input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label className="field-label">Nhập lại mật khẩu mới<input className="field-input" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>{state.error && <p role="alert" className="form-error">{state.error}</p>}<button className="primary-button justify-center" type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu mật khẩu mới"}</button></form>;
}
