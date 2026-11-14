import { strToU8, zipSync } from "fflate/browser";
import { createClient } from "@/lib/supabase/server";
import { parseUiTree } from "@/lib/builder/tree";
import { exportToReact, type ExportTarget } from "@/lib/code-generator";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const target = new URL(request.url).searchParams.get("target");
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || (target !== "web" && target !== "app")) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Hãy đăng nhập để xuất mã." }, { status: 401 });
  const { data: project } = await supabase.from("projects").select("id,name").eq("id", projectId).maybeSingle();
  if (!project) return Response.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  const { data: page } = await supabase.from("pages").select("ui_tree").eq("project_id", projectId).eq("path", "/").maybeSingle();
  const tree = page && parseUiTree(page.ui_tree);
  if (!tree) return Response.json({ error: "Không đọc được cấu trúc trang." }, { status: 422 });
  try {
    const files = exportToReact(tree, target as ExportTarget, projectId, project.name);
    const archive = zipSync(Object.fromEntries(Object.entries(files).map(([path, value]) => [path, strToU8(value)])), { level: 6 });
    return new Response(archive as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="npt-duy-${target}-${projectId.slice(0, 8)}.zip"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không xuất được mã." }, { status: 400 });
  }
}
