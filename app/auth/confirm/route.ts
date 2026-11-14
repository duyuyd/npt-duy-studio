import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchange a recovery code with the verifier stored in the requesting browser.
// Never accept a caller-supplied redirect.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  let destination = "/quen-mat-khau?lien-ket=khong-hop-le";
  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      // auth-js includes redirectType at runtime, though its public response type omits it.
      const redirectType = (data as { redirectType?: string | null }).redirectType;
      if (!error && data.session) destination = redirectType === "recovery" ? "/dat-lai-mat-khau" : "/dashboard";
    } catch { /* Show a generic error without retaining the code. */ }
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
