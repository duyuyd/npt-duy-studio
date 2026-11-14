"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError("Không thể đăng nhập. Kiểm tra email và mật khẩu của bạn."); return; }
      router.replace("/settings"); router.refresh();
    } catch { setError("Không kết nối được. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="form-stack mt-8"><label className="field-label">Email<input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label className="field-label">Mật khẩu<input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button justify-center" type="submit" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button><Link className="back-link" href="/quen-mat-khau">Quên hoặc chưa có mật khẩu?</Link></form>;
}
