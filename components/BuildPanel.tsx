"use client";
import { useActionState } from "react";
import { requestBuild, type BuildState } from "@/app/projects/[projectId]/actions";

export type Job = { id: string; platform: string; status: string; created_at: string; error_message: string | null };
const initial: BuildState = { error: "", message: "" };
const statusLabel: Record<string, string> = { queued: "Đang chờ", running: "Đang build", succeeded: "Hoàn tất", failed: "Thất bại", cancelled: "Đã hủy" };

export function BuildPanel({ projectId, jobs, configured, isDirty, loadError }: { projectId: string; jobs: Job[]; configured: boolean; isDirty: boolean; loadError: boolean }) {
  const [state, action, pending] = useActionState(requestBuild, initial);
  return <section className="build-panel"><div><h2>Build ứng dụng</h2><p className="muted">Bản build dùng cấu trúc đã lưu và được xử lý nền.</p></div>{!configured && <p className="banner">Chưa kết nối Expo EAS, GitHub Actions và R2. Tính năng build đang tạm khóa.</p>}{isDirty && <p className="banner">Hãy lưu thay đổi trước khi tạo bản build.</p>}<form action={action} className="build-form"><input type="hidden" name="projectId" value={projectId} /><label className="field-label">Nền tảng<select className="field-input" name="platform" defaultValue="android"><option value="android">Android APK</option><option value="ios">iOS IPA</option></select></label><button className="secondary-button" type="submit" disabled={!configured || pending || isDirty}>{pending ? "Đang gửi…" : "Tạo bản build"}</button></form>{state.error && <p role="alert" className="form-error">{state.error}</p>}{state.message && <p role="status" className="form-success">{state.message}</p>}{loadError && <p role="alert" className="form-error">Không tải được lịch sử build.</p>}{jobs.length > 0 && <ul className="job-list">{jobs.map(job => <li key={job.id}><span>{job.platform === "ios" ? "iOS" : "Android"} · {statusLabel[job.status] ?? job.status}</span>{job.status === "succeeded" && <a href={`/api/build-jobs/${job.id}/download`}>Tải về</a>}{job.status === "failed" && job.error_message && <small>{job.error_message}</small>}</li>)}</ul>}<a className="back-link" href={`/projects/${projectId}`}>↻ Cập nhật trạng thái</a></section>;
}
