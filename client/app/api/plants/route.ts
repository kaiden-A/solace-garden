import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { isCategory } from "@/lib/categories";
import { isSpecies } from "@/lib/species";
import { createPlant, listPlants, publicPlant } from "@/lib/store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const plants = listPlants(user.id)
    .filter((p) => p.status !== "released")
    .map(publicPlant);
  return NextResponse.json(plants);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const input = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    category?: string;
    species?: string;
    release?: boolean;
    forWhom?: { name?: string; email?: string; giveOn?: number | string } | null;
  };
  const body = String(input.body ?? "").trim();
  if (!body) return badRequest("Write something first.");

  const forName = String(input.forWhom?.name ?? "").trim();
  if (forName) {
    if (!input.species || !isSpecies(input.species)) return badRequest("Choose a plant type.");
  } else if (!input.category || !isCategory(input.category)) {
    return badRequest("Choose a theme for your plant.");
  }

  const plant = createPlant(user.id, {
    title: input.title,
    body,
    category: input.category,
    species: input.species,
    release: Boolean(input.release),
    forWhom: input.forWhom ?? null,
  });
  return NextResponse.json(publicPlant(plant), { status: 201 });
}
