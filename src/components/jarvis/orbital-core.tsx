import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Mesh = {
  positions: WebGLBuffer;
  normals: WebGLBuffer;
  colors: WebGLBuffer;
  indices: WebGLBuffer | null;
  indexCount: number;
  vertexCount: number;
  mode: number;
};

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const item = gl.createShader(type);
  if (!item) throw new Error("WebGL não conseguiu criar o shader.");
  gl.shaderSource(item, source);
  gl.compileShader(item);
  if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(item) || "Falha ao compilar shader.";
    gl.deleteShader(item);
    throw new Error(message);
  }
  return item;
}

function program(gl: WebGLRenderingContext) {
  const vertexSource = [
    "attribute vec3 aPosition;",
    "attribute vec3 aNormal;",
    "attribute vec3 aColor;",
    "uniform mat4 uMvp;",
    "uniform mat4 uModel;",
    "uniform float uPointSize;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "void main() {",
    "  vec4 worldPosition = uModel * vec4(aPosition, 1.0);",
    "  gl_Position = uMvp * vec4(aPosition, 1.0);",
    "  gl_PointSize = uPointSize;",
    "  vNormal = normalize(mat3(uModel) * aNormal);",
    "  vColor = aColor;",
    "}"
  ].join("\n");

  const fragmentSource = [
    "precision mediump float;",
    "uniform float uOpacity;",
    "uniform float uPointMode;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "void main() {",
    "  if (uPointMode > 0.5) {",
    "    float d = length(gl_PointCoord - vec2(0.5));",
    "    if (d > 0.5) discard;",
    "    float glow = 1.0 - smoothstep(0.08, 0.5, d);",
    "    gl_FragColor = vec4(vColor * (0.9 + glow * 1.8), glow * uOpacity);",
    "    return;",
    "  }",
    "  vec3 n = normalize(vNormal);",
    "  vec3 lightDirection = normalize(vec3(-0.42, 0.58, 1.0));",
    "  float diffuse = max(dot(n, lightDirection), 0.0);",
    "  float facing = max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0);",
    "  float rim = pow(1.0 - facing, 2.15);",
    "  float specular = pow(max(dot(reflect(-lightDirection, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);",
    "  vec3 color = vColor * (0.18 + diffuse * 0.86);",
    "  color += vec3(0.28, 0.08, 0.95) * rim * 1.35;",
    "  color += vec3(0.62, 0.82, 1.0) * specular * 0.65;",
    "  gl_FragColor = vec4(color, uOpacity * (0.50 + rim * 0.72));",
    "}"
  ].join("\n");

  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const result = gl.createProgram();
  if (!result) throw new Error("WebGL não conseguiu criar o programa.");
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) || "Falha ao vincular shaders.";
    gl.deleteProgram(result);
    throw new Error(message);
  }
  return result;
}

function buffer(gl: WebGLRenderingContext, target: number, data: BufferSource, usage = gl.STATIC_DRAW) {
  const item = gl.createBuffer();
  if (!item) throw new Error("WebGL não conseguiu criar um buffer.");
  gl.bindBuffer(target, item);
  gl.bufferData(target, data, usage);
  return item;
}

function buildMesh(
  gl: WebGLRenderingContext,
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[] | null,
  mode = gl.TRIANGLES
): Mesh {
  return {
    positions: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(positions)),
    normals: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(normals)),
    colors: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(colors)),
    indices: indices ? buffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices)) : null,
    indexCount: indices?.length ?? 0,
    vertexCount: positions.length / 3,
    mode
  };
}

function sphere(gl: WebGLRenderingContext, radius: number, color: [number, number, number], rows = 32, columns = 48) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const theta = v * Math.PI;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const phi = u * Math.PI * 2;
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      colors.push(color[0], color[1], color[2]);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return buildMesh(gl, positions, normals, colors, indices);
}

