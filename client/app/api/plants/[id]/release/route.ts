import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/api";
import { getPlant, releasePlant } from "@/lib/store";

export async function POST(_req: Request, ctx: RouteContext<"/api/plants/[id]/release">) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const plant = getPlant(id);
  if (!plant || plant.ownerId !== user.id) return notFound();

  releasePlant(id);
  return NextResponse.json({ ok: true });
}
