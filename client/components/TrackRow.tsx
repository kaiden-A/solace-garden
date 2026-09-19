"use client";

import type { ReactNode } from "react";
import type { VideoInfo } from "@/lib/music";
import { Icon } from "./Icon";

/** One song row, shared by the music modal and the library page. */
export function TrackRow({
  video,
  onPlay,
  playing = false,
  children,
}: {
  video: VideoInfo;
  onPlay?: () => void;
  playing?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="track-row">
      <button
        className={`recent${playing ? " on" : ""}`}
        onClick={onPlay}
        disabled={!onPlay}
        title={onPlay ? `Play ${video.title}` : video.title}
        aria-label={onPlay ? `Play ${video.title}` : video.title}
      >
        <img src={video.thumb} alt="" />
        <span>
          <b>{video.title}</b>
          {video.author ? <em>{video.author}</em> : null}
        </span>
      </button>
      {children ? <div className="track-actions">{children}</div> : null}
    </div>
  );
}

export function TrackAction({
  label,
  icon,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`track-action${className ? ` ${className}` : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
