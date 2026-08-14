"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const LOGO_WIDTH = 699;
const LOGO_HEIGHT = 902;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;
const SAMPLE_WIDTH = 280;
const SAMPLE_HEIGHT = Math.round(SAMPLE_WIDTH / LOGO_ASPECT);
const HALF_DEPTH = 0.072;
const FLOATS_PER_VERTEX = 10;

type Point = [number, number, number];
type Colour = [number, number, number, number];

export type LogoModelHandle = {
  setYaw: (yawDegrees: number) => void;
};

type LogoModelCanvasProps = {
  onReady: () => void;
};

const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec2 a_texcoord;
  attribute vec4 a_colour;
  attribute float a_textured;

  uniform float u_yaw;
  uniform float u_pitch;
  uniform float u_logo_aspect;

  varying vec2 v_texcoord;
  varying vec4 v_colour;
  varying float v_textured;

  void main() {
    float cy = cos(u_yaw);
    float sy = sin(u_yaw);
    float cx = cos(u_pitch);
    float sx = sin(u_pitch);

    vec3 yawed = vec3(
      a_position.x * cy + a_position.z * sy,
      a_position.y,
      -a_position.x * sy + a_position.z * cy
    );
    vec3 rotated = vec3(
      yawed.x,
      yawed.y * cx - yawed.z * sx,
      yawed.y * sx + yawed.z * cx
    );

    gl_Position = vec4(
      rotated.x / u_logo_aspect * 0.96,
      rotated.y * 0.96,
      -rotated.z * 0.5,
      1.0
    );
    v_texcoord = a_texcoord;
    v_colour = a_colour;
    v_textured = a_textured;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  uniform sampler2D u_texture;
  varying vec2 v_texcoord;
  varying vec4 v_colour;
  varying float v_textured;

  void main() {
    if (v_textured > 0.5) {
      vec4 texel = texture2D(u_texture, v_texcoord);
      if (texel.a < 0.035) discard;
      gl_FragColor = texel;
      return;
    }

    gl_FragColor = v_colour;
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function pushVertex(
  vertices: number[],
  point: Point,
  uv: [number, number],
  colour: Colour,
  textured: number,
) {
  vertices.push(...point, ...uv, ...colour, textured);
}

function pushQuad(vertices: number[], points: [Point, Point, Point, Point], colour: Colour) {
  const [bottomLeft, bottomRight, topRight, topLeft] = points;
  const uv: [number, number] = [0, 0];

  pushVertex(vertices, bottomLeft, uv, colour, 0);
  pushVertex(vertices, bottomRight, uv, colour, 0);
  pushVertex(vertices, topRight, uv, colour, 0);
  pushVertex(vertices, bottomLeft, uv, colour, 0);
  pushVertex(vertices, topRight, uv, colour, 0);
  pushVertex(vertices, topLeft, uv, colour, 0);
}

function pushFace(vertices: number[], z: number) {
  const white: Colour = [1, 1, 1, 1];
  const bottomLeft: Point = [-LOGO_ASPECT, -1, z];
  const bottomRight: Point = [LOGO_ASPECT, -1, z];
  const topRight: Point = [LOGO_ASPECT, 1, z];
  const topLeft: Point = [-LOGO_ASPECT, 1, z];

  pushVertex(vertices, bottomLeft, [0, 1], white, 1);
  pushVertex(vertices, bottomRight, [1, 1], white, 1);
  pushVertex(vertices, topRight, [1, 0], white, 1);
  pushVertex(vertices, bottomLeft, [0, 1], white, 1);
  pushVertex(vertices, topRight, [1, 0], white, 1);
  pushVertex(vertices, topLeft, [0, 0], white, 1);
}

function buildModelVertices(alpha: Uint8ClampedArray) {
  const vertices: number[] = [];
  const leftColour: Colour = [0.075, 0.125, 0.29, 1];
  const rightColour: Colour = [0.13, 0.21, 0.43, 1];
  const topColour: Colour = [0.18, 0.29, 0.53, 1];
  const bottomColour: Colour = [0.055, 0.09, 0.22, 1];

  function isSolid(column: number, row: number) {
    if (column < 0 || row < 0 || column >= SAMPLE_WIDTH || row >= SAMPLE_HEIGHT) {
      return false;
    }
    return alpha[(row * SAMPLE_WIDTH + column) * 4 + 3] > 40;
  }

  for (let row = 0; row < SAMPLE_HEIGHT; row += 1) {
    for (let column = 0; column < SAMPLE_WIDTH; column += 1) {
      if (!isSolid(column, row)) continue;

      const x0 = -LOGO_ASPECT + (column / SAMPLE_WIDTH) * LOGO_ASPECT * 2;
      const x1 = -LOGO_ASPECT + ((column + 1) / SAMPLE_WIDTH) * LOGO_ASPECT * 2;
      const yTop = 1 - (row / SAMPLE_HEIGHT) * 2;
      const yBottom = 1 - ((row + 1) / SAMPLE_HEIGHT) * 2;

      if (!isSolid(column - 1, row)) {
        pushQuad(
          vertices,
          [
            [x0, yBottom, -HALF_DEPTH],
            [x0, yBottom, HALF_DEPTH],
            [x0, yTop, HALF_DEPTH],
            [x0, yTop, -HALF_DEPTH],
          ],
          leftColour,
        );
      }

      if (!isSolid(column + 1, row)) {
        pushQuad(
          vertices,
          [
            [x1, yBottom, HALF_DEPTH],
            [x1, yBottom, -HALF_DEPTH],
            [x1, yTop, -HALF_DEPTH],
            [x1, yTop, HALF_DEPTH],
          ],
          rightColour,
        );
      }

      if (!isSolid(column, row - 1)) {
        pushQuad(
          vertices,
          [
            [x0, yTop, HALF_DEPTH],
            [x1, yTop, HALF_DEPTH],
            [x1, yTop, -HALF_DEPTH],
            [x0, yTop, -HALF_DEPTH],
          ],
          topColour,
        );
      }

      if (!isSolid(column, row + 1)) {
        pushQuad(
          vertices,
          [
            [x0, yBottom, -HALF_DEPTH],
            [x1, yBottom, -HALF_DEPTH],
            [x1, yBottom, HALF_DEPTH],
            [x0, yBottom, HALF_DEPTH],
          ],
          bottomColour,
        );
      }
    }
  }

  pushFace(vertices, HALF_DEPTH);
  pushFace(vertices, -HALF_DEPTH);
  return new Float32Array(vertices);
}

const LogoModelCanvas = forwardRef<LogoModelHandle, LogoModelCanvasProps>(
  function LogoModelCanvas({ onReady }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const yawRef = useRef(0);
    const renderRef = useRef<(yawDegrees: number) => void>(() => undefined);

    useImperativeHandle(
      ref,
      () => ({
        setYaw(yawDegrees: number) {
          yawRef.current = yawDegrees;
          renderRef.current(yawDegrees);
        },
      }),
      [],
    );

    useEffect(() => {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;

      const context = canvasElement.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      });
      if (!context) return;

      const canvas: HTMLCanvasElement = canvasElement;
      const gl: WebGLRenderingContext = context;

      let cancelled = false;
      let resizeObserver: ResizeObserver | null = null;
      let program: WebGLProgram | null = null;
      let buffer: WebGLBuffer | null = null;
      let texture: WebGLTexture | null = null;

      async function initialise() {
        const image = new Image();
        image.src = "/img/logo.png";
        await image.decode();
        if (cancelled) return;

        const sampler = document.createElement("canvas");
        sampler.width = SAMPLE_WIDTH;
        sampler.height = SAMPLE_HEIGHT;
        const samplerContext = sampler.getContext("2d", { willReadFrequently: true });
        if (!samplerContext) return;

        samplerContext.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        samplerContext.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const pixels = samplerContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
        const vertices = buildModelVertices(pixels);

        program = createProgram(gl);
        buffer = gl.createBuffer();
        texture = gl.createTexture();
        if (!program || !buffer || !texture) return;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
        const positionLocation = gl.getAttribLocation(program, "a_position");
        const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
        const colourLocation = gl.getAttribLocation(program, "a_colour");
        const texturedLocation = gl.getAttribLocation(program, "a_textured");

        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(texcoordLocation);
        gl.vertexAttribPointer(
          texcoordLocation,
          2,
          gl.FLOAT,
          false,
          stride,
          3 * Float32Array.BYTES_PER_ELEMENT,
        );
        gl.enableVertexAttribArray(colourLocation);
        gl.vertexAttribPointer(
          colourLocation,
          4,
          gl.FLOAT,
          false,
          stride,
          5 * Float32Array.BYTES_PER_ELEMENT,
        );
        gl.enableVertexAttribArray(texturedLocation);
        gl.vertexAttribPointer(
          texturedLocation,
          1,
          gl.FLOAT,
          false,
          stride,
          9 * Float32Array.BYTES_PER_ELEMENT,
        );

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        const yawLocation = gl.getUniformLocation(program, "u_yaw");
        const pitchLocation = gl.getUniformLocation(program, "u_pitch");
        const aspectLocation = gl.getUniformLocation(program, "u_logo_aspect");
        const textureLocation = gl.getUniformLocation(program, "u_texture");
        const vertexCount = vertices.length / FLOATS_PER_VERTEX;

        gl.uniform1i(textureLocation, 0);
        gl.uniform1f(pitchLocation, 0);
        gl.uniform1f(aspectLocation, LOGO_ASPECT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);

        function render(yawDegrees: number) {
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width * ratio));
          const height = Math.max(1, Math.round(rect.height * ratio));

          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }

          gl.viewport(0, 0, width, height);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.uniform1f(yawLocation, (yawDegrees * Math.PI) / 180);
          gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
        }

        renderRef.current = render;
        resizeObserver = new ResizeObserver(() => render(yawRef.current));
        resizeObserver.observe(canvas);
        render(yawRef.current);
        onReady();
      }

      initialise().catch(() => undefined);

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        renderRef.current = () => undefined;
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        if (texture) gl.deleteTexture(texture);
      };
    }, [onReady]);

    return <canvas ref={canvasRef} className="layer-stage__model-canvas" aria-hidden="true" />;
  },
);

export default LogoModelCanvas;
