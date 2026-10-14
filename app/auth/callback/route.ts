// メールのリンク、Googleログインからの戻り先
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedUser } from "@/lib/auth/allowed";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!code) return to("/login?error=callback");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return to("/login?error=callback");
  if (!isAllowedUser(data.user?.email, data.user?.app_metadata)) {
    await supabase.auth.signOut();
    return to("/login?error=not_allowed");
  }
  return to("/");
}
