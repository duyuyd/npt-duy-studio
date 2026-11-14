import { AwsClient } from "aws4fetch";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Hãy đăng nhập." }, { status: 401 });
  const { data: job } = await supabase.from("build_jobs").select("id,project_id,platform,status,object_key").eq("id", jobId).maybeSingle();
  if (!job || job.status !== "succeeded") return Response.json({ error: "Bản build chưa sẵn sàng." }, { status: 404 });
  const extension = job.platform === "android" ? "apk" : job.platform === "ios" ? "ipa" : "";
  const expectedKey = `builds/${job.project_id}/${job.id}.${extension}`;
  if (!extension || job.object_key !== expectedKey) return Response.json({ error: "Đường dẫn bản build không hợp lệ." }, { status: 422 });
  const account = process.env.R2_ACCOUNT_ID ?? "", bucket = process.env.R2_BUCKET ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID, secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !accessKeyId || !secretAccessKey)
    return Response.json({ error: "Kho tải xuống chưa được cấu hình." }, { status: 503 });
  try {
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const url = new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${expectedKey}`);
    url.searchParams.set("X-Amz-Expires", "300");
    const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return new Response(null, { status: 302, headers: { Location: signed.url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return Response.json({ error: "Không tạo được liên kết tải. Hãy thử lại." }, { status: 503 }); }
}
