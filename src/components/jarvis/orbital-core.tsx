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
  material: number;
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
    "uniform float uTime;",
    "uniform float uMaterial;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "varying vec3 vPosition;",
    "void main() {",
    "  float organicSurface = 1.0 - step(1.5, uMaterial);",
    "  float livingWave = sin(uTime * 0.34 + aPosition.x * 5.2 + aPosition.z * 4.4) * cos(aPosition.y * 4.7 - uTime * 0.21);",
    "  vec3 displaced = aPosition + normalize(aNormal) * livingWave * 0.009 * organicSurface;",
    "  gl_Position = uMvp * vec4(displaced, 1.0);",
    "  gl_PointSize = uPointSize * (0.85 + 0.3 * sin(uTime * 1.7 + aPosition.x * 31.0 + aPosition.y * 19.0));",
    "  vNormal = normalize(mat3(uModel) * aNormal);",
    "  vColor = aColor;",
    "  vPosition = displaced;",
    "}"
  ].join("\n");

  const fragmentSource = [
    "precision mediump float;",
    "uniform float uOpacity;",
    "uniform float uPointMode;",
    "uniform float uTime;",
    "uniform float uMaterial;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "varying vec3 vPosition;",
    "float hash31(vec3 p) {",
    "  p = fract(p * 0.1031);",
    "  p += dot(p, p.yzx + 33.33);",
    "  return fract((p.x + p.y) * p.z);",
    "}",
    "float noise3(vec3 x) {",
    "  vec3 i = floor(x);",
    "  vec3 f = fract(x);",
    "  f = f * f * (3.0 - 2.0 * f);",
    "  float n000 = hash31(i + vec3(0.0,0.0,0.0));",
    "  float n100 = hash31(i + vec3(1.0,0.0,0.0));",
    "  float n010 = hash31(i + vec3(0.0,1.0,0.0));",
    "  float n110 = hash31(i + vec3(1.0,1.0,0.0));",
    "  float n001 = hash31(i + vec3(0.0,0.0,1.0));",
    "  float n101 = hash31(i + vec3(1.0,0.0,1.0));",
    "  float n011 = hash31(i + vec3(0.0,1.0,1.0));",
    "  float n111 = hash31(i + vec3(1.0,1.0,1.0));",
    "  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);",
    "}",
    "void main() {",
    "  if (uPointMode > 0.5) {",
    "    float d = length(gl_PointCoord - vec2(0.5));",
    "    if (d > 0.5) discard;",
    "    float glow = 1.0 - smoothstep(0.08, 0.5, d);",
    "    float pulse = 0.72 + 0.28 * sin(uTime * 1.8 + vPosition.x * 25.0 + vPosition.y * 34.0);",
    "    gl_FragColor = vec4(vColor * (0.8 + glow * 2.2) * pulse, glow * uOpacity * pulse);",
    "    return;",
    "  }",
    "  vec3 n = normalize(vNormal);",
    "  vec3 lightDirection = normalize(vec3(-0.42, 0.58, 1.0));",
    "  float diffuse = max(dot(n, lightDirection), 0.0);",
    "  float facing = max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0);",
    "  float rim = pow(1.0 - facing, 2.8);",
    "  float specular = pow(max(dot(reflect(-lightDirection, n), vec3(0.0, 0.0, 1.0)), 0.0), 26.0);",
    "  float surfaceNoise = noise3(vPosition * 19.0 + vec3(0.0, uTime * 0.018, 0.0));",
    "  float fineNoise = noise3(vPosition * 51.0 + vec3(uTime * 0.009, 0.0, 0.0));",
    "  float etched = abs(sin(vPosition.x * 37.0 + sin(vPosition.y * 13.0 + uTime * 0.035)) * sin(vPosition.z * 43.0 + vPosition.y * 17.0));",
    "  float striation = abs(sin((vPosition.x + surfaceNoise * 0.035) * 104.0 + sin(vPosition.z * 38.0 + surfaceNoise * 3.0)));",
    "  float filigree = max(smoothstep(0.82, 0.985, etched), smoothstep(0.86, 0.99, striation));",
    "  float interference = 0.5 + 0.5 * sin(length(vPosition) * 92.0 - uTime * 0.2 + sin(vPosition.y * 19.0) * 0.5);",
    "  float cellEdges = smoothstep(0.63, 0.94, abs(surfaceNoise - fineNoise * 0.42));",
    "  float signalFlow = 0.5 + 0.5 * sin(vPosition.y * 43.0 + vPosition.x * 11.0 - uTime * 0.42 + surfaceNoise * 7.0);",
    "  float spectrum = 0.5 + 0.5 * sin((vPosition.x - vPosition.z) * 12.0 + rim * 4.0 + uTime * 0.1 + surfaceNoise * 3.0);",
    "  vec3 iridescence = mix(vec3(0.16, 0.66, 1.0), vec3(0.74, 0.20, 1.0), spectrum);",
    "  float caustic = pow(max(0.0, sin(vPosition.x * 18.0 + sin(vPosition.z * 17.0 + uTime * 0.11) * 2.0) * cos(vPosition.y * 15.0 - uTime * 0.075)), 8.0);",
    "  vec3 color = vColor * (0.12 + diffuse * 0.86);",
    "  color += vec3(0.22, 0.05, 0.80) * rim * 1.65;",
    "  color += vec3(0.30, 0.78, 1.0) * pow(rim, 2.1) * 0.48;",
    "  color += vec3(0.62, 0.82, 1.0) * specular * 0.92;",
    "  color += iridescence * pow(rim, 0.85) * 0.42;",
    "  color += vec3(0.35, 0.80, 1.0) * caustic * 0.22 * min(uMaterial, 1.0);",
    "  color += vec3(0.50, 0.28, 1.0) * filigree * (0.1 + interference * 0.32) * min(uMaterial, 1.0);",
    "  color += vec3(0.18, 0.72, 1.0) * cellEdges * signalFlow * 0.17 * min(uMaterial, 1.0);",
    "  color += vec3(0.58, 0.3, 1.0) * smoothstep(0.6, 0.96, fineNoise) * 0.12 * min(uMaterial, 1.0);",
    "  if (uMaterial > 1.5) color *= 0.65 + 0.35 * interference;",
    "  gl_FragColor = vec4(color, uOpacity * (0.25 + rim * 0.86));",
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
  mode = gl.TRIANGLES,
  material = 0
): Mesh {
  return {
    positions: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(positions)),
    normals: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(normals)),
    colors: buffer(gl, gl.ARRAY_BUFFER, new Float32Array(colors)),
    indices: indices ? buffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices)) : null,
    indexCount: indices?.length ?? 0,
    vertexCount: positions.length / 3,
    mode,
    material
  };
}

