import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/api";
import { getPlant, givePlant, publicPlant } from "@/lib/store";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/plants/[id]/give">) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const plant = getPlant(id);
  if (!plant || plant.ownerId !== user.id || plant.status === "released") return notFound();

  const input = (await req.json().catch(() => ({}))) as { to?: string; note?: string };
  const updated = givePlant(id, input.to, input.note);
  if (!updated) return notFound();
  return NextResponse.json(publicPlant(updated));
}
