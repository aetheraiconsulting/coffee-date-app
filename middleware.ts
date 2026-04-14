import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || "aetherrevive.com"

  // Detect subdomain
  const isSubdomain = hostname !== mainDomain && 
    hostname !== `www.${mainDomain}` &&
    hostname.endsWith(`.${mainDomain}`)
  
  const subdomain = isSubdomain 
    ? hostname.replace(`.${mainDomain}`, "") 
    : null

  // If subdomain request hitting /audit — rewrite to public page
  if (subdomain && (url.pathname === "/audit" || url.pathname === "/audit/")) {
    url.pathname = `/audit/s/${subdomain}`
    return NextResponse.rewrite(url)
  }

  // If subdomain request hitting /quiz — rewrite to public quiz page
  if (subdomain && (url.pathname === "/quiz" || url.pathname === "/quiz/")) {
    url.pathname = `/quiz/s/${subdomain}`
    return NextResponse.rewrite(url)
  }

  // Allow all /audit/* and /api/audit/* paths through without auth (for public audit forms)
  if (url.pathname.startsWith("/audit/") || url.pathname === "/audit" || url.pathname.startsWith("/api/audit/")) {
    return NextResponse.next()
  }

  // Allow all /quiz/u/* and /quiz/s/* and /api/quiz/* paths through without auth (for public quiz)
  if (url.pathname.startsWith("/quiz/u/") || url.pathname.startsWith("/quiz/s/") || url.pathname.startsWith("/api/quiz/")) {
    return NextResponse.next()
  }

  // All other routes go through normal auth
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
