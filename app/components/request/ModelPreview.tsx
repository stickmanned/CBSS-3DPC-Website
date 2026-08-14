"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { BoundingBoxMm, PreviewMetadata } from "./types";

type PreviewState = "parsing" | "ready" | "fallback" | "error";

function roundedDimensions(size: { x: number; y: number; z: number }): BoundingBoxMm {
  const round = (value: number) => Math.max(0.01, Math.round(value * 100) / 100);
  return { x: round(size.x), y: round(size.y), z: round(size.z) };
}

export default function ModelPreview({
  file,
  onReady,
  onError,
}: {
  file: File;
  onReady: (metadata: PreviewMetadata) => void;
  onError: (message: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef<(degrees: number) => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);
  const [state, setState] = useState<PreviewState>("parsing");
  const [dimensions, setDimensions] = useState<BoundingBoxMm | null>(null);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const previewHost = host;

    let cancelled = false;
    let cleanupPreview = () => undefined;

    setState("parsing");
    setDimensions(null);
    setAngle(0);
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
          new THREE.MeshStandardMaterial({ color: 0x213366, roughness: 0.72, metalness: 0.04 }),
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

        renderer.render(scene, camera);
        const thumbnailCanvas = document.createElement("canvas");
        thumbnailCanvas.width = 360;
        thumbnailCanvas.height = 240;
        const thumbnailContext = thumbnailCanvas.getContext("2d");
        thumbnailContext?.drawImage(renderer.domElement, 0, 0, 360, 240);
        const thumbnail = thumbnailContext
          ? thumbnailCanvas.toDataURL("image/webp", 0.82)
          : null;
        setState("ready");
        onReady({ bboxMm, thumbnail, webglAvailable: true });

        cleanupPreview = () => {
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

      <div className="border-t border-mist bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink">{file.name}</p>
          <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-slate">
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
              className="grid size-11 cursor-pointer place-items-center rounded-full border border-navy/35 bg-white font-mono text-navy hover:bg-cloud"
              aria-label="Rotate model left 15 degrees"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => resetRef.current()}
              className="min-h-11 cursor-pointer rounded-full border border-navy/35 bg-white px-4 font-display text-sm font-bold text-navy hover:bg-cloud"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => rotateRef.current(15)}
              className="grid size-11 cursor-pointer place-items-center rounded-full border border-navy/35 bg-white font-mono text-navy hover:bg-cloud"
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
