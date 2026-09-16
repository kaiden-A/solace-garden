import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/api";
import { getPlant, publicPlant } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/plants/[id]">) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const plant = getPlant(id);
  if (!plant || plant.ownerId !== user.id || plant.status === "released") return notFound();
  return NextResponse.json(publicPlant(plant));
}
