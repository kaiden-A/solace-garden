import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/store";
import { hashPassword, setSession } from "@/lib/auth";
import { badRequest } from "@/lib/api";

export async function POST(req: NextRequest) {
  const input = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
  };
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");

  if (!name || !email || password.length < 4) {
    return badRequest("Name, email and a password of 4+ characters are required.");
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "That email already has a garden." }, { status: 409 });
  }

  const user = createUser({ name, email, passwordHash: hashPassword(password) });
  await setSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
