"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string; message: string };
const empty = { error: "", message: "" };

function emailAndPassword(form: FormData) {
  return { email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") };
}
function callbackUrl(): string | null {
  try { const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? ""); return origin.protocol === "https:" || origin.hostname === "localhost" ? new URL("/auth/confirm", origin).toString() : null; }
  catch { return null; }
}

export async function signIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = emailAndPassword(form);
  if (!email || !password) return { ...empty, error: "Hãy nhập email và mật khẩu." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ...empty, error: "Không thể đăng nhập. Kiểm tra email và mật khẩu của bạn." };
  } catch { return { ...empty, error: "Không kết nối được. Hãy thử lại sau." }; }
  redirect("/dashboard");
}

export async function signUp(_state: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = emailAndPassword(form);
  const confirmation = String(form.get("confirmation") ?? "");
  const callback = callbackUrl();
  if (!email || password.length < 8 || password !== confirmation) return { ...empty, error: "Mật khẩu cần ít nhất 8 ký tự và hai ô mật khẩu phải khớp." };
  if (!callback) return { ...empty, error: "Đăng ký chưa được cấu hình. Vui lòng thử lại sau." };
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
    if (error) return { ...empty, error: "Chưa đăng ký được. Hãy thử lại sau." };
    signedIn = Boolean(data.session);
  } catch { return { ...empty, error: "Không kết nối được. Hãy thử lại sau." }; }
  if (signedIn) redirect("/dashboard");
  return { ...empty, message: "Nếu email hợp lệ, hãy kiểm tra hộp thư và mở liên kết xác nhận bằng cùng trình duyệt này." };
}

export async function requestPasswordReset(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const callback = callbackUrl();
  if (!email || !callback) return { ...empty, error: "Không gửi được yêu cầu. Hãy thử lại sau." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback });
    if (error) return { ...empty, error: "Không gửi được yêu cầu. Hãy thử lại sau." };
  } catch { return { ...empty, error: "Không kết nối được. Hãy thử lại sau." }; }
  return { ...empty, message: "Nếu email có tài khoản, anh sẽ nhận được thư đặt lại mật khẩu. Kiểm tra cả thư rác và mở liên kết bằng cùng trình duyệt vừa gửi yêu cầu." };
}

export async function updatePassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 8 || password !== confirmation) return { ...empty, error: "Mật khẩu cần ít nhất 8 ký tự và hai ô mật khẩu phải khớp." };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...empty, error: "Liên kết đã hết hạn. Hãy yêu cầu liên kết mới." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ...empty, error: "Không đổi được mật khẩu. Hãy yêu cầu liên kết mới và thử lại." };
  } catch { return { ...empty, error: "Không kết nối được. Hãy thử lại sau." }; }
  return { ...empty, message: "Đã lưu mật khẩu mới." };
}
