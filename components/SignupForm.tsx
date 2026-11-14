"use client";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/auth/actions";
const initial: AuthState = { error: "", message: "" };
export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.message) return <p role="status" className="form-success">{state.message}</p>;
  return <form action={action} className="form-stack mt-8"><label className="field-label">Email<input className="field-input" type="email" name="email" autoComplete="email" required /></label><label className="field-label">Mật khẩu<input className="field-input" type="password" name="password" autoComplete="new-password" minLength={8} required /></label><label className="field-label">Nhập lại mật khẩu<input className="field-input" type="password" name="confirmation" autoComplete="new-password" minLength={8} required /></label>{state.error && <p role="alert" className="form-error">{state.error}</p>}<button type="submit" className="primary-button justify-center" disabled={pending}>{pending ? "Đang tạo…" : "Tạo tài khoản"}</button></form>;
}
