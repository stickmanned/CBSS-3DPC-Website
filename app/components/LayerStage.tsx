"use client";

import Image from "next/image";
import { useRef } from "react";

const layerWidths = [38, 48, 58, 66, 72, 78, 82, 84, 82, 78, 72, 64, 54, 42];

export default function LayerStage() {
  const stageRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    stage.style.setProperty("--rx", `${-y * 4}deg`);
    stage.style.setProperty("--ry", `${x * 4}deg`);
    stage.style.setProperty("--mx", `${x * 4}px`);
    stage.style.setProperty("--my", `${y * 4}px`);
  }

  function resetPointer() {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--rx", "0deg");
    stage.style.setProperty("--ry", "0deg");
    stage.style.setProperty("--mx", "0px");
    stage.style.setProperty("--my", "0px");
  }

  return (
    <div
      ref={stageRef}
      className="layer-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-hidden="true"
    >
      <div className="layer-stage__plane">
        <div className="layer-stage__meta">
          <span>Build study / CBSS</span>
          <span className="text-signal">Layer 113</span>
        </div>

        <div className="layer-stage__object">
          {layerWidths.map((width, index) => (
            <span
              key={width + index}
              className="layer-stage__slice"
              style={{
                bottom: `${12 + index * 5.65}%`,
                width: `${width}%`,
                animationDelay: `${150 + index * 72}ms`,
              }}
            />
          ))}
          <Image
            src="/img/logo.png"
            alt=""
            width={699}
            height={902}
            className="layer-stage__mark"
            priority
          />
        </div>

        <span className="layer-stage__scan" />
        <p className="layer-stage__axis">X / idea &nbsp; Y / model &nbsp; Z / object</p>
      </div>
    </div>
  );
}
