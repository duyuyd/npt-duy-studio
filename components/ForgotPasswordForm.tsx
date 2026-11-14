"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const redirectTo = new URL("/auth/confirm", window.location.origin).toString();
      const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (authError) { setError("Không gửi được yêu cầu. Hãy thử lại sau."); return; }
      setSent(true);
    } catch { setError("Không kết nối được. Hãy thử lại sau."); }
    finally { setBusy(false); }
  }

  if (sent) return <p role="status" className="muted mt-8">Nếu email có tài khoản, anh sẽ nhận được thư đặt lại mật khẩu. Hãy kiểm tra cả thư rác và mở liên kết bằng cùng trình duyệt vừa gửi yêu cầu.</p>;
  return <form onSubmit={submit} className="form-stack mt-8"><label className="field-label">Email<input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button justify-center" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}</button></form>;
}
