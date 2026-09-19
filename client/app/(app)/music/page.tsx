"use client";

import { useCallback, useEffect, useState } from "react";
import { AddToPlaylistButton } from "@/components/AddToPlaylist";
import { Icon } from "@/components/Icon";
import { useMusic } from "@/components/Music";
import { TrackAction, TrackRow } from "@/components/TrackRow";
import { apiFetch } from "@/lib/api-client";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  moveTrack,
  removeFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
} from "@/lib/music";
import type { Playlist, PlaylistSummary, VideoInfo } from "@/lib/music";
import { toast } from "@/lib/toast";
import { parseYouTubeId, watchUrl } from "@/lib/youtube";

interface RecentsResponse {
  signedIn: boolean;
  results: VideoInfo[];
}

export default function MusicPage() {
  const music = useMusic();
  const [summaries, setSummaries] = useState<PlaylistSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [history, setHistory] = useState<VideoInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoInfo[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (preferId?: string) => {
    try {
      const list = await listPlaylists();
      setSummaries(list);
      setSelectedId((current) => {
        const next = preferId ?? current;
        if (next && list.some((item) => item.id === next)) return next;
        return list[0]?.id ?? null;
      });
    } catch {
      setSummaries([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setPlaylist(null);
      return;
    }
    getPlaylist(selectedId)
      .then((data) => {
        if (!cancelled) setPlaylist(data);
      })
      .catch(() => {
        if (!cancelled) setPlaylist(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const loadHistory = useCallback(() => {
    apiFetch("/api/music/recents?limit=50")
      .then((res) => res.json())
      .then((data: RecentsResponse) => setHistory(data.results ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!music.video) return;
    // Give the play a moment to be recorded before reading the history back.
    const timer = setTimeout(loadHistory, 900);
    return () => clearTimeout(timer);
  }, [music.video, loadHistory]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const createNew = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = newName.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const created = await createPlaylist(clean);
      setNewName("");
      await refresh(created.id);
      toast(`Made ${created.name}.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't make that playlist.");
    } finally {
      setBusy(false);
    }
  };

  const renameCurrent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playlist || busy) return;
    const clean = renameDraft.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await renamePlaylist(playlist.id, clean);
      setPlaylist({ ...playlist, name: clean });
      setRenaming(false);
      await refresh(playlist.id);
      toast("Renamed.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't rename that playlist.");
    } finally {
      setBusy(false);
    }
  };

  const deleteCurrent = async () => {
    if (!playlist || busy) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deletePlaylist(playlist.id);
      setConfirmingDelete(false);
      setPlaylist(null);
      toast("Playlist deleted.");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete that playlist.");
    } finally {
      setBusy(false);
    }
  };

  const removeTrack = async (videoId: string) => {
    if (!playlist) return;
    try {
      setPlaylist(await removeFromPlaylist(playlist.id, videoId));
      await refresh(playlist.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't remove that song.");
    }
  };

  const move = async (index: number, delta: number) => {
    if (!playlist) return;
    const before = playlist;
    const ids = moveTrack(playlist.tracks, index, delta);
    setPlaylist({
      ...playlist,
      tracks: ids
        .map((id) => playlist.tracks.find((track) => track.id === id))
        .filter((track): track is VideoInfo => Boolean(track)),
    });
    try {
      setPlaylist(await reorderPlaylist(playlist.id, ids));
    } catch (err) {
      setPlaylist(before);
      toast(err instanceof Error ? err.message : "Couldn't reorder that.");
    }
  };

  const added = (updated: Playlist) => {
    if (updated.id === selectedId) setPlaylist(updated);
    void refresh(selectedId ?? undefined);
  };

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value || searching) return;

    setError("");
    setSearching(true);
    const linked = parseYouTubeId(value);
    try {
      if (linked) {
        let video: VideoInfo = {
          id: linked,
          title: "YouTube video",
          author: "",
          thumb: `https://i.ytimg.com/vi/${linked}/mqdefault.jpg`,
        };
        const res = await fetch(`/api/music/resolve?url=${encodeURIComponent(watchUrl(linked))}`);
        if (res.ok) video = (await res.json()) as VideoInfo;
        music.playVideo(video);
        setQuery("");
        return;
      }

      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(value)}&limit=25`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not search right now.");
        setResults([]);
        return;
      }
      const data = (await res.json()) as { results: VideoInfo[]; stale?: boolean };
      setResults(data.results);
      setSearched(true);
      if (data.stale) setError("Showing saved results — search is resting for today.");
    } catch {
      setError("Could not reach the music service.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const playing = (video: VideoInfo) => music.video?.id === video.id;
  const looksLikeLink = Boolean(parseYouTubeId(query));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Music</h1>
          <p className="sub">Playlists for slow hours — keep the songs you find, in your order.</p>
        </div>
      </div>

      <div className="music-page">
        <aside className="card music-rail">
          <h3>Playlists</h3>
          {summaries === null ? <p className="hint">Loading…</p> : null}
          {summaries?.length === 0 ? <p className="hint">Nothing saved yet.</p> : null}
          <ul className="playlist-list">
            {summaries?.map((item) => (
              <li key={item.id}>
                <button
                  className={item.id === selectedId ? "on" : ""}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.thumb ? (
                    <img src={item.thumb} alt="" />
                  ) : (
                    <span className="playlist-art">
                      <Icon name="music" />
                    </span>
                  )}
                  <span>
                    <b>{item.name}</b>
                    <em>
                      {item.count} {item.count === 1 ? "song" : "songs"}
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form className="playlist-new" onSubmit={createNew}>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New playlist…"
              autoComplete="off"
              enterKeyHint="done"
            />
            <button
              className="btn btn-primary"
              disabled={busy || !newName.trim()}
              title="Create playlist"
              aria-label="Create playlist"
            >
              <Icon name="plus" />
            </button>
          </form>
        </aside>

        <div className="music-stack">
          {playlist ? (
            <section className="card music-panel">
              <header className="music-panel-head">
                <div>
                  {renaming ? (
                    <form className="playlist-rename" onSubmit={renameCurrent}>
                      <input
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        autoFocus
                        enterKeyHint="done"
                      />
                      <button className="btn btn-primary" disabled={busy || !renameDraft.trim()}>
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      <h2>{playlist.name}</h2>
                      <p className="sub">
                        {playlist.tracks.length}{" "}
                        {playlist.tracks.length === 1 ? "song" : "songs"}
                      </p>
                    </>
                  )}
                </div>
                <div className="row">
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      music.playVideo(playlist.tracks[0], playlist.tracks)
                    }
                    disabled={playlist.tracks.length === 0}
                  >
                    <Icon name="play" /> Play all
                  </button>
                  {!renaming && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setRenameDraft(playlist.name);
                        setRenaming(true);
                      }}
                    >
                      Rename
                    </button>
                  )}
                  <button
                    className={`btn btn-ghost${confirmingDelete ? " danger" : ""}`}
                    onClick={deleteCurrent}
                  >
                    {confirmingDelete ? "Delete it?" : "Delete"}
                  </button>
                </div>
              </header>

              {playlist.tracks.length === 0 ? (
                <p className="hint">Nothing here yet — search below and add the first song.</p>
              ) : (
                <div className="recents">
                  {playlist.tracks.map((video, index) => (
                    <TrackRow
                      key={video.id}
                      video={video}
                      onPlay={() => music.playVideo(video, playlist.tracks)}
                      playing={playing(video)}
                    >
                      <TrackAction
                        label="Move up"
                        icon="up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      />
                      <TrackAction
                        label="Move down"
                        icon="down"
                        disabled={index === playlist.tracks.length - 1}
                        onClick={() => move(index, 1)}
                      />
                      <TrackAction
                        label="Remove from playlist"
                        icon="trash"
                        onClick={() => removeTrack(video.id)}
                      />
                    </TrackRow>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="card music-panel">
              <p className="hint">Pick a playlist, or make one above.</p>
            </section>
          )}

          <section className="card music-panel">
            <header className="music-panel-head">
              <div>
                <h2>Find a song</h2>
                <p className="sub">Search YouTube or paste a link, then keep it in a playlist.</p>
              </div>
            </header>
            <form className="yt-form" onSubmit={submitSearch}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search YouTube or paste a link"
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="search"
              />
              <button className="btn btn-primary" disabled={searching || !query.trim()}>
                {searching ? "…" : looksLikeLink ? "Play" : "Search"}
              </button>
            </form>
            {error && <p className="music-error">{error}</p>}
            {results.length > 0 && (
              <div className="recents music-results">
                <h4>Results</h4>
                {results.map((video) => (
                  <TrackRow
                    key={video.id}
                    video={video}
                    onPlay={() => music.playVideo(video, results)}
                    playing={playing(video)}
                  >
                    <AddToPlaylistButton video={video} onAdded={added} />
                  </TrackRow>
                ))}
              </div>
            )}
            {!searching && searched && results.length === 0 && !error && (
              <p className="hint">Nothing found for that. Try different words, or paste a link.</p>
            )}
          </section>

          {history.length > 0 && (
            <section className="card music-panel">
              <header className="music-panel-head">
                <div>
                  <h2>History</h2>
                  <p className="sub">Songs played from this garden.</p>
                </div>
              </header>
              <div className="recents music-history">
                {history.map((video) => (
                  <TrackRow
                    key={video.id}
                    video={video}
                    onPlay={() => music.playVideo(video, history)}
                    playing={playing(video)}
                  >
                    <AddToPlaylistButton video={video} onAdded={added} />
                  </TrackRow>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
