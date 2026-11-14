import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BuilderWorkspace } from "@/components/BuilderWorkspace";
import { parseUiTree } from "@/lib/builder/tree";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: project, error: projectError } = await supabase.from("projects").select("id,name,type").eq("id", projectId).maybeSingle();
  if (projectError) return <><SiteHeader /><main className="studio-wrap"><p role="alert" className="form-error">Không tải được dự án. Hãy thử lại.</p></main></>;
  if (!project) notFound();
  const { data: page, error } = await supabase.from("pages").select("id,ui_tree,revision").eq("project_id", projectId).eq("path", "/").maybeSingle();
  const tree = page && parseUiTree(page.ui_tree);
  if (error || !page || !tree || typeof page.revision !== "number") return <><SiteHeader /><main className="studio-wrap"><p role="alert" className="form-error">Không tải được cấu trúc trang. Dữ liệu hiện tại được giữ nguyên.</p><Link href="/dashboard" className="back-link">← Về danh sách dự án</Link></main></>;
  const { data: jobs, error: jobsError } = await supabase.from("build_jobs").select("id,platform,status,created_at,error_message").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10);
  const configured = process.env.BUILD_PIPELINE_ENABLED === "true" && Boolean(process.env.BUILD_DISPATCH_TOKEN && process.env.BUILD_WORKFLOW_REPOSITORY);
  return <><SiteHeader /><BuilderWorkspace project={project} pageId={page.id} initialTree={tree} initialRevision={page.revision} jobs={jobs ?? []} buildConfigured={configured} buildLoadError={Boolean(jobsError)} /></>;
}
