"use client";
import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";
const initial: AuthState = { error: "", message: "" };
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  if (state.message) return <p role="status" className="muted mt-8">{state.message}</p>;
  return <form action={action} className="form-stack mt-8"><label className="field-label">Email<input className="field-input" name="email" type="email" autoComplete="email" required /></label>{state.error && <p role="alert" className="form-error">{state.error}</p>}<button className="primary-button justify-center" type="submit" disabled={pending}>{pending ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}</button></form>;
}