function sphere(gl: WebGLRenderingContext, radius: number, color: [number, number, number], rows = 48, columns = 72, material = 1) {
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
  return buildMesh(gl, positions, normals, colors, indices, gl.TRIANGLES, material);
}

function torus(
  gl: WebGLRenderingContext,
  majorRadius: number,
  tubeRadius: number,
  color: [number, number, number],
  segments = 220,
  sides = 8,
  startAngle = 0,
  endAngle = Math.PI * 2,
  material = 0
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = startAngle + (i / segments) * (endAngle - startAngle);
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
  return buildMesh(gl, positions, normals, colors, indices, gl.TRIANGLES, material);
}

function geodesicCage(
  gl: WebGLRenderingContext,
  radius: number,
  color: [number, number, number],
  subdivisions = 2
) {
  type Vec3 = [number, number, number];
  type Face = [number, number, number];
  type Edge = [number, number];
  const golden = (1 + Math.sqrt(5)) / 2;
  const vertices: Vec3[] = [
    [-1, golden, 0], [1, golden, 0], [-1, -golden, 0], [1, -golden, 0],
    [0, -1, golden], [0, 1, golden], [0, -1, -golden], [0, 1, -golden],
    [golden, 0, -1], [golden, 0, 1], [-golden, 0, -1], [-golden, 0, 1]
  ];
  const normalize = (point: Vec3): Vec3 => {
    const length = Math.hypot(point[0], point[1], point[2]) || 1;
    return [point[0] / length, point[1] / length, point[2] / length];
  };
  for (let i = 0; i < vertices.length; i++) vertices[i] = normalize(vertices[i]!);
  let faces: Face[] = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  for (let iteration = 0; iteration < subdivisions; iteration++) {
    const midpointCache = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const key = String(a < b ? a : b) + ":" + String(a < b ? b : a);
      const found = midpointCache.get(key);
      if (found !== undefined) return found;
      const pa = vertices[a]!;
      const pb = vertices[b]!;
      const point = normalize([
        (pa[0] + pb[0]) / 2,
        (pa[1] + pb[1]) / 2,
        (pa[2] + pb[2]) / 2
      ]);
      const index = vertices.push(point) - 1;
      midpointCache.set(key, index);
      return index;
    };
    const next: Face[] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const drawnEdges = new Set<string>();
  for (const [a, b, c] of faces) {
    const edges: Edge[] = [[a, b], [b, c], [c, a]];
    for (const [from, to] of edges) {
      const key = String(from < to ? from : to) + ":" + String(from < to ? to : from);
      if (drawnEdges.has(key)) continue;
      drawnEdges.add(key);
      const start = vertices[from]!;
      const end = vertices[to]!;
      positions.push(start[0] * radius, start[1] * radius, start[2] * radius);
      positions.push(end[0] * radius, end[1] * radius, end[2] * radius);
      normals.push(...start, ...end);
      colors.push(...color, ...color);
    }
  }
  return buildMesh(gl, positions, normals, colors, null, gl.LINES, 2);
}

