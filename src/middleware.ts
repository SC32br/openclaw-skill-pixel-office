import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/office/stream",
  "/stream",
  "/overlay",
  "/auth/login",
  "/api/auth/login",
  "/api/openclaw/sessions",
  "/api/openclaw/stats",
  "/api/agents",
  "/api/activity/feed",
  "/favicon.svg",
  "/_next",
];

const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/") {
    return response;
  }

  if (pathname.startsWith("/office/admin") || pathname.startsWith("/api/")) {
    const token =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.cookies.get("ai-office-token")?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
