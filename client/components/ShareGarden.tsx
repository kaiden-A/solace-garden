"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export function ShareGarden({
  image,
  onClose,
}: {
  image: { url: string; file: File };
  onClose: () => void;
}) {
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

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [image.file] });

  const share = async () => {
    try {
      await navigator.share({ files: [image.file], title: "My garden" });
    } catch {
      /* the sheet was dismissed */
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal share-modal" role="dialog" aria-modal="true" aria-label="Share your garden">
        <button className="modal-x" onClick={onClose} title="Close" aria-label="Close">
          <Icon name="close" />
        </button>
        <h2>Your garden</h2>
        <p className="sub">A picture of everything you&apos;ve grown.</p>
        <img className="share-image" src={image.url} alt="Your garden" />
        <div className="share-actions">
          <a className="btn btn-primary" href={image.url} download="solace-garden.png">
            <Icon name="download" /> Download
          </a>
          {canShare && (
            <button className="btn btn-ghost" onClick={share}>
              <Icon name="share" /> Share
            </button>
          )}
        </div>
        {!canShare && (
          <p className="share-note">This browser has no share sheet — save the picture instead.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
