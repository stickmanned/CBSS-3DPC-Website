"use client";

import Image from "next/image";
import { type CSSProperties, useRef } from "react";

const LAYER_COUNT = 28;
const LAYER_INTERVAL_MS = 72;
const MATERIAL_START_MS = 1370;

const layers = Array.from({ length: LAYER_COUNT }, (_, index) => index);
const blueprintSections = Array.from({ length: 15 }, (_, index) => 54 + index * 57);
const depthOffsets = [-3, -1.5, 0, 1.5, 3];

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
      onPointerCancel={resetPointer}
      aria-hidden="true"
    >
      <span className="layer-stage__blueprint-bed" />

      <div className="layer-stage__plane">
        <div className="layer-stage__object">
          <span className="layer-stage__shadow" />

          <svg
            className="layer-stage__wireframe"
            viewBox="0 0 699 902"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <mask
                id="layer-stage-logo-mask"
                className="layer-stage__logo-mask"
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="699"
                height="902"
              >
                <image href="/img/logo.png" width="699" height="902" />
              </mask>
              <filter
                id="layer-stage-contour"
                x="-12%"
                y="-12%"
                width="124%"
                height="124%"
                colorInterpolationFilters="sRGB"
              >
                <feMorphology
                  in="SourceAlpha"
                  operator="dilate"
                  radius="2.25"
                  result="outer-expanded"
                />
                <feComposite
                  in="outer-expanded"
                  in2="SourceAlpha"
                  operator="out"
                  result="outer-edge"
                />
                <feMorphology
                  in="SourceAlpha"
                  operator="erode"
                  radius="1.75"
                  result="inner-eroded"
                />
                <feComposite
                  in="SourceAlpha"
                  in2="inner-eroded"
                  operator="out"
                  result="inner-edge"
                />
                <feMerge result="contour-edges">
                  <feMergeNode in="outer-edge" />
                  <feMergeNode in="inner-edge" />
                </feMerge>
                <feFlood floodColor="#d9efff" result="contour-color" />
                <feComposite in="contour-color" in2="contour-edges" operator="in" />
              </filter>
            </defs>

            <g className="layer-stage__blueprint-guides">
              <line
                className="layer-stage__datum"
                x1="349.5"
                y1="18"
                x2="349.5"
                y2="884"
              />
              <line
                className="layer-stage__datum"
                x1="18"
                y1="451"
                x2="681"
                y2="451"
              />
              <circle className="layer-stage__datum-ring" cx="349.5" cy="451" r="13" />
              <circle className="layer-stage__datum-ring" cx="349.5" cy="451" r="3" />
              <path
                className="layer-stage__dimension"
                d="M 28 52 V 850 M 18 52 H 38 M 18 850 H 38"
              />
              <path
                className="layer-stage__dimension"
                d="M 70 28 H 629 M 70 18 V 38 M 629 18 V 38"
              />
            </g>

            <image
              href="/img/logo.png"
              width="699"
              height="902"
              className="layer-stage__blueprint-ghost"
            />

            <image
              href="/img/logo.png"
              width="699"
              height="902"
              className="layer-stage__contour"
              filter="url(#layer-stage-contour)"
            />

            <g mask="url(#layer-stage-logo-mask)">
              {blueprintSections.map((y, index) => (
                <line
                  key={y}
                  className="layer-stage__wire-line"
                  x1="0"
                  y1={y}
                  x2="699"
                  y2={y}
                  pathLength="1"
                  style={{
                    animationDelay: `${360 + (blueprintSections.length - index - 1) * 50}ms`,
                  }}
                />
              ))}
            </g>

            <line
              className="layer-stage__draft-sweep"
              x1="0"
              y1="0"
              x2="0"
              y2="902"
            />
          </svg>

          <div className="layer-stage__turntable">
            <Image
              src="/img/logo.png"
              alt=""
              width={699}
              height={902}
              className="layer-stage__material layer-stage__material--front"
              draggable={false}
              priority
              unoptimized
            />

            {depthOffsets.map((depth) => (
              <Image
                key={depth}
                src="/img/logo.png"
                alt=""
                width={699}
                height={902}
                className="layer-stage__material layer-stage__material--depth"
                draggable={false}
                style={{ transform: `translateZ(${depth}px)` }}
                unoptimized
              />
            ))}

            <Image
              src="/img/logo.png"
              alt=""
              width={699}
              height={902}
              className="layer-stage__material layer-stage__material--back"
              draggable={false}
              unoptimized
            />
          </div>

          <div className="layer-stage__passes">
            {layers.map((index) => {
              const style = {
                "--layer-delay": `${MATERIAL_START_MS + index * LAYER_INTERVAL_MS}ms`,
                bottom: `${(index / LAYER_COUNT) * 100}%`,
                height: `${100 / LAYER_COUNT}%`,
              } as CSSProperties;

              return (
                <span
                  key={index}
                  className={`layer-stage__pass${index % 2 ? " layer-stage__pass--reverse" : ""}`}
                  style={style}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
