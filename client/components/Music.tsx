"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { toast } from "@/lib/toast";
import { parseYouTubeId, watchUrl } from "@/lib/youtube";
import { Icon } from "./Icon";

export interface VideoInfo {
  id: string;
  title: string;
  author: string;
  thumb: string;
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(id: string): void;
  setVolume(volume: number): void;
  destroy(): void;
}

type YTNamespace = {
  Player: new (el: HTMLElement, options: object) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<YTNamespace | null> | null = null;

function loadYT(): Promise<YTNamespace | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT ?? null);
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return ytPromise;
}

type Mode = "off" | "ambient" | "yt";
export type RepeatMode = "off" | "one" | "all";

// The YouTube states worth reacting to.
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

const MAX_QUEUE = 25;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface MusicState {
  mode: Mode;
  playing: boolean;
  video: VideoInfo | null;
  volume: number;
  repeat: RepeatMode;
  queue: VideoInfo[];
  index: number;
}

interface SavedMusic {
  video?: VideoInfo;
  volume?: number;
  repeat?: RepeatMode;
  queue?: VideoInfo[];
  index?: number;
}

interface RecentsResponse {
  signedIn: boolean;
  results: VideoInfo[];
}

interface MusicApi extends MusicState {
  attachHolder: (el: HTMLDivElement | null) => void;
  playAmbient: () => void;
  playVideo: (video: VideoInfo, list?: VideoInfo[]) => void;
  toggle: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  cycleRepeat: () => void;
  recents: VideoInfo[];
  popular: VideoInfo[];
}

const MusicCtx = createContext<MusicApi | null>(null);

