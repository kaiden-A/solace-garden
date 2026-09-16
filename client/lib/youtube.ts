const VIDEO_ID = /^[\w-]{11}$/;

const asId = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return VIDEO_ID.test(trimmed) ? trimmed : null;
};

export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  const direct = asId(value);
  if (direct) return direct;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") return asId(url.pathname.slice(1).split("/")[0]);
  if (host.endsWith("youtube.com")) {
    const v = url.searchParams.get("v");
    if (v) return asId(v);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") return asId(parts[1]);
  }
  return null;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
