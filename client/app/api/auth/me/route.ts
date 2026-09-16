import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json(user);
}
