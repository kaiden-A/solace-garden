import { apiFetch } from "@/lib/api-client";

/** A YouTube track as the client and the API both speak it. */
export interface VideoInfo {
  id: string;
  title: string;
  author: string;
  thumb: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  count: number;
  thumb: string;
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  tracks: VideoInfo[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Something went wrong.");
  }
  return (await res.json()) as T;
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  const res = await apiFetch("/api/music/playlists");
  return jsonOrThrow<PlaylistSummary[]>(res);
}

export async function createPlaylist(
  name: string,
  tracks: VideoInfo[] = [],
): Promise<Playlist> {
  const res = await apiFetch("/api/music/playlists", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      tracks: tracks.map((track) => ({
        videoId: track.id,
        title: track.title,
        author: track.author,
        thumb: track.thumb,
      })),
    }),
  });
  return jsonOrThrow<Playlist>(res);
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const res = await apiFetch(`/api/music/playlists/${id}`);
  return jsonOrThrow<Playlist>(res);
}

export async function renamePlaylist(id: string, name: string): Promise<PlaylistSummary> {
  const res = await apiFetch(`/api/music/playlists/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow<PlaylistSummary>(res);
}

export async function deletePlaylist(id: string): Promise<void> {
  const res = await apiFetch(`/api/music/playlists/${id}`, { method: "DELETE" });
  await jsonOrThrow<{ ok: boolean }>(res);
}

export async function addToPlaylist(id: string, track: VideoInfo): Promise<Playlist> {
  const res = await apiFetch(`/api/music/playlists/${id}/tracks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      videoId: track.id,
      title: track.title,
      author: track.author,
      thumb: track.thumb,
    }),
  });
  return jsonOrThrow<Playlist>(res);
}

export async function removeFromPlaylist(id: string, videoId: string): Promise<Playlist> {
  const res = await apiFetch(`/api/music/playlists/${id}/tracks/${videoId}`, {
    method: "DELETE",
  });
  return jsonOrThrow<Playlist>(res);
}

export async function reorderPlaylist(id: string, videoIds: string[]): Promise<Playlist> {
  const res = await apiFetch(`/api/music/playlists/${id}/order`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoIds }),
  });
  return jsonOrThrow<Playlist>(res);
}

export function moveTrack(tracks: VideoInfo[], index: number, delta: number): string[] {
  const target = index + delta;
  if (target < 0 || target >= tracks.length) return tracks.map((track) => track.id);
  const ids = tracks.map((track) => track.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
