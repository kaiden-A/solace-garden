import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/garden", "/seeds", "/growing", "/plant", "/release", "/plants", "/harvest", "/gifts", "/dev"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const guarded = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!guarded) return NextResponse.next();
  if (req.cookies.get("solace_session")?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|assets|mockup|favicon|icon|.*\\..*).*)"],
};
