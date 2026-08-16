"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FilamentColor } from "../../lib/filament-colors";
import type { BoundingBoxMm, ModelPart, PreviewMetadata } from "./types";

type PreviewState = "parsing" | "ready" | "fallback" | "error";

/* The colour a model renders in before any filament is chosen. */
const UNPAINTED = 0x213366;

/* Past this many parts the assignment panel stops being a control and starts
   being a wall of rows. Bigger models still get painted — round-robin through
   the chosen colours — they just do not get per-part pickers. */
const MAX_ASSIGNABLE_PARTS = 12;

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
  const hostRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef<(degrees: number) => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);
  const paintRef = useRef<((assignment: Record<string, number>) => void) | null>(null);
  const colorsRef = useRef(colors);
  const repaintRef = useRef(onRepaint);
  const [state, setState] = useState<PreviewState>("parsing");
  const [dimensions, setDimensions] = useState<BoundingBoxMm | null>(null);
  const [angle, setAngle] = useState(0);
  const [parts, setParts] = useState<ModelPart[]>([]);
  const [assignment, setAssignment] = useState<Record<string, number>>({});

  /* Read through refs inside the build effect so choosing a colour repaints
     the existing scene instead of tearing down WebGL and re-parsing the file.
     Synced in an effect, not during render, and declared before the build
     effect so it is always the first to run. */
  useEffect(() => {
    colorsRef.current = colors;
    repaintRef.current = onRepaint;
  });

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

      const paint = (current: Record<string, number>) => {
        const chosen = colorsRef.current;
        paintable.forEach((part, index) => {
          const target = chosen.length
            ? chosen[(current[part.id] ?? index % chosen.length) % chosen.length]
            : null;
          part.material.color.setHex(target ? renderColorOf(target) : UNPAINTED);
        });
      };
      paint({});
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

        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
        const largestDimension = Math.max(size.x, size.y, size.z);
        const distance = Math.max(
          largestDimension * 1.8,
          largestDimension / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.35,
        );
        camera.position.set(distance * 0.72, distance * 0.52, distance);
        camera.near = Math.max(0.01, distance / 1000);
        camera.far = distance * 20;
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
        renderer.domElement.className = "block h-full w-full";
        renderer.domElement.setAttribute("aria-hidden", "true");
        previewHost.replaceChildren(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.autoRotateSpeed = 1.4;
        controls.target.set(0, 0, 0);
        controls.update();
        controls.saveState();

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updateMotion = () => {
          controls.autoRotate = !reducedMotion.matches;
        };
        updateMotion();
        reducedMotion.addEventListener("change", updateMotion);

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

        rotateRef.current = (degrees) => {
          modelRoot.rotation.y += (degrees * Math.PI) / 180;
          setAngle((current) => {
            const next = Math.round(current + degrees);
            return ((next % 360) + 360) % 360;
          });
          renderer.render(scene, camera);
        };
        resetRef.current = () => {
          modelRoot.rotation.set(0, 0, 0);
          controls.reset();
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
        paintRef.current = (current) => {
          paint(current);
          renderer.render(scene, camera);
          repaintRef.current?.(captureThumbnail());
        };

        renderer.render(scene, camera);
        setState("ready");
        onReady({ bboxMm, thumbnail: captureThumbnail(), webglAvailable: true });

        cleanupPreview = () => {
          paintRef.current = null;
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          reducedMotion.removeEventListener("change", updateMotion);
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
    paintRef.current?.(assignment);
  }, [assignment, colors, parts]);

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
      className="overflow-hidden rounded-[var(--radius-card)] border border-mist bg-cloud"
      role="group"
      aria-label={`Model preview for ${file.name}`}
      aria-describedby="model-preview-instructions model-preview-angle"
      tabIndex={state === "ready" ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-64 w-full sm:h-80">
        <div ref={hostRef} className="absolute inset-0" />
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
          ) : parts.length > MAX_ASSIGNABLE_PARTS ? (
            <p className="text-sm text-slate">
              This model has {parts.length} parts — too many to assign one by
              one, so the preview cycles through your {colors.length} colours in
              order. Tell the club in the notes if specific parts need specific
              colours.
            </p>
          ) : (
            <>
              <p className="font-display text-sm font-bold text-ink">
                Which colour goes where
              </p>
              <ul className="mt-3 grid gap-2">
                {parts.map((part, index) => {
                  const current = (assignment[part.id] ?? index % colors.length) % colors.length;
                  return (
                    <li
                      key={part.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border-2 border-ink/10 bg-white px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {part.name}
                      </span>
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
                              onClick={() => assignPart(part.id, colorIndex)}
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