function torus(
  gl: WebGLRenderingContext,
  majorRadius: number,
  tubeRadius: number,
  color: [number, number, number],
  segments = 144,
  sides = 10
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    for (let j = 0; j <= sides; j++) {
      const v = (j / sides) * Math.PI * 2;
      const radial = majorRadius + tubeRadius * Math.cos(v);
      const x = radial * Math.cos(u);
      const y = radial * Math.sin(u);
      const z = tubeRadius * Math.sin(v);
      positions.push(x, y, z);
      normals.push(Math.cos(v) * Math.cos(u), Math.cos(v) * Math.sin(u), Math.sin(v));
      colors.push(color[0], color[1], color[2]);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return buildMesh(gl, positions, normals, colors, indices);
}

function particleField(gl: WebGLRenderingContext, count = 84) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * 2.399963229728653;
    const spread = 0.76 + ((i * 17) % 21) / 100;
    positions.push(Math.cos(angle) * radius * spread, y * spread, Math.sin(angle) * radius * spread);
    normals.push(0, 0, 1);
    const violet = i % 4 !== 0;
    colors.push(violet ? 0.62 : 0.24, violet ? 0.28 : 0.82, violet ? 1.0 : 1.0);
  }
  return buildMesh(gl, positions, normals, colors, null, gl.POINTS);
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translateZ(distance: number) {
  const out = identity();
  out[14] = distance;
  return out;
}

