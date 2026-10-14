// すべての画面の手前で、ログインの有無と ALLOWED_EMAILS を確かめる
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth/"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!supabaseConfigured) return isPublic ? NextResponse.next() : redirectTo(request, "/login");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) return isPublic ? response : redirectTo(request, "/login", response);
  if (!isAllowedEmail(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return redirectTo(request, "/login?error=not_allowed", response);
  }
  if (path === "/login") return redirectTo(request, "/", response);
  return response;
}

function redirectTo(request: NextRequest, to: string, from?: NextResponse) {
  const res = NextResponse.redirect(new URL(to, request.url));
  for (const c of from?.cookies.getAll() ?? []) res.cookies.set(c);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\.(?:png|svg|ico|webp)$).*)"],
};
