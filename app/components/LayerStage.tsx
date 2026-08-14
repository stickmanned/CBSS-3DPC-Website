"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import LogoModelCanvas, { type LogoModelHandle } from "./LogoModelCanvas";

const LAYER_COUNT = 30;
const LAYER_INTERVAL_MS = 64;
const MATERIAL_START_MS = 2050;
const BUILD_COMPLETE_MS = 4200;
const MODEL_HALF_DEPTH_PX = 16;
const DEPTH_SLICE_COUNT = 33;
const DRAG_DEGREES_PER_PIXEL = 0.48;
const KEYBOARD_ROTATION_STEP = 15;

type BuildPhase = "blueprint" | "printing" | "ready" | "dragging";
type LayerStyle = CSSProperties & {
  "--layer-delay": string;
};
type DepthStyle = CSSProperties & {
  "--depth-z": string;
  "--depth-tone": string;
};
type ActiveDrag = {
  pointerId: number;
  startX: number;
  startYaw: number;
};

const layers = Array.from({ length: LAYER_COUNT }, (_, index) => index);
const blueprintSections = Array.from({ length: 17 }, (_, index) => 44 + index * 51);
const depthSlices = Array.from({ length: DEPTH_SLICE_COUNT }, (_, index) => {
  const progress = index / (DEPTH_SLICE_COUNT - 1);
  const innerDepth = MODEL_HALF_DEPTH_PX - 1;
  const z = -innerDepth + progress * innerDepth * 2;
  const lightness = Math.round(18 + progress * 8);

  return {
    z,
    tone: `hsl(225 48% ${lightness}%)`,
  };
});

export default function LayerStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<LogoModelHandle>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const yawRef = useRef(0);
  const pendingYawRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<BuildPhase>("blueprint");
  const [modelReady, setModelReady] = useState(false);

  const isReady = phase === "ready" || phase === "dragging";
  const handleModelReady = useCallback(() => setModelReady(true), []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let printingTimer: number | undefined;
    let readyTimer: number | undefined;

    function startBuild() {
      window.clearTimeout(printingTimer);
      window.clearTimeout(readyTimer);

      if (reducedMotion.matches) {
        setPhase("ready");
        return;
      }

      setPhase("blueprint");
      printingTimer = window.setTimeout(() => setPhase("printing"), MATERIAL_START_MS);
      readyTimer = window.setTimeout(() => setPhase("ready"), BUILD_COMPLETE_MS);
    }

    function handleMotionPreference() {
      if (reducedMotion.matches) {
        window.clearTimeout(printingTimer);
        window.clearTimeout(readyTimer);
        setPhase("ready");
      }
    }

    startBuild();
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      window.clearTimeout(printingTimer);
      window.clearTimeout(readyTimer);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function applyYaw(nextYaw: number) {
    yawRef.current = nextYaw;
    pendingYawRef.current = nextYaw;

    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = window.requestAnimationFrame(() => {
      stageRef.current?.style.setProperty("--logo-yaw", `${pendingYawRef.current}deg`);
      modelRef.current?.setYaw(pendingYawRef.current);
      animationFrameRef.current = null;
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isReady || !event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startYaw: yawRef.current,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    if (event.pointerType === "mouse") event.preventDefault();
    setPhase("dragging");
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    applyYaw(drag.startYaw + (event.clientX - drag.startX) * DRAG_DEGREES_PER_PIXEL);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPhase("ready");
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setPhase("ready");
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isReady) return;

    let nextYaw: number | null = null;
    if (event.key === "ArrowLeft") nextYaw = yawRef.current - KEYBOARD_ROTATION_STEP;
    if (event.key === "ArrowRight") nextYaw = yawRef.current + KEYBOARD_ROTATION_STEP;
    if (event.key === "Home") nextYaw = 0;
    if (nextYaw === null) return;

    event.preventDefault();
    applyYaw(nextYaw);
  }

  return (
    <div
      ref={stageRef}
      className="layer-stage"
      role="group"
      aria-label="Rotatable 3D CBSS Printing Club logo"
      aria-describedby="layer-stage-instructions"
      aria-busy={!isReady}
      tabIndex={0}
      data-phase={phase}
      data-ready={isReady ? "true" : "false"}
      data-model-ready={modelReady ? "true" : "false"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
      onDragStart={(event) => event.preventDefault()}
    >
      <p id="layer-stage-instructions" className="sr-only">
        When the model is ready, hold the primary pointer button and drag left or right to
        rotate it. Use the left and right arrow keys to rotate, or Home to return to the
        front view.
      </p>

      <div className="layer-stage__sequence" aria-hidden="true">
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
                <line className="layer-stage__datum" x1="349.5" y1="18" x2="349.5" y2="884" />
                <line className="layer-stage__datum" x1="18" y1="451" x2="681" y2="451" />
                <circle className="layer-stage__datum-ring" cx="349.5" cy="451" r="13" />
                <circle className="layer-stage__datum-ring" cx="349.5" cy="451" r="3" />
                <path className="layer-stage__dimension" d="M 28 52 V 850 M 18 52 H 38 M 18 850 H 38" />
                <path className="layer-stage__dimension" d="M 70 28 H 629 M 70 18 V 38 M 629 18 V 38" />
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
                      animationDelay: `${360 + (blueprintSections.length - index - 1) * 62}ms`,
                    }}
                  />
                ))}
              </g>

              <line className="layer-stage__draft-sweep" x1="0" y1="0" x2="0" y2="902" />
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

              {depthSlices.map(({ z, tone }) => (
                <span
                  key={z}
                  className="layer-stage__material layer-stage__material--depth"
                  style={
                    {
                      "--depth-z": `${z}px`,
                      "--depth-tone": tone,
                    } as DepthStyle
                  }
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

            <LogoModelCanvas ref={modelRef} onReady={handleModelReady} />

            <div className="layer-stage__passes">
              {layers.map((index) => {
                const style = {
                  "--layer-delay": `${MATERIAL_START_MS + index * LAYER_INTERVAL_MS}ms`,
                  bottom: `${(index / LAYER_COUNT) * 100}%`,
                  height: `${100 / LAYER_COUNT}%`,
                } as LayerStyle;

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

    </div>
  );
}
