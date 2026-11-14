"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); return; }
    if (password !== confirmation) { setError("Hai mật khẩu chưa khớp."); return; }
    setBusy(true);
    try {
      const { error: authError } = await createClient().auth.updateUser({ password });
      if (authError) { setError("Không đổi được mật khẩu. Hãy yêu cầu liên kết mới và thử lại."); return; }
      setPassword(""); setConfirmation(""); setSaved(true);
    } catch { setError("Không kết nối được. Hãy thử lại."); }
    finally { setBusy(false); }
  }

  if (saved) return <div className="mt-8"><p role="status">Đã lưu mật khẩu mới.</p><Link className="primary-button mt-4" href="/settings">Mở cài đặt Founder</Link></div>;
  return <form onSubmit={submit} className="form-stack mt-8"><label className="field-label">Mật khẩu mới<input className="field-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><label className="field-label">Nhập lại mật khẩu mới<input className="field-input" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button justify-center" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu mật khẩu mới"}</button></form>;
}
