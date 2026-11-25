import { NextResponse, type NextRequest } from "next/server";

/**
 * Comprobación optimista: sin cookie de sesión, las zonas privadas redirigen al login.
 * La autorización real se hace en el servidor (src/lib/tenant.ts) en cada página y acción.
 */
export function proxy(req: NextRequest) {
  const has = req.cookies.has("enc_session");
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = { matcher: ["/app/:path*", "/portal/:path*", "/admin/:path*"] };
