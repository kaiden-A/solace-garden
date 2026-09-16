import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/store";
import { setSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const input = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Email or password is not right." }, { status: 401 });
  }

  await setSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
