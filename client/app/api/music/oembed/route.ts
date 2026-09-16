import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeId, watchUrl } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const id = parseYouTubeId(raw);
  if (!id) return NextResponse.json({ error: "Not a YouTube link." }, { status: 400 });

  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(id))}`);
  if (!res.ok) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const data = (await res.json()) as { title: string; author_name: string; thumbnail_url: string };
  return NextResponse.json({
    id,
    title: data.title,
    author: data.author_name,
    thumbnail: data.thumbnail_url,
  });
}
