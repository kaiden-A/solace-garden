import { NextResponse } from "next/server";
import { notFound } from "@/lib/api";
import { speciesOf } from "@/lib/species";
import { findGift } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/gifts/[token]">) {
  const { token } = await ctx.params;
  const plant = findGift(token);
  if (!plant?.gift) return notFound();
  return NextResponse.json({
    title: plant.title,
    body: plant.body,
    species: speciesOf(plant),
    to: plant.gift.to,
    note: plant.gift.note,
    givenAt: plant.gift.givenAt,
    forWhom: plant.forWhom ?? null,
    letters: plant.events
      .filter((event) => event.type === "tended")
      .map((event) => ({ note: event.note || "Tended it again", at: event.at })),
  });
}
