import { auth, isAuthConfigured } from "@/auth";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const navigationProxy = auth((request) => {
  if (request.auth?.user) return NextResponse.next();

  if (
    request.nextUrl.pathname === "/api/admin" ||
    request.nextUrl.pathname.startsWith("/api/admin/")
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const signIn = new URL("/api/auth/signin", request.url);
  signIn.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(signIn);
}) as unknown as NextMiddleware;

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/admin/sign-in") {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (
      request.nextUrl.pathname === "/api/admin" ||
      request.nextUrl.pathname.startsWith("/api/admin/")
    ) {
      return NextResponse.json(
        { error: "Administrative access is unavailable." },
        { status: 503 },
      );
    }
    return new NextResponse("Administrative access is unavailable.", { status: 503 });
  }

  return navigationProxy(request, event);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
