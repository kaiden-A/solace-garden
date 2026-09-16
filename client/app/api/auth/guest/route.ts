import { NextResponse } from "next/server";
import { guestUser } from "@/lib/store";
import { setSession } from "@/lib/auth";

export async function POST() {
  const guest = guestUser();
  if (!guest) {
    return NextResponse.json({ error: "No guest garden seeded. Run npm run seed." }, { status: 500 });
  }
  await setSession(guest.id);
  return NextResponse.json({ id: guest.id, name: guest.name, email: guest.email });
}