function wireSphere(gl: WebGLRenderingContext, radius: number, color: [number, number, number], rows = 26, columns = 96) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const point = (theta: number, phi: number) => {
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta);
    const z = Math.sin(theta) * Math.sin(phi);
    return [x * radius, y * radius, z * radius, x, y, z];
  };
  const addSegment = (a: number[], b: number[]) => {
    positions.push(...a.slice(0, 3), ...b.slice(0, 3));
    normals.push(...a.slice(3, 6), ...b.slice(3, 6));
    colors.push(...color, ...color);
  };
  for (let row = 2; row < rows - 1; row += 2) {
    const theta = (row / rows) * Math.PI;
    for (let col = 0; col < columns; col++) {
      const a = point(theta, (col / columns) * Math.PI * 2);
      const b = point(theta, ((col + 1) / columns) * Math.PI * 2);
      addSegment(a, b);
    }
  }
  for (let col = 0; col < columns; col += 8) {
    const phi = (col / columns) * Math.PI * 2;
    for (let row = 0; row < rows; row++) {
      const a = point((row / rows) * Math.PI, phi);
      const b = point(((row + 1) / rows) * Math.PI, phi);
      addSegment(a, b);
    }
  }
  return buildMesh(gl, positions, normals, colors, null, gl.LINES, 2);
}

function helix(gl: WebGLRenderingContext, turns: number, radius: number, height: number, color: [number, number, number], segments = 520) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let step = 0; step < 2; step++) {
      const t = (i + step) / segments;
      const angle = t * turns * Math.PI * 2;
      const r = radius + Math.sin(angle * 0.5) * 0.018;
      positions.push(Math.cos(angle) * r, (t - 0.5) * height, Math.sin(angle) * r);
      normals.push(Math.cos(angle), 0, Math.sin(angle));
      const shimmer = 0.75 + 0.25 * Math.sin(t * Math.PI * 82);
      colors.push(color[0] * shimmer, color[1] * shimmer, color[2] * shimmer);
    }
  }
  return buildMesh(gl, positions, normals, colors, null, gl.LINES, 2);
}

