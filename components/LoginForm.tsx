"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/auth/actions";
const initial: AuthState = { error: "", message: "" };
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);
  return <form action={action} className="form-stack mt-8"><label className="field-label">Email<input className="field-input" name="email" type="email" autoComplete="email" required /></label><label className="field-label">Mật khẩu<input className="field-input" name="password" type="password" autoComplete="current-password" required /></label>{state.error && <p role="alert" className="form-error">{state.error}</p>}<button className="primary-button justify-center" type="submit" disabled={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</button><Link className="back-link" href="/quen-mat-khau">Quên hoặc chưa có mật khẩu?</Link><Link className="back-link" href="/dang-ky">Tạo tài khoản mới</Link></form>;
}
