"use client";

import { useState } from "react";

export default function MockupPage() {
  const [opacity, setOpacity] = useState(0.5);
  const [visible, setVisible] = useState(true);

  return (
    <div className="mockup-dev">
      <div className="mockup-controls">
        <span>Mockup overlay</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
          aria-label="Overlay opacity"
        />
        <button className="btn btn-ghost" onClick={() => setVisible((value) => !value)}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <div className="mockup-stage">
        <iframe src="/garden" className="mockup-frame" title="Garden preview" />
        {visible && (
          <img className="mockup-overlay" src="/mockup.png" style={{ opacity }} alt="Mockup reference" />
        )}
      </div>
    </div>
  );
}
