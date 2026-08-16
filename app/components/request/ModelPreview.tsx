"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FilamentColor } from "../../lib/filament-colors";
import type { BoundingBoxMm, ModelPart, PreviewMetadata } from "./types";

type PreviewState = "parsing" | "ready" | "fallback" | "error";

/* The colour a model renders in before any filament is chosen. */
const UNPAINTED = 0x213366;

/* A gradient filament has no single renderable colour, so the preview uses its
   first stop. The panel still names it, so nobody thinks the spool is solid. */
function renderColorOf(color: FilamentColor) {
  return Number.parseInt(color.hex.replace("#", ""), 16);
}

function roundedDimensions(size: { x: number; y: number; z: number }): BoundingBoxMm {
  const round = (value: number) => Math.max(0.01, Math.round(value * 100) / 100);
  return { x: round(size.x), y: round(size.y), z: round(size.z) };
}

export default function ModelPreview({
  file,
  colors,
  onReady,
  onError,
  onRepaint,
}: {
  file: File;
  /** The filaments chosen in the colour step, in print order. */
  colors: readonly FilamentColor[];
  onReady: (metadata: PreviewMetadata) => void;
  onError: (message: string) => void;
  /** A repainted thumbnail, so the club sees the model as it was arranged. */
  onRepaint?: (thumbnail: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef<(degrees: number) => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);
  const paintRef = useRef<((assignment: Record<string, number>, activeId: string | null) => void) | null>(null);
  const colorsRef = useRef(colors);
  const repaintRef = useRef(onRepaint);
  const [state, setState] = useState<PreviewState>("parsing");
  const [dimensions, setDimensions] = useState<BoundingBoxMm | null>(null);
  const [angle, setAngle] = useState(0);
  const [parts, setParts] = useState<ModelPart[]>([]);
  const [assignment, setAssignment] = useState<Record<string, number>>({});
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const partsRef = useRef(parts);
  const selectedPartIdRef = useRef(selectedPartId);
  const onPartClickRef = useRef<(partId: string) => void>(() => undefined);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement && !isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  /* Read through refs inside the build effect so choosing a colour repaints
     the existing scene instead of tearing down WebGL and re-parsing the file.
     Synced in an effect, not during render, and declared before the build
     effect so it is always the first to run. */
  useEffect(() => {
    colorsRef.current = colors;
    repaintRef.current = onRepaint;
    partsRef.current = parts;
    selectedPartIdRef.current = selectedPartId;
  });

  const handlePartClick = useCallback((partId: string) => {
    setSelectedPartId(partId);

    const chosen = colorsRef.current;
    if (chosen.length > 0) {
      setAssignment((current) => {
        const partIndex = partsRef.current.findIndex((p) => p.id === partId);
        const curIdx =
          (current[partId] ?? (partIndex >= 0 ? partIndex % chosen.length : 0)) %
          chosen.length;
        const nextIdx = chosen.length > 1 ? (curIdx + 1) % chosen.length : curIdx;
        return { ...current, [partId]: nextIdx };
      });
    }

    // Scroll the matching part into view in the list and focus its button
    const rowEl = document.getElementById(`part-row-${partId}`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const currentSwatch =
        rowEl.querySelector<HTMLButtonElement>("button.is-current") ||
        rowEl.querySelector<HTMLButtonElement>("button");
      currentSwatch?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    onPartClickRef.current = handlePartClick;
  }, [handlePartClick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const previewHost = host;

    let cancelled = false;
    let cleanupPreview = () => undefined;

    setState("parsing");
    setDimensions(null);
    setAngle(0);
    setParts([]);
    setAssignment({});
    setSelectedPartId(null);
    paintRef.current = null;
    previewHost.replaceChildren();

    async function buildPreview() {
      const [THREE, { STLLoader }, { ThreeMFLoader }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/STLLoader.js"),
        import("three/examples/jsm/loaders/3MFLoader.js"),
      ]);
      const bytes = await file.arrayBuffer();
      if (cancelled) return;

      const extension = file.name.split(".").pop()?.toLowerCase();
      let object: import("three").Object3D;
      let vertexCount = 0;

      if (extension === "stl") {
        const geometry = new STLLoader().parse(bytes);
        const positions = geometry.getAttribute("position");
        vertexCount = positions?.count ?? 0;
        if (vertexCount < 3) throw new Error("empty-model");
        geometry.computeVertexNormals();
        object = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: UNPAINTED, roughness: 0.72, metalness: 0.04 }),
        );
      } else if (extension === "3mf") {
        object = new ThreeMFLoader().parse(bytes);
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            vertexCount += child.geometry.getAttribute("position")?.count ?? 0;
          }
        });
        if (vertexCount < 3) throw new Error("empty-model");
      } else {
        throw new Error("unsupported-model");
      }

      const bounds = new THREE.Box3().setFromObject(object);
      const size = bounds.getSize(new THREE.Vector3());
      if (
        bounds.isEmpty() ||
        ![size.x, size.y, size.z].every(Number.isFinite) ||
        Math.min(size.x, size.y, size.z) <= 0
      ) {
        throw new Error("empty-model");
      }

      const bboxMm = roundedDimensions(size);
      setDimensions(bboxMm);

      /* Every mesh becomes a part, and a mesh with several material slots
         becomes one part per slot — that is how a 3MF carries a multi-colour
         object. The loaded materials are replaced with our own so that a
         model arriving with baked-in colours still shows the club's filament
         rather than whatever the designer exported. */
      const paintable: Array<{ id: string; name: string; material: import("three").MeshStandardMaterial }> = [];
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const slots = Array.isArray(child.material) ? child.material.length : 1;
        const replacements = Array.from({ length: slots }, () =>
          new THREE.MeshStandardMaterial({ color: UNPAINTED, roughness: 0.72, metalness: 0.04 }),
        );
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((old) => old.dispose());
        child.material = slots > 1 ? replacements : replacements[0];

        replacements.forEach((material, slot) => {
          const base = child.name?.trim() || `Part ${paintable.length + 1}`;
          paintable.push({
            id: `${child.uuid}:${slot}`,
            name: slots > 1 ? `${base} · section ${slot + 1}` : base,
            material,
          });
        });
      });

      const paint = (current: Record<string, number>, activeId: string | null) => {
        const chosen = colorsRef.current;
        paintable.forEach((part, index) => {
          const target = chosen.length
            ? chosen[(current[part.id] ?? index % chosen.length) % chosen.length]
            : null;
          part.material.color.setHex(target ? renderColorOf(target) : UNPAINTED);
          if (part.id === activeId) {
            part.material.emissive.setHex(0x28384d);
            part.material.emissiveIntensity = 0.5;
          } else {
            part.material.emissive.setHex(0x000000);
            part.material.emissiveIntensity = 0;
          }
        });
      };
      paint({}, null);
      setParts(paintable.map(({ id, name }) => ({ id, name })));

      try {
        const [{ OrbitControls }] = await Promise.all([
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
        if (cancelled) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf2f5fa);

        const modelRoot = new THREE.Group();
        const center = bounds.getCenter(new THREE.Vector3());
        object.position.sub(center);
        modelRoot.add(object);
        scene.add(modelRoot);

        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const radius = Math.max(1, sphere.radius);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
        const initialWidth = Math.max(1, previewHost.clientWidth);
        const initialHeight = Math.max(1, previewHost.clientHeight);
        const initialAspect = initialWidth / initialHeight;
        camera.aspect = initialAspect;

        const fovYRad = (camera.fov * Math.PI) / 180;
        const fovXRad = 2 * Math.atan(Math.tan(fovYRad / 2) * initialAspect);
        const minFovRad = Math.min(fovYRad, fovXRad);
        const fitDistance = (radius / Math.sin(minFovRad / 2)) * 1.12;

        const elev = (28 * Math.PI) / 180;
        const azim = (45 * Math.PI) / 180;
        camera.position.set(
          fitDistance * Math.cos(elev) * Math.sin(azim),
          fitDistance * Math.sin(elev),
          fitDistance * Math.cos(elev) * Math.cos(azim),
        );
        camera.near = Math.max(0.01, fitDistance / 500);
        camera.far = fitDistance * 50;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        scene.add(new THREE.HemisphereLight(0xffffff, 0x213366, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(3, 5, 4);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffc93c, 0.8);
        fillLight.position.set(-4, 1, -2);
        scene.add(fillLight);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "block h-full w-full cursor-grab";
        renderer.domElement.setAttribute("aria-hidden", "true");
        previewHost.replaceChildren(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controls.autoRotate = false;
        controls.minDistance = radius * 0.2;
        controls.maxDistance = fitDistance * 6;
        controls.maxPolarAngle = Math.PI - 0.05;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        };
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
        controls.target.set(0, 0, 0);
        controls.update();
        controls.saveState();

        const resize = () => {
          const width = Math.max(1, previewHost.clientWidth);
          const height = Math.max(1, previewHost.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          renderer.render(scene, camera);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(previewHost);
        resize();

        let frame = 0;
        const render = () => {
          controls.update();
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        render();

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        function getIntersectedPartId(event: PointerEvent): string | null {
          const rect = renderer.domElement.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return null;
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(modelRoot.children, true);
          const hit = intersects.find((i) => i.object instanceof THREE.Mesh);
          if (!hit || !(hit.object instanceof THREE.Mesh)) return null;

          const mesh = hit.object;
          let slotIndex = 0;
          if (Array.isArray(mesh.material)) {
            slotIndex = hit.face?.materialIndex ?? 0;
          }
          return `${mesh.uuid}:${slotIndex}`;
        }

        let pointerDownX = 0;
        let pointerDownY = 0;
        let pointerDownTime = 0;

        const onPointerDown = (e: PointerEvent) => {
          pointerDownX = e.clientX;
          pointerDownY = e.clientY;
          pointerDownTime = Date.now();
        };

        const onPointerMove = (e: PointerEvent) => {
          if (e.buttons > 0) return;
          const partId = getIntersectedPartId(e);
          renderer.domElement.style.cursor = partId ? "pointer" : "grab";
        };

        const onPointerUp = (e: PointerEvent) => {
          const dx = Math.abs(e.clientX - pointerDownX);
          const dy = Math.abs(e.clientY - pointerDownY);
          const dt = Date.now() - pointerDownTime;
          if (dx <= 4 && dy <= 4 && dt < 600) {
            const partId = getIntersectedPartId(e);
            if (partId) {
              onPartClickRef.current(partId);
            }
          }
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);

        rotateRef.current = (degrees) => {
          const angleRad = (degrees * Math.PI) / 180;
          const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
          camera.position.addVectors(controls.target, offset);
          camera.lookAt(controls.target);
          controls.update();
          setAngle((current) => {
            const next = Math.round(current + degrees);
            return ((next % 360) + 360) % 360;
          });
          renderer.render(scene, camera);
        };
        resetRef.current = () => {
          controls.target.set(0, 0, 0);
          camera.position.set(0, radius * 0.15, fitDistance * 0.95);
          camera.lookAt(0, 0, 0);
          controls.update();
          setAngle(0);
          renderer.render(scene, camera);
        };

        const captureThumbnail = () => {
          const thumbnailCanvas = document.createElement("canvas");
          thumbnailCanvas.width = 360;
          thumbnailCanvas.height = 240;
          const thumbnailContext = thumbnailCanvas.getContext("2d");
          if (!thumbnailContext) return null;
          thumbnailContext.drawImage(renderer.domElement, 0, 0, 360, 240);
          return thumbnailCanvas.toDataURL("image/webp", 0.82);
        };

        /* Repainting re-renders and re-captures rather than rebuilding: the
           thumbnail the club receives is the model in the colours the
           requester actually arranged. */
        paintRef.current = (current, activeId) => {
          paint(current, activeId);
          renderer.render(scene, camera);
          repaintRef.current?.(captureThumbnail());
        };

        renderer.render(scene, camera);
        setState("ready");
        onReady({ bboxMm, thumbnail: captureThumbnail(), webglAvailable: true });

        cleanupPreview = () => {
          paintRef.current = null;
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          controls.dispose();
          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            child.geometry.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => material.dispose());
          });
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      } catch {
        if (cancelled) return;
        setState("fallback");
        onReady({ bboxMm, thumbnail: null, webglAvailable: false });
      }
    }

    buildPreview().catch((error: unknown) => {
      if (cancelled) return;
      const message =
        error instanceof Error && error.message === "empty-model"
          ? "This model does not contain usable geometry. Choose a different STL or 3MF file."
          : "We could not read this model. It may be corrupt or use an unsupported 3MF feature.";
      setState("error");
      onError(message);
    });

    return () => {
      cancelled = true;
      rotateRef.current = () => undefined;
      resetRef.current = () => undefined;
      cleanupPreview();
    };
  }, [file, onError, onReady]);

  /* Colour choices and part assignments both land here. The scene is already
     built, so this only pushes colours onto existing materials. */
  useEffect(() => {
    paintRef.current?.(assignment, selectedPartId);
  }, [assignment, colors, parts, selectedPartId]);

  function assignPart(partId: string, colorIndex: number) {
    setAssignment((current) => ({ ...current, [partId]: colorIndex }));
  }

  function onSwatchKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    partId: string,
    currentIndex: number,
  ) {
    if (colors.length < 2) return;
    const offset = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (!offset) return;
    event.preventDefault();
    const next = (currentIndex + offset + colors.length) % colors.length;
    assignPart(partId, next);
    (event.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (state !== "ready") return;
    if (event.key === "ArrowLeft") rotateRef.current(-15);
    else if (event.key === "ArrowRight") rotateRef.current(15);
    else if (event.key === "Home") resetRef.current();
    else return;
    event.preventDefault();
  }

  const dimensionsText = dimensions
    ? `${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm`
    : "Calculating dimensions";

  return (
    <div
      ref={containerRef}
      className={`transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-cloud p-4 sm:p-6"
          : "overflow-hidden rounded-[var(--radius-card)] border border-mist bg-cloud"
      }`}
      role="group"
      aria-label={`Model preview for ${file.name}`}
      aria-describedby="model-preview-instructions model-preview-angle"
      tabIndex={state === "ready" ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      <div className={`relative w-full transition-all ${isFullscreen ? "min-h-[55vh] flex-1" : "h-64 sm:h-80"}`}>
        <div ref={hostRef} className="absolute inset-0" />

        {/* Fullscreen button on top left corner */}
        {state === "ready" && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute left-3 top-3 z-20 grid size-10 place-items-center rounded-[var(--radius-chip)] border-2 border-ink/20 bg-white/90 text-ink shadow-sm backdrop-blur transition-all hover:border-ink hover:bg-white hover:scale-105 active:scale-95"
            aria-label={isFullscreen ? "Exit fullscreen preview" : "Enter fullscreen preview"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen preview"}
          >
            {isFullscreen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
            )}
          </button>
        )}

        {state === "parsing" && (
          <span
            className="absolute inset-0 grid place-items-center text-sm font-semibold text-navy"
            role="status"
          >
            <span className="flex items-center gap-3">
              <span className="spinner" aria-hidden="true" /> Reading model geometry…
            </span>
          </span>
        )}
        {state === "error" && (
          <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-slate">
            Preview unavailable for this file.
          </span>
        )}
      </div>


      {/* Colour assignment. Only appears once the preview is live and at least
          one filament is chosen — it is a consequence of the colour step, not
          a control that sits there empty asking to be filled in. */}
      {(state === "ready" || state === "fallback") && colors.length > 0 && (
        <div className="border-t-2 border-ink/10 bg-cloud/60 p-4">
          {colors.length === 1 || parts.length <= 1 ? (
            <p className="text-sm text-slate">
              Previewing in{" "}
              <span className="font-display font-bold text-ink">
                {colors[assignment[parts[0]?.id ?? ""] ?? 0]?.name ?? colors[0].name}
              </span>
              {colors.length > 1 && parts.length <= 1
                ? " — this model is one part, so it prints in a single colour."
                : "."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold text-ink">
                    Which colour goes where
                  </p>
                  <p className="mt-0.5 text-xs text-slate">
                    Click any part in the 3D model to cycle its colour and highlight it below.
                  </p>
                </div>
                {parts.length > 1 && (
                  <span className="shrink-0 rounded-[var(--radius-chip)] border border-ink/10 bg-white px-2 py-0.5 text-xs font-semibold text-slate">
                    {parts.length} parts
                  </span>
                )}
              </div>
              <ul className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1">
                {parts.map((part, index) => {
                  const current = (assignment[part.id] ?? index % colors.length) % colors.length;
                  const isSelected = selectedPartId === part.id;
                  return (
                    <li
                      id={`part-row-${part.id}`}
                      key={part.id}
                      onClick={() => setSelectedPartId(part.id)}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border-2 px-3 py-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-ink bg-signal/20 ring-2 ring-signal"
                          : "border-ink/10 bg-white hover:border-ink/30"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">
                          {part.name}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 rounded-[var(--radius-chip)] bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <div
                        role="radiogroup"
                        aria-label={`Colour for ${part.name}`}
                        onKeyDown={(event) => onSwatchKeyDown(event, part.id, current)}
                        className="flex shrink-0 gap-1.5"
                      >
                        {colors.map((color, colorIndex) => {
                          const checked = colorIndex === current;
                          return (
                            <button
                              key={color.slug}
                              type="button"
                              role="radio"
                              aria-checked={checked}
                              tabIndex={checked ? 0 : -1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartId(part.id);
                                assignPart(part.id, colorIndex);
                              }}
                              className={`part-swatch${checked ? " is-current" : ""}`}
                              style={{ background: color.swatch ?? color.hex }}
                            >
                              <span className="sr-only">
                                {color.name}, colour {colorIndex + 1}
                              </span>
                              <span aria-hidden="true" className="part-swatch__index">
                                {colorIndex + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="border-t border-mist bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink">{file.name}</p>
          <p className="mt-1 text-sm text-slate">
            {dimensionsText}
          </p>
          {state === "fallback" && (
            <p className="mt-2 text-sm text-slate" role="status">
              Interactive preview is unavailable, but the model was read successfully and can still be uploaded.
            </p>
          )}
        </div>

        {state === "ready" && (
          <div className="mt-4 flex gap-2 sm:mt-0" aria-label="Model rotation controls">
            <button
              type="button"
              onClick={() => rotateRef.current(-15)}
              className="grid size-11 cursor-pointer place-items-center rounded-[var(--radius-chip)] border-2 border-ink/25 bg-white text-ink hover:bg-cloud"
              aria-label="Rotate model left 15 degrees"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => resetRef.current()}
              className="min-h-11 cursor-pointer rounded-[var(--radius-chip)] border-2 border-ink/25 bg-white px-4 font-display text-sm font-bold text-ink hover:bg-cloud"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => rotateRef.current(15)}
              className="grid size-11 cursor-pointer place-items-center rounded-[var(--radius-chip)] border-2 border-ink/25 bg-white text-ink hover:bg-cloud"
              aria-label="Rotate model right 15 degrees"
            >
              →
            </button>
          </div>
        )}
      </div>

      <p id="model-preview-instructions" className="sr-only">
        Drag to inspect the model. Use Left Arrow and Right Arrow to rotate it, or Home to return to the front view.
      </p>
      <p id="model-preview-angle" className="sr-only" aria-live="polite">
        Model rotation {angle} degrees.
      </p>
    </div>
  );
}
