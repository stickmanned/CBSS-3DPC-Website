"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

type ViewerState = "idle" | "loading" | "parsing" | "ready" | "unsupported" | "error";

export type ModelStats = {
  /** Measured from the verified bytes, not reported by the requester's browser. */
  bboxMm: { x: number; y: number; z: number };
  triangles: number;
  parts: number;
};

/** Shown when the requester left the colour to the club. */
const UNPAINTED = 0x213366;

export type ViewerColor = {
  slug: string;
  name: string;
  /** Render colour. A gradient filament has no single one, so this is its first stop. */
  hex: string;
  swatch?: string;
};

function renderColorOf(color: ViewerColor): number {
  return Number.parseInt(color.hex.replace("#", ""), 16);
}

/**
 * `position.count` is the number of unique vertices, which only equals three per
 * triangle on non-indexed geometry. STL parses non-indexed; 3MF parses indexed,
 * where the index buffer is the one that counts.
 */
export function triangleCount(geometry: import("three").BufferGeometry): number {
  const indexed = geometry.getIndex();
  const vertices = indexed ? indexed.count : (geometry.getAttribute("position")?.count ?? 0);
  return Math.floor(vertices / 3);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Loads and renders the request's actual model file so a request can be judged
 * before it is approved. Deliberately click-to-load: three.js plus a mesh of up
 * to 32 MB is a lot to pull for an administrator who is only reading the queue.
 */
export default function AdminModelViewer({
  src,
  fileName,
  fileKind,
  byteSize,
  previewMaxBytes,
  colors,
}: {
  /** Where the bytes come from. The page owns this, not the viewer. */
  src: string;
  fileName: string;
  fileKind: string;
  byteSize: number;
  previewMaxBytes: number;
  /** The requester's filaments, in the order they ranked them. */
  colors: readonly ViewerColor[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef<(degrees: number) => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);
  const cleanupRef = useRef<() => void>(() => undefined);
  const [state, setState] = useState<ViewerState>("idle");
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);

  const tooLarge = byteSize > previewMaxBytes;

  useEffect(() => () => cleanupRef.current(), []);

  const load = useCallback(async () => {
    const host = hostRef.current;
    if (!host) return;

    cleanupRef.current();
    cleanupRef.current = () => undefined;
    const controller = new AbortController();
    let disposed = false;
    // Which stage we reached, so a failure can name what actually broke instead
    // of blaming the browser for something the network did.
    let phase: "fetch" | "parse" | "render" = "fetch";
    setState("loading");
    setMessage(null);
    setStats(null);
    setAngle(0);

    try {
      const response = await fetch(src, {
        signal: controller.signal,
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`http-${response.status}`);
      const bytes = await response.arrayBuffer();
      if (disposed) return;

      phase = "parse";
      setState("parsing");
      const [THREE, { STLLoader }, { ThreeMFLoader }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/STLLoader.js"),
        import("three/examples/jsm/loaders/3MFLoader.js"),
      ]);
      if (disposed) return;

      let object: import("three").Object3D;
      let triangles = 0;
      let parts = 0;

      if (fileKind === "stl") {
        const geometry = new STLLoader().parse(bytes);
        triangles = triangleCount(geometry);
        if (triangles < 1) throw new Error("empty-model");
        parts = 1;
        geometry.computeVertexNormals();
        object = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: colors[0] ? renderColorOf(colors[0]) : UNPAINTED,
            roughness: 0.72,
            metalness: 0.04,
          }),
        );
      } else {
        object = new ThreeMFLoader().parse(bytes);
        // A mesh with several material slots is several paintable parts — that
        // is how a 3MF carries a multi-colour object. Enumerated in the same
        // order as the request form, so the round-robin below lands the same way.
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          triangles += triangleCount(child.geometry);
          const existing = Array.isArray(child.material) ? child.material : [child.material];
          const replacements = existing.map(() => {
            // Counted for every slot, painted only when a filament was chosen.
            const chosen = colors.length ? colors[parts % colors.length] : null;
            parts += 1;
            return new THREE.MeshStandardMaterial({
              color: chosen ? renderColorOf(chosen) : UNPAINTED,
              roughness: 0.72,
              metalness: 0.04,
            });
          });
          existing.forEach((old) => old.dispose());
          child.material = replacements.length > 1 ? replacements : replacements[0];
        });
        if (triangles < 1) throw new Error("empty-model");
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
      const round = (value: number) => Math.max(0.01, Math.round(value * 100) / 100);
      const bboxMm = { x: round(size.x), y: round(size.y), z: round(size.z) };

      phase = "render";
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xefefe6);

      const modelRoot = new THREE.Group();
      object.position.sub(bounds.getCenter(new THREE.Vector3()));
      modelRoot.add(object);
      scene.add(modelRoot);

      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
      const largest = Math.max(size.x, size.y, size.z);
      const distance = Math.max(
        largest * 1.8,
        (largest / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.35,
      );
      camera.position.set(distance * 0.72, distance * 0.52, distance);
      camera.near = Math.max(0.01, distance / 1000);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x213366, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.5);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xf5c21b, 0.8);
      fill.position.set(-4, 1, -2);
      scene.add(fill);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "block h-full w-full";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.replaceChildren(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.target.set(0, 0, 0);
      controls.update();
      controls.saveState();

      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      // Inspection is driven by the administrator, so the scene only redraws
      // while the controls are actually settling — no idle animation loop.
      let frame = 0;
      const tick = () => {
        frame = window.requestAnimationFrame(tick);
        if (controls.update()) renderer.render(scene, camera);
      };
      tick();

      rotateRef.current = (degrees) => {
        modelRoot.rotation.y += (degrees * Math.PI) / 180;
        setAngle((current) => (((Math.round(current + degrees) % 360) + 360) % 360));
        renderer.render(scene, camera);
      };
      resetRef.current = () => {
        modelRoot.rotation.set(0, 0, 0);
        controls.reset();
        setAngle(0);
        renderer.render(scene, camera);
      };

      renderer.render(scene, camera);
      setStats({ bboxMm, triangles, parts });
      setState("ready");

      cleanupRef.current = () => {
        disposed = true;
        controller.abort();
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose();
          const slots = Array.isArray(child.material) ? child.material : [child.material];
          slots.forEach((material) => material.dispose());
        });
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        rotateRef.current = () => undefined;
        resetRef.current = () => undefined;
      };
    } catch (error) {
      if (disposed || controller.signal.aborted) return;
      if (error instanceof Error && error.message === "empty-model") {
        setState("error");
        setMessage("This file has no usable geometry. Treat it as a broken mesh.");
        return;
      }
      if (error instanceof Error && error.message.startsWith("http-")) {
        setState("error");
        setMessage(
          `The file could not be fetched (${error.message.replace("http-", "HTTP ")}). It may have been purged under the 90-day retention policy.`,
        );
        return;
      }
      if (phase === "fetch") {
        setState("error");
        setMessage("The model could not be downloaded. Check the connection and try again.");
        return;
      }
      if (phase === "parse") {
        setState("error");
        setMessage("This file could not be read as a model. Treat it as corrupt or unsupported.");
        return;
      }
      // Only a genuine renderer failure reaches here, and the download still
      // works, so say that rather than implying the model itself is at fault.
      setState("unsupported");
      setMessage("This browser could not render the model. The download still works.");
    }
  }, [src, fileKind, colors]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (state !== "ready") return;
    if (event.key === "ArrowLeft") rotateRef.current(-15);
    else if (event.key === "ArrowRight") rotateRef.current(15);
    else if (event.key === "Home") resetRef.current();
    else return;
    event.preventDefault();
  }

  const busy = state === "loading" || state === "parsing";

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-mist bg-snow">
      <div
        className="relative aspect-[4/3] w-full bg-cloud"
        role="group"
        aria-label={`Interactive model preview for ${fileName}`}
        aria-describedby="admin-viewer-help admin-viewer-angle"
        tabIndex={state === "ready" ? 0 : -1}
        onKeyDown={onKeyDown}
      >
        <div ref={hostRef} className="absolute inset-0" />

        {state !== "ready" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {tooLarge ? (
              <p className="max-w-[38ch] text-sm text-slate">
                This model is {formatBytes(byteSize)} — too large to open in the browser. Download
                it and inspect it in your slicer.
              </p>
            ) : busy ? (
              <p className="flex items-center gap-3 text-sm font-bold text-navy" role="status">
                <span className="spinner" aria-hidden="true" />
                {state === "loading" ? "Fetching model…" : "Reading geometry…"}
              </p>
            ) : (
              <div>
                {message && (
                  <p className="mb-4 max-w-[38ch] text-sm text-slate" role="status">
                    {message}
                  </p>
                )}
                <button type="button" onClick={load} className="btn btn--dark btn--sm whitespace-nowrap">
                  {state === "idle" ? "Load 3D preview" : "Try again"}
                </button>
                {state === "idle" && (
                  <p className="mt-3 text-xs text-slate">
                    {formatBytes(byteSize)} · {fileKind.toUpperCase()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {state === "ready" && stats && (
        <div className="border-t border-mist p-4">
          {/* The measurement needs a full row of its own: at the sidebar's width
              a three-column split breaks "mm" onto a second line. */}
          <dl className="grid gap-x-4 gap-y-3 grid-cols-2">
            <div className="col-span-2">
              <dt className="text-xs text-slate">Measured size</dt>
              <dd className="tnum mt-0.5 whitespace-nowrap font-mono text-sm font-bold text-ink">
                {stats.bboxMm.x} × {stats.bboxMm.y} × {stats.bboxMm.z} mm
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Triangles</dt>
              <dd className="tnum mt-0.5 font-mono text-sm font-bold text-ink">
                {stats.triangles.toLocaleString("en-CA")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Parts</dt>
              <dd className="tnum mt-0.5 font-mono text-sm font-bold text-ink">{stats.parts}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate">
            Measured from the stored file, so these dimensions are the club&rsquo;s own reading —
            not the figure the requester&rsquo;s browser reported.
          </p>

          <div className="mt-4 border-t border-mist pt-4">
            {colors.length === 0 ? (
              <p className="text-xs text-slate">
                No colour preference — shown in the club&rsquo;s placeholder navy. Pick whatever is
                on the shelf.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate">
                  Rendered in the requester&rsquo;s filaments, in the order they ranked them.
                </p>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {colors.map((color, index) => (
                    <li
                      key={color.slug}
                      className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-mist bg-paper py-1 pl-1 pr-3 text-xs text-ink"
                    >
                      <span className="tnum grid size-5 place-items-center rounded-full bg-ink font-mono text-[10px] font-bold text-snow">
                        {index + 1}
                      </span>
                      <span
                        className="size-4 rounded-full border border-ink/20"
                        style={{ background: color.swatch ?? color.hex }}
                        aria-hidden="true"
                      />
                      {color.name}
                    </li>
                  ))}
                </ol>
                {stats.parts > 1 && colors.length > 1 && (
                  <p className="mt-2 text-xs text-slate">
                    Colours cycle across the {stats.parts} parts in order. If the requester
                    rearranged specific parts, their own thumbnail below is the record of it.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2" aria-label="Model rotation controls">
            <button
              type="button"
              onClick={() => rotateRef.current(-15)}
              className="grid size-11 place-items-center rounded-[var(--radius-chip)] border border-mist bg-snow text-ink transition-colors duration-[var(--dur-hover)] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              aria-label="Rotate model left 15 degrees"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => resetRef.current()}
              className="min-h-11 rounded-[var(--radius-chip)] border border-mist bg-snow px-4 text-sm font-bold text-ink transition-colors duration-[var(--dur-hover)] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => rotateRef.current(15)}
              className="grid size-11 place-items-center rounded-[var(--radius-chip)] border border-mist bg-snow text-ink transition-colors duration-[var(--dur-hover)] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              aria-label="Rotate model right 15 degrees"
            >
              →
            </button>
          </div>
        </div>
      )}

      <p id="admin-viewer-help" className="sr-only">
        Drag to orbit the model. Use Left Arrow and Right Arrow to rotate it, or Home to return to
        the front view.
      </p>
      <p id="admin-viewer-angle" className="sr-only" aria-live="polite">
        Model rotation {angle} degrees.
      </p>
    </div>
  );
}