function crystal(gl: WebGLRenderingContext, radius: number, color: [number, number, number]) {
  const points: [number, number, number][] = [
    [0, 1.6, 0], [1, 0, 0], [0, 0, 1],
    [0, 1.6, 0], [0, 0, 1], [-1, 0, 0],
    [0, 1.6, 0], [-1, 0, 0], [0, 0, -1],
    [0, 1.6, 0], [0, 0, -1], [1, 0, 0],
    [0, -1.3, 0], [0, 0, 1], [1, 0, 0],
    [0, -1.3, 0], [-1, 0, 0], [0, 0, 1],
    [0, -1.3, 0], [0, 0, -1], [-1, 0, 0],
    [0, -1.3, 0], [1, 0, 0], [0, 0, -1],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (const vertex of points) {
    const length = Math.hypot(vertex[0], vertex[1], vertex[2]) || 1;
    positions.push(vertex[0] * radius, vertex[1] * radius, vertex[2] * radius);
    normals.push(vertex[0] / length, vertex[1] / length, vertex[2] / length);
    colors.push(...color);
  }
  return buildMesh(gl, positions, normals, colors, null, gl.TRIANGLES, 1);
}

function alienMembrane(
  gl: WebGLRenderingContext,
  turns: number,
  innerRadius: number,
  outerRadius: number,
  halfWidth: number,
  phase: number,
  colorA: [number, number, number],
  colorB: [number, number, number],
  segments = 280,
  across = 12
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = phase + t * turns * Math.PI * 2;
    const radius = innerRadius + (outerRadius - innerRadius) * t +
      Math.sin(angle * 1.7 + phase) * 0.025;
    const taper = Math.pow(Math.sin(Math.PI * t), 0.62);
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius;
    const centerY = (t - 0.5) * 0.64 + Math.sin(angle * 0.53 + phase) * 0.11;

    const nx0 = Math.cos(angle) * 0.72;
    const ny0 = Math.sin(angle * 1.31 + phase) * 0.52 + Math.cos(t * Math.PI * 2.0 + phase) * 0.16;
    const nz0 = Math.sin(angle) * 0.72;
    const nLength = Math.hypot(nx0, ny0, nz0) || 1;
    const nx = nx0 / nLength;
    const ny = ny0 / nLength;
    const nz = nz0 / nLength;

    for (let j = 0; j <= across; j++) {
      const v = (j / across) * 2 - 1;
      const rib = 1.0 - Math.pow(Math.abs(v), 1.8) * 0.24;
      const width = v * halfWidth * taper * rib;
      const bank = Math.sin(t * Math.PI * 7.0 + phase) * 0.11;
      const sideX = Math.cos(angle + bank) * width;
      const sideY = (Math.sin(angle * 0.7 + phase) * 0.22 + 0.14) * width;
      const sideZ = Math.sin(angle + bank) * width;

      positions.push(centerX + sideX, centerY + sideY, centerZ + sideZ);
      normals.push(nx, ny, nz);

      const blend = Math.min(1, Math.max(0, t * 0.65 + Math.abs(v) * 0.32));
      const shimmer = 0.78 + 0.22 * Math.sin(angle * 4.0 + v * 8.0);
      colors.push(
        (colorA[0] * (1 - blend) + colorB[0] * blend) * shimmer,
        (colorA[1] * (1 - blend) + colorB[1] * blend) * shimmer,
        (colorA[2] * (1 - blend) + colorB[2] * blend) * shimmer
      );
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  return buildMesh(gl, positions, normals, colors, indices, gl.TRIANGLES, 1);
}

function mobiusMembrane(
  gl: WebGLRenderingContext,
  majorRadius: number,
  halfWidth: number,
  phase: number,
  colorA: [number, number, number],
  colorB: [number, number, number],
  segments = 360,
  across = 16
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    const twist = u * 0.5 + phase;
    for (let j = 0; j <= across; j++) {
      const v = (j / across) * 2 - 1;
      const offset = v * halfWidth;
      const radius = majorRadius + offset * Math.cos(twist);
      const x = radius * Math.cos(u);
      const y = offset * Math.sin(twist);
      const z = radius * Math.sin(u);
      const nx = Math.cos(u) * Math.cos(twist);
      const ny = Math.sin(twist);
      const nz = Math.sin(u) * Math.cos(twist);
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      const blend = Math.min(1, Math.max(0, (i / segments) * 0.72 + Math.abs(v) * 0.28));
      const edgeGlint = 0.82 + 0.18 * Math.cos(v * Math.PI * 3.0 + u * 6.0);
      colors.push(
        (colorA[0] * (1 - blend) + colorB[0] * blend) * edgeGlint,
        (colorA[1] * (1 - blend) + colorB[1] * blend) * edgeGlint,
        (colorA[2] * (1 - blend) + colorB[2] * blend) * edgeGlint
      );
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return buildMesh(gl, positions, normals, colors, indices, gl.TRIANGLES, 1);
}

function alienKnot(
  gl: WebGLRenderingContext,
  majorRadius: number,
  minorRadius: number,
  p: number,
  q: number,
  phase: number,
  color: [number, number, number],
  segments = 1200
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let step = 0; step < 2; step++) {
      const t = ((i + step) / segments) * Math.PI * 2;
      const theta = q * t + phase;
      const phi = p * t + phase * 0.73;
      const radius = majorRadius + minorRadius * Math.cos(theta);
      const x = radius * Math.cos(phi);
      const y = minorRadius * Math.sin(theta) + Math.sin(t * 2.0 + phase) * 0.018;
      const z = radius * Math.sin(phi);
      const length = Math.hypot(x, y, z) || 1;
      const shimmer = 0.65 + 0.35 * Math.sin(t * 17.0 + phase);
      positions.push(x, y, z);
      normals.push(x / length, y / length, z / length);
      colors.push(color[0] * shimmer, color[1] * shimmer, color[2] * shimmer);
    }
  }
  return buildMesh(gl, positions, normals, colors, null, gl.LINES, 2);
}

function particleField(gl: WebGLRenderingContext, count = 360) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * 2.399963229728653;
    const spread = 0.64 + ((i * 17) % 45) / 100;
    positions.push(Math.cos(angle) * radius * spread, y * spread, Math.sin(angle) * radius * spread);
    normals.push(0, 0, 1);
    const violet = i % 4 !== 0;
    colors.push(violet ? 0.62 : 0.24, violet ? 0.28 : 0.82, violet ? 1.0 : 1.0);
  }
  return buildMesh(gl, positions, normals, colors, null, gl.POINTS, 2);
}

