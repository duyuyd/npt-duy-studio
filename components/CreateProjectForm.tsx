"use client";
import { useActionState } from "react";
import { createProject, type CreateProjectState } from "@/app/dashboard/actions";

const initialState: CreateProjectState = { error: "" };
export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, initialState);
  return <form action={action} className="create-project-form"><label className="field-label">Tên dự án<input className="field-input" name="name" maxLength={120} required placeholder="Ví dụ: Cửa hàng của tôi" /></label><label className="field-label">Loại dự án<select className="field-input" name="type" defaultValue="web"><option value="web">Website</option><option value="app">Ứng dụng</option></select></label><button className="primary-button" disabled={pending} type="submit">{pending ? "Đang tạo…" : "Tạo dự án"}</button>{state.error && <p role="alert" className="form-error">{state.error}</p>}</form>;
}
