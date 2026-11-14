import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Project = { id: string; name: string; type: "web" | "app"; updated_at: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("projects").select("id,name,type,updated_at").order("updated_at", { ascending: false });
  return <><SiteHeader /><main className="studio-wrap"><div className="studio-title"><div><p className="overline">KHÔNG GIAN CỦA BẠN</p><h1>Dự án của tôi</h1><p className="muted">Tạo và chỉnh sửa website hoặc ứng dụng của bạn.</p></div><span className="account-label">{user.email}</span></div><section className="studio-panel"><h2>Tạo dự án mới</h2><CreateProjectForm /></section><section className="studio-projects"><div className="section-heading"><h2>Dự án gần đây</h2></div>{error ? <p role="alert" className="form-error">Không tải được dự án. Hãy thử lại.</p> : data?.length ? <div className="project-list">{(data as Project[]).map(project => <Link className="project-card" key={project.id} href={`/projects/${project.id}`}><span className="project-type">{project.type === "app" ? "ỨNG DỤNG" : "WEBSITE"}</span><strong>{project.name}</strong><span>Mở trình chỉnh sửa →</span></Link>)}</div> : <div className="empty-projects">Chưa có dự án nào. Tạo dự án đầu tiên ở phía trên.</div>}</section></main></>;
}