function translate(x: number, y: number, z: number) {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scale(value: number) {
  const out = identity();
  out[0] = value;
  out[5] = value;
  out[10] = value;
  return out;
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
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

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
        // Main filigree cage and four independent orbital planes.
        geodesicCage(gl, 0.63, [0.39, 0.21, 0.82], 2),
        torus(gl, 0.69, 0.006, [0.52, 0.23, 1.0]),
        torus(gl, 0.60, 0.0045, [0.18, 0.83, 1.0]),
        torus(gl, 0.76, 0.004, [0.78, 0.42, 1.0]),
        torus(gl, 0.81, 0.0027, [0.39, 0.69, 1.0], 240, 6, 0.25, Math.PI * 1.76, 2),
        torus(gl, 0.84, 0.0022, [0.63, 0.36, 1.0], 220, 6, Math.PI * 1.12, Math.PI * 2.72, 2),
        torus(gl, 0.52, 0.0035, [0.22, 0.65, 1.0], 180, 6, Math.PI * 0.12, Math.PI * 1.65, 2),
        torus(gl, 0.45, 0.003, [0.66, 0.39, 1.0], 180, 6, Math.PI * 1.1, Math.PI * 2.68, 2),
        torus(gl, 0.93, 0.002, [0.30, 0.46, 0.9], 260, 5, Math.PI * 0.28, Math.PI * 1.45, 2),
        torus(gl, 0.38, 0.0035, [0.3, 0.78, 1.0], 180, 6, Math.PI * 0.65, Math.PI * 1.9, 2),
        // Nested translucent shells and a luminous inner seed.
        sphere(gl, 0.47, [0.18, 0.05, 0.47], 56, 88, 1),
        sphere(gl, 0.405, [0.24, 0.08, 0.68], 52, 80, 1),
        geodesicCage(gl, 0.365, [0.34, 0.16, 0.72], 1),
        sphere(gl, 0.30, [0.10, 0.20, 0.60], 48, 72, 1),
        sphere(gl, 0.205, [0.14, 0.44, 0.78], 40, 60, 1),
        sphere(gl, 0.125, [0.46, 0.72, 1.0], 36, 54, 1),
        sphere(gl, 0.052, [0.8, 0.93, 1.0], 28, 42, 1),
        // A fine helical filament floating through the inner structure.
        helix(gl, 5.2, 0.255, 0.56, [0.38, 0.48, 1.0]),
        crystal(gl, 0.054, [0.4, 0.18, 1.0]),
        crystal(gl, 0.026, [0.28, 0.8, 1.0]),
        sphere(gl, 0.018, [0.75, 0.55, 1.0], 12, 18, 1),
        particleField(gl, 620),
        // Asymmetric translucent vanes: alien, organic geometry rather than stacked rings.
        alienMembrane(gl, 1.22, 0.10, 0.86, 0.095, 0.22, [0.16, 0.60, 1.0], [0.62, 0.20, 1.0], 270, 12),
        alienMembrane(gl, 1.05, 0.12, 0.78, 0.072, 2.12, [0.48, 0.18, 1.0], [0.14, 0.75, 1.0], 250, 10),
        alienMembrane(gl, 1.42, 0.18, 0.72, 0.058, 4.22, [0.28, 0.36, 1.0], [0.72, 0.30, 1.0], 280, 10),
        alienMembrane(gl, 0.92, 0.08, 0.66, 0.045, 5.30, [0.12, 0.70, 1.0], [0.55, 0.31, 1.0], 240, 8),
        // Non-Euclidean-looking, interlaced topologies wrapped around the inner seed.
        mobiusMembrane(gl, 0.43, 0.108, 0.22, [0.16, 0.56, 1.0], [0.76, 0.27, 1.0], 340, 16),
        mobiusMembrane(gl, 0.49, 0.058, 2.15, [0.32, 0.34, 1.0], [0.16, 0.78, 1.0], 360, 12),
        alienKnot(gl, 0.47, 0.135, 2, 3, 0.35, [0.44, 0.22, 1.0], 1400),
        alienKnot(gl, 0.39, 0.11, 3, 2, 2.05, [0.14, 0.68, 1.0], 1300)
      ];
    } catch {
      host.dataset.webgl = "error";
      return;
    }

    const meshAt = (index: number): Mesh => {
      const mesh = meshes[index];
      if (!mesh) throw new Error("Geometria 3D ausente: " + index);
      return mesh;
    };

    const locations = {
      position: gl.getAttribLocation(sceneProgram, "aPosition"),
      normal: gl.getAttribLocation(sceneProgram, "aNormal"),
      color: gl.getAttribLocation(sceneProgram, "aColor"),
      mvp: gl.getUniformLocation(sceneProgram, "uMvp"),
      model: gl.getUniformLocation(sceneProgram, "uModel"),
      opacity: gl.getUniformLocation(sceneProgram, "uOpacity"),
      pointSize: gl.getUniformLocation(sceneProgram, "uPointSize"),
      pointMode: gl.getUniformLocation(sceneProgram, "uPointMode"),
      time: gl.getUniformLocation(sceneProgram, "uTime"),
      material: gl.getUniformLocation(sceneProgram, "uMaterial")
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

    function draw(mesh: Mesh, projectionMatrix: Float32Array, model: Float32Array, opacity: number, pointMode: boolean, elapsed: number) {
      const mvp = multiply(projectionMatrix, model);
      bindMesh(mesh);
      gl.uniformMatrix4fv(locations.mvp, false, mvp);
      gl.uniformMatrix4fv(locations.model, false, model);
      gl.uniform1f(locations.opacity, opacity);
      gl.uniform1f(locations.pointSize, Math.max(2, Math.min(5, canvas.width / 92)));
      gl.uniform1f(locations.pointMode, pointMode ? 1 : 0);
      gl.uniform1f(locations.time, elapsed);
      gl.uniform1f(locations.material, mesh.material);
      if (mesh.indices) gl.drawElements(mesh.mode, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      else gl.drawArrays(mesh.mode, 0, mesh.vertexCount);
    }

    const startedAt = performance.now();
    function render(now = startedAt) {
      if (disposed) return;
      resize();
      const elapsed = reducedMotion ? 0 : (now - startedAt) * 0.001;
      const sceneTime = elapsed * (activeRef.current ? 1.0 : 0.46);
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
      angle += reducedMotion ? 0 : (activeRef.current ? 0.012 : 0.0045);
      const breathing = Math.sin(sceneTime * 0.42) * 0.035;
      const tilt = rotateX(0.2 + smoothPointerY * 0.28 + Math.sin(angle * 0.36) * 0.045);
      const yaw = rotateY(angle * 0.62 + smoothPointerX * 0.3);
      const cameraX = -smoothPointerX * 0.075;
      const cameraY = smoothPointerY * 0.055;
      const cameraDepth = -3.15 + Math.sin(sceneTime * 0.22) * 0.055;
      const breathingScale = 1 + Math.sin(sceneTime * 0.31) * 0.012;
      const base = multiply(translate(cameraX, cameraY, cameraDepth), multiply(tilt, multiply(yaw, scale(breathingScale))));
      const withScale = (model: Float32Array, amount: number) => multiply(model, scale(amount));

      // Background filigree cage and orbital skeleton.
      draw(meshAt(0), projectionMatrix, multiply(base, rotateY(-angle * 0.13)), 0.44, false, sceneTime);
      draw(meshAt(1), projectionMatrix, multiply(base, rotateX(0.14 + Math.sin(angle * 0.22) * 0.05)), 0.82, false, sceneTime);
      draw(meshAt(2), projectionMatrix, multiply(base, multiply(rotateX(1.02), rotateZ(0.58 + angle * 0.16))), 0.76, false, sceneTime);
      draw(meshAt(3), projectionMatrix, multiply(base, multiply(rotateY(1.25), rotateZ(-0.38 - angle * 0.12))), 0.69, false, sceneTime);
      draw(meshAt(4), projectionMatrix, multiply(base, multiply(rotateX(0.82), rotateZ(angle * 0.27))), 0.72, false, sceneTime);
      draw(meshAt(5), projectionMatrix, multiply(base, multiply(rotateY(0.74), rotateX(1.37 - angle * 0.19))), 0.66, false, sceneTime);
      draw(meshAt(6), projectionMatrix, multiply(base, multiply(rotateX(1.22), rotateZ(-angle * 0.24))), 0.60, false, sceneTime);
      draw(meshAt(7), projectionMatrix, multiply(base, multiply(rotateY(0.43), rotateZ(angle * 0.18))), 0.72, false, sceneTime);
      draw(meshAt(8), projectionMatrix, multiply(base, multiply(rotateX(1.42), rotateY(-angle * 0.11))), 0.65, false, sceneTime);
      draw(meshAt(9), projectionMatrix, multiply(base, multiply(rotateX(0.22), rotateZ(angle * 0.17))), 0.74, false, sceneTime);

      // Nested membranes: faint outer skin to a bright internal seed.
      gl.depthMask(false);
      draw(meshAt(10), projectionMatrix, withScale(base, 1 + breathing), 0.17, false, sceneTime);
      draw(meshAt(11), projectionMatrix, multiply(base, rotateY(-angle * 0.28)), 0.25, false, sceneTime);
      draw(meshAt(12), projectionMatrix, multiply(base, rotateZ(angle * 0.08)), 0.37, false, sceneTime);
      draw(meshAt(13), projectionMatrix, multiply(base, rotateX(angle * 0.26)), 0.32, false, sceneTime);
      draw(meshAt(14), projectionMatrix, multiply(base, rotateY(angle * 0.34)), 0.46, false, sceneTime);
      draw(meshAt(15), projectionMatrix, withScale(multiply(base, rotateZ(-angle * 0.24)), 1 + breathing * 1.7), 0.72, false, sceneTime);
      draw(meshAt(16), projectionMatrix, withScale(multiply(base, rotateY(angle * 0.42)), 1 + breathing * 2.5), 0.95, false, sceneTime);

      // A delicate filament threads through the core's interior.
      draw(meshAt(17), projectionMatrix, multiply(base, multiply(rotateX(Math.sin(angle * 0.17) * 0.17), rotateY(angle * 0.28))), 0.8, false, sceneTime);

      // Translucent alien vanes drift around the core on their own phase.
      draw(meshAt(22), projectionMatrix, multiply(base, multiply(rotateX(0.22 + Math.sin(sceneTime * 0.24) * 0.09), rotateZ(angle * 0.08))), 0.42, false, sceneTime);
      draw(meshAt(23), projectionMatrix, multiply(base, multiply(rotateY(0.52 + Math.sin(sceneTime * 0.19) * 0.08), rotateZ(-angle * 0.07))), 0.34, false, sceneTime);
      draw(meshAt(24), projectionMatrix, multiply(base, multiply(rotateX(1.42 + Math.sin(sceneTime * 0.16) * 0.07), rotateY(angle * 0.06))), 0.29, false, sceneTime);
      draw(meshAt(25), projectionMatrix, multiply(base, multiply(rotateY(1.02 + Math.sin(sceneTime * 0.22) * 0.06), rotateZ(angle * 0.05))), 0.31, false, sceneTime);

      // Impossible-looking intertwined topology, suspended inside the outer vanes.
      draw(meshAt(26), projectionMatrix, multiply(base, multiply(rotateX(0.74 + Math.sin(sceneTime * 0.17) * 0.08), rotateZ(angle * 0.12))), 0.52, false, sceneTime);
      draw(meshAt(27), projectionMatrix, multiply(base, multiply(rotateY(0.91 + Math.sin(sceneTime * 0.21) * 0.07), rotateZ(-angle * 0.09))), 0.39, false, sceneTime);
      draw(meshAt(28), projectionMatrix, multiply(base, multiply(rotateX(1.10), rotateZ(angle * 0.13))), 0.7, false, sceneTime);
      draw(meshAt(29), projectionMatrix, multiply(base, multiply(rotateY(0.67), rotateX(-angle * 0.11))), 0.62, false, sceneTime);

      // Faceted alien crystal shards and pearls orbit at individual depths.
      const orbitRadius = 0.86;
      for (let i = 0; i < 9; i++) {
        const orbit = sceneTime * (0.16 + (i % 3) * 0.045) + (i / 9) * Math.PI * 2;
        const x = Math.cos(orbit) * orbitRadius;
        const y = Math.sin(orbit * 1.1 + i) * 0.52;
        const z = Math.sin(orbit) * orbitRadius * 0.78;
        const nodeBase = multiply(base, translate(x, y, z));
        const shard = multiply(nodeBase, multiply(rotateY(orbit * 1.3), rotateZ(orbit * 0.7)));
        const crystalIndex = i % 2 === 0 ? 18 : 19;
        draw(meshAt(crystalIndex), projectionMatrix, withScale(shard, 0.64 + (i % 4) * 0.13), 0.9, false, sceneTime);
        const pearl = multiply(nodeBase, translate(0.03, 0.02, 0.01));
        draw(meshAt(20), projectionMatrix, withScale(pearl, i % 3 === 0 ? 1.5 : 0.9), 0.9, false, sceneTime);
      }

      // The dust halo extends beyond the geometry and catches light in depth.
      draw(meshAt(21), projectionMatrix, multiply(base, rotateY(-angle * 0.16)), activeRef.current ? 0.9 : 0.66, true, sceneTime);
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
  }, []);

  return (
    <div
      ref={hostRef}
      className="orbital-core-3d"
      data-active={active ? "true" : "false"}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "auto", zIndex: 2 }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="orbital-core-3d-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none", zIndex: 1 }}
      />
      <span className="orbital-3d-caption orbital-3d-caption--top" style={{ position: "absolute", zIndex: 4, top: "10%", left: "50%", transform: "translateX(-50%)", color: "rgba(201, 163, 255, .86)", font: "500 7px/1 monospace", letterSpacing: "0.16em", whiteSpace: "nowrap", pointerEvents: "none" }}>J.A.R.V.I.S. / 3D CORE</span>
      <span className="orbital-3d-caption orbital-3d-caption--left" style={{ position: "absolute", zIndex: 4, top: "50%", left: "-5%", transform: "translateY(-50%) rotate(-90deg)", color: "rgba(177, 128, 255, .7)", font: "500 6px/1 monospace", letterSpacing: "0.15em", whiteSpace: "nowrap", pointerEvents: "none" }}>DEPTH · 3 AXIS</span>
      <span className="orbital-3d-caption orbital-3d-caption--right" style={{ position: "absolute", zIndex: 4, top: "50%", right: "-7%", transform: "translateY(-50%) rotate(90deg)", color: "rgba(120, 223, 255, .75)", font: "500 6px/1 monospace", letterSpacing: "0.15em", whiteSpace: "nowrap", pointerEvents: "none" }}>WEBGL / LIVE</span>
      <span className="orbital-3d-target" style={{ position: "absolute", zIndex: 3, inset: "20%", border: "1px solid rgba(170, 112, 255, .12)", borderRadius: "50%", boxShadow: "0 0 24px rgba(142, 60, 255, .08) inset", pointerEvents: "none" }} />
    </div>
  );
}

export function OrbitalCore({ active = false, muted = false, className = "" }: { active?: boolean; muted?: boolean; className?: string }) {
  return (
    <div
      className={cn("orbital-core", "orbital-core--webgl", className, active && "orbital-core--active", muted && "orbital-core--muted")}
      data-active={active}
      aria-hidden="true"
    >
      <OrbitalCore3D active={active} />
      <div className="orbital-core-hud" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        <span className="orbital-core-hud-crosshair" style={{ position: "absolute", inset: "18px", borderLeft: "1px solid rgba(177, 128, 255, .14)", borderRight: "1px solid rgba(177, 128, 255, .14)" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--one" style={{ position: "absolute", top: "22%", left: "20%", width: 5, height: 5, borderRadius: "50%", background: "#b17cff", boxShadow: "0 0 12px #9b4dff" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--two" style={{ position: "absolute", top: "70%", right: "15%", width: 4, height: 4, borderRadius: "50%", background: "#78dfff", boxShadow: "0 0 10px #78dfff" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--three" style={{ position: "absolute", bottom: "18%", left: "29%", width: 4, height: 4, borderRadius: "50%", background: "#d7a8ff", boxShadow: "0 0 10px #b17cff" }} />
      </div>
    </div>
  );
}