export function useMusic(): MusicApi {
  const ctx = useContext(MusicCtx);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MusicState>({
    mode: "off",
    playing: false,
    video: null,
    volume: 0.55,
    repeat: "all",
    queue: [],
    index: 0,
  });
  const [recents, setRecents] = useState<VideoInfo[]>([]);
  const [popular, setPopular] = useState<VideoInfo[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const signedInRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const playerHolderRef = useRef<HTMLDivElement | null>(null);
  /** Which video the player actually holds, and its last reported state. */
  const loadedIdRef = useRef<string | null>(null);
  const playerStateRef = useRef<number>(-1);
  /** Set on ENDED and cleared on PLAYING: YouTube also reports "cued" after the
      end, so the state alone is not a reliable "this one has finished" test. */
  const endedRef = useRef(false);
  const advanceRef = useRef<(delta: number) => void>(() => {});
  const [holderTick, setHolderTick] = useState(0);
  /** The saved state is only persisted once it has been read back. */
  const [hydrated, setHydrated] = useState(false);

  const attachHolder = useCallback((el: HTMLDivElement | null) => {
    holderRef.current = el;
    setHolderTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let saved: SavedMusic | null = null;
    try {
      saved = JSON.parse(localStorage.getItem("solace.music") ?? "null") as SavedMusic | null;
    } catch {
      /* ignore */
    }
    try {
      setRecents(JSON.parse(localStorage.getItem("solace.recents") ?? "[]") as VideoInfo[]);
    } catch {
      /* ignore */
    }

    const savedVideo = saved?.video ?? null;
    const queue = saved?.queue?.length ? saved.queue.slice(0, MAX_QUEUE) : savedVideo ? [savedVideo] : [];
    const index = Math.min(Math.max(0, saved?.index ?? 0), Math.max(0, queue.length - 1));
    setState((s) => ({
      ...s,
      mode: savedVideo ? "yt" : s.mode,
      video: savedVideo,
      volume: saved?.volume ?? s.volume,
      repeat: saved?.repeat ?? s.repeat,
      queue,
      index,
    }));
    setHydrated(true);

    let cancelled = false;
    void (async () => {
      const [mine, serverPopular] = await Promise.all([
        fetchJson<RecentsResponse>("/api/music/recents"),
        fetchJson<VideoInfo[]>("/api/music/popular"),
      ]);
      if (cancelled) return;
      if (mine?.signedIn) {
        signedInRef.current = true;
        setRecents(mine.results);
        if (!savedVideo && mine.results[0]) {
          setState((s) => ({
            ...s,
            mode: "yt",
            video: mine.results[0],
            queue: mine.results.slice(0, MAX_QUEUE),
            index: 0,
            playing: false,
          }));
        }
      }
      if (serverPopular) setPopular(serverPopular);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "solace.music",
        JSON.stringify({
          video: state.video,
          volume: state.volume,
          repeat: state.repeat,
          queue: state.queue.slice(0, MAX_QUEUE),
          index: state.index,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, state.video, state.volume, state.repeat, state.queue, state.index]);

  const startTrack = useCallback(async (video: VideoInfo, restart = false) => {
    const YT = await loadYT();
    if (!YT || !holderRef.current) return;

    if (playerRef.current && playerHolderRef.current !== holderRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      loadedIdRef.current = null;
    }

    // A finished track is the one case the IFrame player handles badly, so it
    // gets a fresh player - exactly what refreshing the page used to do.
    if (playerRef.current && endedRef.current && loadedIdRef.current === video.id) {
      try {
        playerRef.current.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      loadedIdRef.current = null;
      endedRef.current = false;
    }

    if (playerRef.current && loadedIdRef.current === video.id) {
      try {
        if (restart) playerRef.current.seekTo(0, true);
        playerRef.current.playVideo();
        return;
      } catch {
        /* fall through and rebuild the player */
      }
    }

    if (playerRef.current) {
      try {
        playerRef.current.loadVideoById(video.id);
        loadedIdRef.current = video.id;
        endedRef.current = false;
        return;
      } catch {
        try {
          playerRef.current.destroy();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
        loadedIdRef.current = null;
      }
    }

    playerRef.current = new YT.Player(holderRef.current, {
      videoId: video.id,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          event.target.setVolume(Math.round(stateRef.current.volume * 100));
          event.target.playVideo();
        },
        onStateChange: (event: { data: number }) => {
          playerStateRef.current = event.data;
          if (event.data === YT_PLAYING) {
            endedRef.current = false;
            setState((s) => (s.mode === "yt" ? { ...s, playing: true } : s));
          } else if (event.data === YT_PAUSED) {
            setState((s) => (s.mode === "yt" ? { ...s, playing: false } : s));
          } else if (event.data === YT_ENDED) {
            endedRef.current = true;
            // Repeat one replays here; otherwise the queue decides what is next.
            advanceRef.current(stateRef.current.repeat === "one" ? 0 : 1);
          }
          // buffering (3), unstarted (-1) and cued (5) leave the flag alone
        },
        onError: () => {
          toast("That one won't play — trying the next.");
          advanceRef.current(1);
        },
      },
    });
    playerHolderRef.current = holderRef.current;
    loadedIdRef.current = video.id;
    endedRef.current = false;
  }, []);

  /** Replays the current track from the top. */
  const replay = useCallback(() => {
    const { queue, index } = stateRef.current;
    const current = queue[index];
    if (!current) return;
    setState((s) => ({ ...s, playing: true }));
    void startTrack(current, true);
  }, [startTrack]);

  /** Moves through the queue: +1 next, -1 previous, 0 replay this one. */
  const step = useCallback(
    (delta: number) => {
      const { queue, index, repeat, playing } = stateRef.current;
      if (!queue.length) return;
      if (delta === 0) {
        replay();
        return;
      }

      let target = index + delta;
      if (target < 0) {
        if (repeat !== "all") return;
        target = queue.length - 1;
      }
      if (target >= queue.length) {
        if (repeat !== "all") {
          setState((s) => ({ ...s, playing: false }));
          return;
        }
        target = 0;
      }
      if (target === index) {
        if (playing) return;
        replay();
        return;
      }
      setState((s) => ({ ...s, mode: "yt", video: s.queue[target], index: target, playing: true }));
    },
    [replay],
  );
  advanceRef.current = step;

  useEffect(() => {
    if (state.mode !== "yt" || !state.video) return;
    if (state.playing) {
      audioRef.current?.pause();
      void startTrack(state.video);
    } else if (playerStateRef.current !== YT_ENDED) {
      // Poking a finished player wedges it for the next play.
      playerRef.current?.pauseVideo();
    }
  }, [state.mode, state.video, state.playing, startTrack, holderTick]);

  const playAmbient = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playerRef.current?.pauseVideo();
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        setState((s) => ({ ...s, mode: "ambient", playing: true }));
        let volume = 0;
        const fade = setInterval(() => {
          volume = Math.min(stateRef.current.volume, volume + 0.04);
          audio.volume = volume;
          if (volume >= stateRef.current.volume) clearInterval(fade);
        }, 120);
      })
      .catch(() => toast("No ambience file yet — add public/assets/music.mp3"));
  }, []);

  const rememberPlay = useCallback(async (video: VideoInfo) => {
    if (signedInRef.current) {
      try {
        const res = await fetch("/api/music/plays", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            videoId: video.id,
            title: video.title,
            author: video.author,
            thumb: video.thumb,
          }),
        });
        if (res.ok) {
          setRecents((await res.json()) as VideoInfo[]);
          return;
        }
      } catch {
        /* offline: fall back to this browser's list */
      }
    }
    setRecents((prev) => {
      const next = [video, ...prev.filter((item) => item.id !== video.id)].slice(0, 5);
      try {
        localStorage.setItem("solace.recents", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const playVideo = useCallback(
    (video: VideoInfo, list?: VideoInfo[]) => {
      audioRef.current?.pause();
      const queue = (list?.length ? list : [video]).slice(0, MAX_QUEUE);
      const index = Math.max(0, queue.findIndex((item) => item.id === video.id));
      setState((s) => ({ ...s, mode: "yt", video, playing: true, queue, index }));
      void rememberPlay(video);
    },
    [rememberPlay],
  );

  const toggle = useCallback(() => {
    const current = stateRef.current;
    if (current.mode === "ambient") {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        audio.volume = current.volume;
        void audio.play().catch(() => {});
        setState((s) => ({ ...s, playing: true }));
      } else {
        audio.pause();
        setState((s) => ({ ...s, playing: false }));
      }
    } else if (current.mode === "yt") {
      setState((s) => ({ ...s, playing: !s.playing }));
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    try {
      playerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
    loadedIdRef.current = null;
    endedRef.current = false;
    setState((s) => ({ ...s, mode: "off", playing: false, video: null, queue: [], index: 0 }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.min(1, Math.max(0, volume));
    setState((s) => ({ ...s, volume: clamped }));
    if (audioRef.current) audioRef.current.volume = clamped;
    playerRef.current?.setVolume(Math.round(clamped * 100));
  }, []);

  const next = useCallback(() => step(1), [step]);
  const previous = useCallback(() => step(-1), [step]);
  const jumpTo = useCallback(
    (index: number) => {
      const { queue, index: current } = stateRef.current;
      const target = Math.min(Math.max(0, index), queue.length - 1);
      if (!queue[target]) return;
      if (target === current) {
        replay();
        return;
      }
      setState((s) => ({ ...s, mode: "yt", video: s.queue[target], index: target, playing: true }));
    },
    [replay],
  );
  const cycleRepeat = useCallback(() => {
    setState((s) => ({ ...s, repeat: s.repeat === "all" ? "one" : s.repeat === "one" ? "off" : "all" }));
  }, []);

  useEffect(() => () => playerRef.current?.destroy(), []);

  return (
    <MusicCtx.Provider
      value={{
        ...state,
        recents,
        popular,
        attachHolder,
        playAmbient,
        playVideo,
        toggle,
        stop,
        setVolume,
        next,
        previous,
        jumpTo,
        cycleRepeat,
      }}
    >
      {children}
      <audio ref={audioRef} src="/assets/music.mp3" loop preload="none" />
    </MusicCtx.Provider>
  );
}

const REPEAT_LABEL: Record<RepeatMode, string> = {
  all: "Repeat the list",
  one: "Repeat this song",
  off: "Repeat off",
};

function Transport() {
  const music = useMusic();
  const hasQueue = music.queue.length > 1;
  const repeatIcon = music.repeat === "one" ? "repeat-one" : "repeat";
  return (
    <>
      <button
        className="player-open"
        title="Previous"
        aria-label="Previous"
        disabled={!hasQueue}
        onClick={music.previous}
      >
        <Icon name="prev" />
      </button>
      <button
        className={`player-open${music.repeat !== "off" ? " on" : ""}`}
        title={REPEAT_LABEL[music.repeat]}
        aria-label={REPEAT_LABEL[music.repeat]}
        onClick={music.cycleRepeat}
      >
        <Icon name={repeatIcon} />
      </button>
      <button
        className="player-open"
        title="Next"
        aria-label="Next"
        disabled={!hasQueue}
        onClick={music.next}
      >
        <Icon name="next" />
      </button>
    </>
  );
}

export function MusicMini() {
  const music = useMusic();
  const [open, setOpen] = useState(false);
  const isYT = music.mode === "yt" && Boolean(music.video);

  return (
    <div className="player">
      <div className="yt-frame" style={{ display: isYT ? "block" : "none" }}>
        <div className="yt-holder" ref={music.attachHolder} />
        {music.video && !music.playing && <img className="yt-thumb" src={music.video.thumb} alt="" />}
      </div>
      <div className="player-row">
        <div className="player-info">
          {isYT ? (
            <>
              <b>{music.video?.title}</b>
              <span>{music.video?.author || "YouTube"}</span>
            </>
          ) : (
            <>
              <b>{music.mode === "ambient" && music.playing ? "ambience" : "a gentle place"}</b>
              <span>{music.mode === "ambient" ? (music.playing ? "playing" : "paused") : "for ambient"}</span>
            </>
          )}
        </div>
        <button
          className="player-btn"
          title="Play / pause"
          aria-label="Play / pause"
          onClick={() => {
            if (music.mode === "off") music.playAmbient();
            else music.toggle();
          }}
        >
          <Icon name={music.playing ? "pause" : "play"} />
        </button>
        <button className="player-open" title="Music" aria-label="Music" onClick={() => setOpen(true)}>
          <Icon name="music" />
        </button>
      </div>
      {isYT && (
        <div className="player-transport">
          <Transport />
        </div>
      )}
      {open && <MusicModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function MusicModal({ onClose }: { onClose: () => void }) {
  const music = useMusic();
  const [tab, setTab] = useState<"ambient" | "yt">("ambient");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoInfo[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (tab === "yt") searchRef.current?.focus();
  }, [tab]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    setError("");
    setLoading(true);

    const id = parseYouTubeId(value);
    try {
      if (id) {
        let video: VideoInfo = {
          id,
          title: "YouTube video",
          author: "",
          thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        };
        const res = await fetch(`/api/music/resolve?url=${encodeURIComponent(watchUrl(id))}`);
        if (res.ok) video = (await res.json()) as VideoInfo;
        music.playVideo(video);
        setQuery("");
        return;
      }

      const res = await fetch(`/api/music/search?q=${encodeURIComponent(value)}`);
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
      setLoading(false);
    }
  };

  const isYT = music.mode === "yt" && Boolean(music.video);
  const looksLikeLink = Boolean(parseYouTubeId(query));

  const trackList = (label: string, videos: VideoInfo[], box = "recents") =>
    videos.length > 0 && (
      <div className={box}>
        <h4>{label}</h4>
        {videos.map((video) => (
          <button key={video.id} className="recent" onClick={() => music.playVideo(video, videos)}>
            <img src={video.thumb} alt="" />
            <span>
              <b>{video.title}</b>
              {video.author ? <em>{video.author}</em> : null}
            </span>
          </button>
        ))}
      </div>
    );

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal music-modal" role="dialog" aria-modal="true" aria-label="Music">
        <button className="modal-x" onClick={onClose} title="Close" aria-label="Close">
          <Icon name="close" />
        </button>
        <h2>Music</h2>
        <p className="sub">Something soft, or something yours.</p>

        <div className="music-now">
          {isYT && music.video ? (
            <>
              <img className="music-now-thumb" src={music.video.thumb} alt="" />
              <div className="music-now-info">
                <b>{music.video.title}</b>
                <span>
                  {music.video.author || "YouTube"}
                  {music.queue.length > 1 ? ` · ${music.index + 1} of ${music.queue.length}` : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="music-now-thumb ambience-art">
                <Icon name="music" />
              </div>
              <div className="music-now-info">
                <b>{music.mode === "ambient" ? "Ambience" : "Nothing playing"}</b>
                <span>
                  {music.mode === "ambient"
                    ? music.playing
                      ? "playing softly"
                      : "paused"
                    : "Pick something below."}
                </span>
              </div>
            </>
          )}
          <div className="music-transport">
            <Transport />
          </div>
          {music.mode !== "off" && (
            <button className="player-btn" onClick={music.toggle} title="Play / pause" aria-label="Play / pause">
              <Icon name={music.playing ? "pause" : "play"} />
            </button>
          )}
        </div>

        <div className="tabs">
          <button className={tab === "ambient" ? "on" : ""} onClick={() => setTab("ambient")}>
            Ambience
          </button>
          <button className={tab === "yt" ? "on" : ""} onClick={() => setTab("yt")}>
            YouTube
          </button>
        </div>

        {tab === "ambient" ? (
          <div className="ambience">
            <p className="hint">A soft loop that plays while you tend your garden.</p>
            <button className="btn btn-primary" onClick={music.playAmbient}>
              <Icon name="play" /> {music.mode === "ambient" && music.playing ? "Restart ambience" : "Play ambience"}
            </button>
            <p className="hint">
              Add <code>public/assets/music.mp3</code> to hear it.
            </p>
          </div>
        ) : (
          <div className="yt-pane">
            <form className="yt-form" onSubmit={submit}>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search YouTube or paste a link"
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="search"
              />
              <button className="btn btn-primary" disabled={loading || !query.trim()}>
                {loading ? "…" : looksLikeLink ? "Play" : "Search"}
              </button>
            </form>
            {error && <p className="music-error">{error}</p>}
            {trackList("Results", results, "recents music-results")}
            {!loading && searched && results.length === 0 && !error && (
              <p className="hint">Nothing found for that. Try different words, or paste a link.</p>
            )}
            {music.queue.length > 1 && (
              <div className="recents music-queue">
                <h4>Up next</h4>
                {music.queue.map((video, index) => (
                  <button
                    key={`${video.id}-${index}`}
                    className={`recent${index === music.index ? " on" : ""}`}
                    onClick={() => music.jumpTo(index)}
                  >
                    <img src={video.thumb} alt="" />
                    <span>
                      <b>{video.title}</b>
                      {video.author ? <em>{video.author}</em> : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {trackList("Recent", music.recents)}
            {trackList("Popular in the garden", music.popular)}
          </div>
        )}

        <div className="music-controls">
          <label className="volume">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.volume}
              onChange={(event) => music.setVolume(Number(event.target.value))}
            />
          </label>
          {music.mode !== "off" && (
            <button className="btn btn-ghost" onClick={music.stop}>
              Stop
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
