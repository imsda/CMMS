import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n";

const localePrefixes = ["/en", "/es"];
const handleI18nRouting = createMiddleware(routing);

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

  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    "/((?!api|trpc|_next/|_vercel|favicon\\.ico|images/|.*\\..*).*)",
  ],
};
