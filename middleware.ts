import { NextRequest, NextResponse } from "next/server";

const localePrefixes = ["/en", "/es"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const prefix of localePrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const targetPath = pathname.slice(prefix.length) || "/";
      const url = request.nextUrl.clone();
      url.pathname = targetPath;
      return NextResponse.redirect(url, 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|trpc|_next/|_vercel|favicon\\.ico|images/|.*\\..*).*)",
  ],
};
