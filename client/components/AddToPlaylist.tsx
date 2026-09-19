"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addToPlaylist, createPlaylist, listPlaylists } from "@/lib/music";
import type { Playlist, PlaylistSummary, VideoInfo } from "@/lib/music";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";

/** The "+" every song row carries: pick a playlist, or name a new one. */
export function AddToPlaylistButton({
  video,
  onAdded,
  label = "Add to playlist",
}: {
  video: VideoInfo;
  onAdded?: (playlist: Playlist) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const start = () => {
    setOpen(true);
    setPlaylists(null);
    listPlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]));
  };

  const save = async (playlistId: string, playlistName: string) => {
    setBusy(true);
    try {
      const updated = await addToPlaylist(playlistId, video);
      setOpen(false);
      toast(`Added to ${playlistName}.`);
      onAdded?.(updated);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't add that just now.");
    } finally {
      setBusy(false);
    }
  };

  const createAndSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const created = await createPlaylist(clean, [video]);
      setOpen(false);
      setName("");
      toast(`Saved to ${created.name}.`);
      onAdded?.(created);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't make that playlist.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="track-action"
        title={label}
        aria-label={label}
        onClick={start}
      >
        <Icon name="plus" />
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div
              className="modal add-playlist-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Add to playlist"
            >
              <button
                className="modal-x"
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
              <h2>Add to playlist</h2>
              <p className="sub">{video.title}</p>

              <div className="playlist-choices">
                {playlists === null ? (
                  <p className="hint">Loading…</p>
                ) : playlists.length === 0 ? (
                  <p className="hint">No playlists yet — name one below.</p>
                ) : (
                  playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      className="playlist-choice"
                      disabled={busy}
                      onClick={() => save(playlist.id, playlist.name)}
                    >
                      <span>{playlist.name}</span>
                      <em>{playlist.count}</em>
                    </button>
                  ))
                )}
              </div>

              <form className="yt-form" onSubmit={createAndSave}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="New playlist…"
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="done"
                />
                <button className="btn btn-primary" disabled={busy || !name.trim()}>
                  Create
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
