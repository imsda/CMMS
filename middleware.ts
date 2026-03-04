import createMiddleware from 'next-intl/middleware';

import {routing} from './i18n';

/**
 * next-intl middleware handles locale detection and path prefixing for all
 * application routes (en / es).
 *
 * The matcher intentionally excludes every path that must NOT be processed by
 * middleware so that Next.js can serve static assets directly:
 *
 *   /_next/static  – compiled JS / CSS chunks
 *   /_next/image   – image optimisation endpoint
 *   /favicon.ico   – browser favicon
 *   /images/       – public image directory
 *   /.*\.<ext>     – any file with an extension (fonts, manifests, etc.)
 *
 * Omitting these paths from the matcher prevents CSS loading failures in
 * Docker and on CDN-less deployments where the middleware would otherwise
 * intercept and redirect asset requests before they reach the static server.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    /*
     * Match every pathname EXCEPT:
     * 1. _next/static  (Next.js static asset directory)
     * 2. _next/image   (Next.js image optimisation route)
     * 3. favicon.ico   (browser tab icon)
     * 4. images/       (public/images directory)
     * 5. Any path that ends with a file extension (e.g. .svg, .png, .css, .js,
     *    .woff2, .ttf, .ico, .webp, .json, .xml, .txt, .map)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|cjs|woff|woff2|ttf|otf|eot|map|json|xml|txt)$).*)',
  ],
};
