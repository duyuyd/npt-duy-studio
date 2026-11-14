"use server";

import { createClient } from "@/lib/supabase/server";
import { parseUiTree, type UiTree } from "@/lib/builder/tree";
import { revalidatePath } from "next/cache";

export type SavePageResult = { ok: true; revision: number } | { ok: false; conflict: boolean; error: string };

export async function savePageTree(pageId: string, revision: number, input: UiTree): Promise<SavePageResult> {
  const tree = parseUiTree(input);
  if (!tree || JSON.stringify(tree).length > 200000 || !Number.isSafeInteger(revision) || revision < 0)
    return { ok: false, conflict: false, error: "Nội dung chưa hợp lệ. Kiểm tra đường dẫn ảnh, liên kết và kích thước trang." };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, conflict: false, error: "Phiên đăng nhập đã hết hạn." };
    const { data, error } = await supabase.rpc("save_page_tree", { p_page_id: pageId, p_revision: revision, p_tree: tree });
    if (error) return { ok: false, conflict: false, error: "Không lưu được. Kiểm tra kết nối và thử lại." };
    if (!Array.isArray(data) || data.length !== 1 || typeof data[0].new_revision !== "number")
      return { ok: false, conflict: true, error: "Trang đã thay đổi ở nơi khác hoặc bạn không còn quyền sửa. Hãy sao lưu nội dung rồi tải lại." };
    return { ok: true, revision: data[0].new_revision };
  } catch { return { ok: false, conflict: false, error: "Không kết nối được. Những thay đổi chưa được lưu." }; }
}

export type BuildState = { error: string; message: string };
export async function requestBuild(_previous: BuildState, form: FormData): Promise<BuildState> {
  const projectId = String(form.get("projectId") ?? "");
  const platform = String(form.get("platform") ?? "");
  const repository = process.env.BUILD_WORKFLOW_REPOSITORY ?? "";
  const token = process.env.BUILD_DISPATCH_TOKEN;
  if (process.env.BUILD_PIPELINE_ENABLED !== "true" || !token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    return { error: "Hệ thống build chưa được kết nối. Hãy cấu hình Expo EAS, GitHub Actions và R2 trước.", message: "" };
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !["android", "ios"].includes(platform)) return { error: "Yêu cầu không hợp lệ.", message: "" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Hãy đăng nhập để tạo bản build.", message: "" };
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Không tìm thấy dự án.", message: "" };
  const { data: jobId, error } = await supabase.rpc("create_studio_build", { p_project_id: projectId, p_platform: platform });
  if (error || typeof jobId !== "string") return { error: "Không tạo được yêu cầu. Có thể một bản build khác đang chạy.", message: "" };
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/build-app.yml/dispatches`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "NPT-Duy-Studio" },
      body: JSON.stringify({ ref: "main", inputs: { job_id: jobId } }), cache: "no-store"
    });
    if (!response.ok) throw new Error("dispatch failed");
  } catch {
    await supabase.rpc("fail_undispatched_build", { p_job_id: jobId });
    return { error: "Không gửi được yêu cầu build. Hãy kiểm tra cấu hình GitHub Actions.", message: "" };
  }
  revalidatePath(`/projects/${projectId}`);
  return { error: "", message: "Đã gửi vào hàng đợi. Cập nhật trang để xem trạng thái." };
}
