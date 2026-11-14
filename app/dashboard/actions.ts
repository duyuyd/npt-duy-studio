"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateProjectState = { error: string };

export async function createProject(_previous: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!name || name.length > 120 || !["web", "app"].includes(type)) return { error: "Hãy nhập tên dự án và chọn loại dự án." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("create_studio_project", { p_name: name, p_type: type });
  if (error || typeof data !== "string") return { error: "Chưa tạo được dự án. Hãy thử lại hoặc kiểm tra kết nối." };
  redirect(`/projects/${data}`);
}