function rotateX(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

function rotateY(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

function rotateZ(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

function perspective(aspect: number) {
  const f = 1 / Math.tan(Math.PI / 7.2);
  const near = 0.1;
  const far = 20;
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function disposeMesh(gl: WebGLRenderingContext, mesh: Mesh) {
  gl.deleteBuffer(mesh.positions);
  gl.deleteBuffer(mesh.normals);
  gl.deleteBuffer(mesh.colors);
  if (mesh.indices) gl.deleteBuffer(mesh.indices);
}

export function OrbitalCore3D({ active = false }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "high-performance" });
    if (!gl) {
      host.dataset.webgl = "unavailable";
      return;
    }

    let sceneProgram: WebGLProgram;
    let meshes: Mesh[] = [];
    let frame = 0;
    let disposed = false;
    let pointerX = 0;
    let pointerY = 0;
    let smoothPointerX = 0;
    let smoothPointerY = 0;
    let angle = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      sceneProgram = program(gl);
      meshes = [
        torus(gl, 0.69, 0.012, [0.52, 0.23, 1.0]),
        torus(gl, 0.60, 0.009, [0.18, 0.83, 1.0]),
        torus(gl, 0.76, 0.006, [0.78, 0.42, 1.0]),
        sphere(gl, 0.43, [0.30, 0.11, 0.68]),
        sphere(gl, 0.33, [0.45, 0.18, 0.90]),
        sphere(gl, 0.225, [0.21, 0.58, 1.0]),
        sphere(gl, 0.12, [0.68, 0.88, 1.0], 24, 36),
        particleField(gl)
      ];
    } catch {
      host.dataset.webgl = "error";
      return;
    }

    const locations = {
      position: gl.getAttribLocation(sceneProgram, "aPosition"),
      normal: gl.getAttribLocation(sceneProgram, "aNormal"),
      color: gl.getAttribLocation(sceneProgram, "aColor"),
      mvp: gl.getUniformLocation(sceneProgram, "uMvp"),
      model: gl.getUniformLocation(sceneProgram, "uModel"),
      opacity: gl.getUniformLocation(sceneProgram, "uOpacity"),
      pointSize: gl.getUniformLocation(sceneProgram, "uPointSize"),
      pointMode: gl.getUniformLocation(sceneProgram, "uPointMode")
    };

    function resize() {
      if (!canvas || !gl) return;
      const bounds = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function bindMesh(mesh: Mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals);
      gl.enableVertexAttribArray(locations.normal);
      gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colors);
      gl.enableVertexAttribArray(locations.color);
      gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
      if (mesh.indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    }

    function draw(mesh: Mesh, projectionMatrix: Float32Array, model: Float32Array, opacity: number, pointMode: boolean) {
      const mvp = multiply(projectionMatrix, model);
      bindMesh(mesh);
      gl.uniformMatrix4fv(locations.mvp, false, mvp);
      gl.uniformMatrix4fv(locations.model, false, model);
      gl.uniform1f(locations.opacity, opacity);
      gl.uniform1f(locations.pointSize, Math.max(2, Math.min(5, canvas.width / 92)));
      gl.uniform1f(locations.pointMode, pointMode ? 1 : 0);
      if (mesh.indices) gl.drawElements(mesh.mode, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      else gl.drawArrays(mesh.mode, 0, mesh.vertexCount);
    }

    function render() {
      if (disposed) return;
      resize();
      const width = canvas.width;
      const height = canvas.height;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(sceneProgram);

      const projectionMatrix = perspective(width / Math.max(1, height));
      smoothPointerX += (pointerX - smoothPointerX) * 0.035;
      smoothPointerY += (pointerY - smoothPointerY) * 0.035;
      angle += reducedMotion ? 0 : (active ? 0.012 : 0.0045);
      const base = multiply(
        translateZ(-3.0),
        multiply(rotateX(0.18 + smoothPointerY * 0.25 + Math.sin(angle * 0.72) * 0.07),
          rotateY(angle + smoothPointerX * 0.36))
      );

      // Three individually tilted toroidal meshes create genuine depth and parallax.
      const ringOne = multiply(base, rotateX(0.12 + Math.sin(angle * 0.45) * 0.08));
      const ringTwo = multiply(base, multiply(rotateX(1.08), rotateZ(0.62 + angle * 0.2)));
      const ringThree = multiply(base, multiply(rotateY(1.24), rotateZ(-0.35 - angle * 0.16)));
      draw(meshes[0], projectionMatrix, ringOne, 0.92, false);
      draw(meshes[1], projectionMatrix, ringTwo, 0.88, false);
      draw(meshes[2], projectionMatrix, ringThree, 0.72, false);

      gl.depthMask(false);
      draw(meshes[3], projectionMatrix, base, 0.48, false);
      draw(meshes[4], projectionMatrix, multiply(base, rotateY(-angle * 0.32)), 0.58, false);
      draw(meshes[5], projectionMatrix, multiply(base, rotateX(angle * 0.45)), 0.82, false);
      draw(meshes[6], projectionMatrix, multiply(base, rotateY(angle * 0.75)), 0.92, false);
      draw(meshes[7], projectionMatrix, base, active ? 0.92 : 0.64, true);
      gl.depthMask(true);

      frame = window.requestAnimationFrame(render);
    }

    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2;
    };
    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      meshes.forEach((mesh) => disposeMesh(gl, mesh));
      gl.deleteProgram(sceneProgram);
    };
  }, [active]);

  return (
    <div
      ref={hostRef}
      className="orbital-core-3d"
      data-active={active ? "true" : "false"}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="orbital-core-3d-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
      <span className="orbital-3d-caption orbital-3d-caption--top">J.A.R.V.I.S. / 3D CORE</span>
      <span className="orbital-3d-caption orbital-3d-caption--left">DEPTH · 3 AXIS</span>
      <span className="orbital-3d-caption orbital-3d-caption--right">WEBGL / LIVE</span>
      <span className="orbital-3d-target" />
    </div>
  );
}

export function OrbitalCore({ active = false, muted = false }: { active?: boolean; muted?: boolean }) {
  return (
    <div
      className={cn("orbital-core", "orbital-core--webgl", active && "orbital-core--active", muted && "orbital-core--muted")}
      data-active={active}
      aria-hidden="true"
    >
      <OrbitalCore3D active={active} />
      <div className="orbital-core-hud" aria-hidden="true">
        <span className="orbital-core-hud-crosshair" />
        <span className="orbital-core-hud-node orbital-core-hud-node--one" />
        <span className="orbital-core-hud-node orbital-core-hud-node--two" />
        <span className="orbital-core-hud-node orbital-core-hud-node--three" />
      </div>
    </div>
  );
}
