"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { usePlatform } from "@/lib/platform/PlatformProvider";
import { parseSettings, type PlatformSettings, type SettingRow } from "@/lib/platform/settings";
import { createClient } from "@/lib/supabase/client";
import { savePlatformSettings } from "./actions";

export function SettingsForm({ email }: { email: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { settings, applySavedRows, realtimeWarning } = usePlatform();
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [remoteChange, setRemoteChange] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setDraft(settings);
    else setRemoteChange(true);
  }, [settings]);

  function edit<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    dirtyRef.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(""); setError("");
  }

  function reset() {
    dirtyRef.current = false; setDraft(settings); setRemoteChange(false); setNotice(""); setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hero = draft.hero_title.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.primary_color)) { setError("Màu cần có dạng #RRGGBB."); return; }
    if (hero.length < 1 || Array.from(hero).length > 160) { setError("Tiêu đề cần từ 1 đến 160 ký tự."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await savePlatformSettings({ ...draft, hero_title: hero });
      const saved = result.ok ? parseSettings(result.rows as SettingRow[]) : null;
      if (!result.ok || !saved) {
        setError(result.ok ? "Cấu hình trả về không hợp lệ." : result.error);
        return;
      }
      dirtyRef.current = false;
      applySavedRows(result.rows);
      setDraft(saved); setRemoteChange(false);
      setNotice("Đã lưu. Giao diện được cập nhật ngay.");
    } catch { setError("Không kết nối được. Thay đổi của bạn chưa được lưu."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login"); router.refresh();
  }

  const validColor = /^#[0-9a-fA-F]{6}$/.test(draft.primary_color);
  return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="admin-wrap">
    <div className="admin-topline"><div><p className="overline">FOUNDER DASHBOARD <span>/</span> CÀI ĐẶT</p><h1>Định hình nền tảng<span className="accent">.</span></h1><p className="muted">Tùy chỉnh trải nghiệm của bạn ở một nơi.</p></div><div className="founder-chip"><span className="founder-avatar">F</span><span><strong>Founder</strong><small>{email}</small></span><button className="signout" type="button" onClick={signOut}>Đăng xuất</button></div></div>
    {realtimeWarning && <div className="banner" role="status">Kết nối cập nhật thời gian thực đang gián đoạn. Bạn vẫn có thể lưu; các trang khác có thể cần tải lại.</div>}
    <div className="admin-grid"><aside className="admin-sidebar"><p className="sidebar-heading">KHÔNG GIAN QUẢN TRỊ</p><div className="sidebar-active"><span>◈</span> Cài đặt chung <span className="ml-auto">↗</span></div><div className="sidebar-footer"><span className="status-dot" /> Kết nối dữ liệu thực</div></aside>
      <form onSubmit={save} className="settings-card"><div className="card-heading"><div><p className="overline">01 / GIAO DIỆN</p><h2>Nhận diện nền tảng</h2><p className="muted">Thay đổi sẽ được lưu vào cấu hình chung.</p></div><span className="card-icon">✳</span></div>
        <div className="setting-block"><div><label className="setting-label" htmlFor="primary-color-text">Màu chủ đạo</label><p className="setting-help">Áp dụng cho các điểm nhấn và nút trên toàn bộ giao diện.</p></div><div className="color-control"><label className="color-picker" aria-label="Chọn màu chủ đạo"><input type="color" value={validColor ? draft.primary_color : settings.primary_color} onChange={(event) => edit("primary_color", event.target.value)} /></label><input id="primary-color-text" className="color-text" value={draft.primary_color} onChange={(event) => edit("primary_color", event.target.value)} spellCheck={false} maxLength={7} aria-describedby="color-hint" /><span id="color-hint">HEX</span></div></div>
        <div className="setting-block"><div><label className="setting-label" htmlFor="hero-title">Tiêu đề trang chủ</label><p className="setting-help">Lời đầu tiên khách nhìn thấy khi đến nền tảng.</p></div><textarea id="hero-title" className="field-input hero-input" rows={3} maxLength={160} value={draft.hero_title} onChange={(event) => edit("hero_title", event.target.value)} required /><div className="char-count">{draft.hero_title.length} / 160</div></div>
        <div className="setting-block flag-block"><div><label id="ai-label" className="setting-label">Cấu hình tạo bằng AI</label><p className="setting-help">Lưu cờ bật/tắt cho giai đoạn sau. Chức năng AI chưa được triển khai.</p></div><button type="button" role="switch" aria-checked={draft.enable_ai_build} aria-labelledby="ai-label" onClick={() => edit("enable_ai_build", !draft.enable_ai_build)} className={`switch ${draft.enable_ai_build ? "is-on" : ""}`}><span /></button></div>
        {remoteChange && <p className="banner">Cấu hình đã thay đổi ở một phiên khác. Bản bạn đang sửa vẫn được giữ; lưu sẽ ghi đè các trường trên.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
        <div className="actions"><button type="button" className="secondary-button" onClick={reset} disabled={busy}>Hủy thay đổi</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"} <span aria-hidden="true">↗</span></button></div>
      </form>
      <aside className="preview-card"><div className="preview-heading"><div><p className="overline">XEM TRƯỚC</p><h2>Diện mạo của bạn</h2></div><span>↗</span></div><p className="setting-help">Bản nháp chỉ được áp dụng toàn trang sau khi bạn lưu.</p><div className="mini-browser"><div className="mini-top"><i /><i /><i /></div><div className="mini-body" style={validColor ? { "--preview": draft.primary_color } as React.CSSProperties : undefined}><span className="mini-badge">STUDIO / BUILDER</span><strong>{draft.hero_title || "Tiêu đề trang chủ"}</strong><div className="mini-line" /><div className="mini-button" /></div></div><div className="preview-note"><span>✦</span><p>Tùy chỉnh theo ý bạn. Nội dung đã lưu được đồng bộ tới các phiên đang mở khi kết nối thời gian thực hoạt động.</p></div></aside>
    </div>
  </motion.main>;
}
