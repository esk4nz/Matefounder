import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

const GUEST_ONLY_ROUTES = ["/login", "/signup"] as const;
const PROTECTED_ROUTE_PREFIXES = ["/profile"] as const;

function redirectHomePreservingSession(request: NextRequest, sessionResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(new URL("/", request.url));
  sessionResponse.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value);
  });
  return redirectResponse;
}

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isGuestOnlyRoute(pathname: string) {
  return GUEST_ONLY_ROUTES.includes(pathname as (typeof GUEST_ONLY_ROUTES)[number]);
}

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getSafeNextPath(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next");
  return nextPath && nextPath.startsWith("/") ? nextPath : "/";
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const adminGateOnlyForDocument =
    request.method === "GET" || request.method === "HEAD";

  if (isAdminRoute(pathname)) {
    if (!user) {
      if (adminGateOnlyForDocument) {
        return redirectHomePreservingSession(request, response);
      }
      return response;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_admin !== true) {
      if (adminGateOnlyForDocument) {
        return redirectHomePreservingSession(request, response);
      }
      return response;
    }
  }

  if (user && isGuestOnlyRoute(pathname)) {
    return NextResponse.redirect(new URL(getSafeNextPath(request), request.url));
  }

  if (!user && request.method === "GET" && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
