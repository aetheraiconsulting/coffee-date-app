import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const pathname = request.nextUrl.pathname

  // Allow public audit pages regardless of subdomain or auth
  if (pathname.startsWith("/audit/") || pathname === "/audit") {
    return NextResponse.next()
  }

  // Only process subdomain logic if NEXT_PUBLIC_MAIN_DOMAIN is configured
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN

  if (mainDomain) {
    // Check if this is a subdomain request (not www, not main domain, not localhost/preview)
    const isLocalOrPreview =
      hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.includes("vercel.app")
    const isSubdomain =
      !isLocalOrPreview && hostname.includes(mainDomain) && !hostname.startsWith("www.") && hostname !== mainDomain

    if (isSubdomain) {
      const subdomain = hostname.split(".")[0]

      // Only allow quiz and audit pages on subdomains
      if (pathname.startsWith("/quiz/") || pathname.startsWith("/audit/")) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set("x-subdomain", subdomain)

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      }

      // Redirect other routes to main domain
      return NextResponse.redirect(new URL(pathname, `https://${mainDomain}`))
    }
  }

  // Handle normal auth session
  return await updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
