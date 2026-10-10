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


type MorphParticleCloud = {
  mesh: Mesh;
  idle: Float32Array;
  avatar: Float32Array;
  phases: Float32Array;
  roles: Uint8Array;
  sides: Float32Array;
};

function makeMorphParticleCloud(gl: WebGLRenderingContext, count = 3600): MorphParticleCloud {
  const idle = new Float32Array(count * 3);
  const avatar = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const roles = new Uint8Array(count);
  const sides = new Float32Array(count);
  const normals: number[] = [];
  const colors: number[] = [];
  let seed = 73129;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const k = i * 3;
    phases[i] = random() * Math.PI * 2;
    idle[k] = (random() * 2 - 1) * 2.15;
    idle[k + 1] = (random() * 2 - 1) * 1.35;
    idle[k + 2] = (random() * 2 - 1) * 0.72;

    let x = 0, y = 0, z = 0;
    let color: [number, number, number] = [0.30, 0.55, 1.0];
    let role = 3;
    let side = 0;

    if (i < 1150) {
      // A softly volumetric face plane, tapered into a jaw and rounded temples.
      y = -0.39 + random() * 1.10;
      const ellipse = Math.sqrt(Math.max(0.025, 1 - Math.pow((y - 0.16) / 0.56, 2)));
      const jawTaper = y < 0.12 ? 0.66 + 0.34 * Math.max(0, (y + 0.39) / 0.51) : 1;
      const halfWidth = 0.365 * ellipse * jawTaper;
      x = (random() * 2 - 1) * halfWidth;
      const depth = Math.sqrt(Math.max(0.06, 1 - Math.pow(x / Math.max(0.01, halfWidth), 2)));
      z = 0.11 + depth * 0.17 + random() * 0.035;
      color = [0.32 + random() * 0.12, 0.43 + random() * 0.19, 0.92 + random() * 0.08];
      role = 3;
    } else if (i < 1900) {
      // Long, separate particle strands form a luminous, flowing hair silhouette.
      const t = random();
      side = random() < 0.5 ? -1 : 1;
      x = side * (0.085 + 0.43 * Math.sin(t * 1.28)) + (random() - 0.5) * 0.065;
      y = 0.72 - t * 1.30;
      z = 0.07 + 0.12 * Math.sin(t * Math.PI) + random() * 0.06;
      color = [0.48 + random() * 0.22, 0.22 + random() * 0.10, 0.94 + random() * 0.06];
      role = 3;
    } else if (i < 2550) {
      // Shoulder line and upper torso, separated from the moving head.
      y = -0.37 - random() * 0.61;
      const depthRatio = Math.max(0, 1 - Math.pow((y + 0.40) / 0.63, 2));
      const width = 0.20 + 0.49 * Math.sqrt(depthRatio);
      x = (random() * 2 - 1) * width;
      z = -0.07 + 0.17 * Math.sqrt(Math.max(0, 1 - Math.pow(x / width, 2))) + (random() - 0.5) * 0.05;
      color = [0.20 + random() * 0.12, 0.48 + random() * 0.22, 0.97];
      role = 4;
    } else {
      const f = i - 2550;
      if (f < 280) {
        // Two independently blinking orbital eye contours.
        side = f % 2 === 0 ? -1 : 1;
        const a = random() * Math.PI * 2;
        x = side * 0.16 + Math.cos(a) * 0.098;
        y = 0.255 + Math.sin(a) * 0.037;
        z = 0.405 + random() * 0.018;
        color = [0.40, 0.83, 1.0];
        role = 6;
      } else if (f < 400) {
        side = f % 2 === 0 ? -1 : 1;
        const a = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * 0.022;
        x = side * 0.16 + Math.cos(a) * radius;
        y = 0.255 + Math.sin(a) * radius;
        z = 0.432;
        color = [0.62, 0.92, 1.0];
        role = 5;
      } else if (f < 600) {
        side = f % 2 === 0 ? -1 : 1;
        const t = random();
        x = side * (0.16 + (t - 0.5) * 0.21);
        y = 0.355 + Math.sin(t * Math.PI) * 0.035;
        z = 0.402;
        color = [0.68, 0.39, 1.0];
        role = 3;
      } else if (f < 800) {
        const t = random();
        y = 0.28 - t * 0.30;
        x = (random() - 0.5) * (0.018 + 0.062 * t);
        z = 0.405 + 0.025 * Math.sin(t * Math.PI);
        color = [0.42, 0.72, 1.0];
        role = 3;
      } else if (f < 1000) {
        const t = random() * 2 - 1;
        const lowerLip = f % 2 === 0;
        x = t * 0.145;
        y = lowerLip ? -0.107 - 0.037 * (1 - t * t) : -0.104 + 0.022 * Math.sin((t + 1) * Math.PI * 0.5);
        z = 0.425 + random() * 0.012;
        color = lowerLip ? [0.42, 0.63, 1.0] : [0.76, 0.38, 1.0];
        role = lowerLip ? 1 : 2;
      } else {
        const a = Math.PI + random() * Math.PI;
        x = 0.33 * Math.cos(a);
        y = 0.10 + 0.46 * Math.sin(a);
        z = 0.29;
        color = [0.47, 0.63, 1.0];
        role = 3;
      }
    }

    avatar[k] = x;
    avatar[k + 1] = y;
    avatar[k + 2] = z;
    roles[i] = role;
    sides[i] = side;
    normals.push(0, 0, 1);
    colors.push(color[0], color[1], color[2]);
  }

  const mesh = buildMesh(gl, Array.from(idle), normals, colors, null, gl.POINTS, 3);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions);
  gl.bufferData(gl.ARRAY_BUFFER, idle, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return { mesh, idle, avatar, phases, roles, sides };
}

type HoloParticle = {
  idleX: number;
  idleY: number;
  phase: number;
  speed: number;
  size: number;
  color: number;
  role: number;
  targetX: number;
  targetY: number;
};

function ParticleAvatarOverlay({ active, speaking }: { active: boolean; speaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const speakingRef = useRef(speaking);
  const voiceLevelRef = useRef(0);
  const measuredRef = useRef(false);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);

  useEffect(() => {
    const onVoiceLevel = (event: Event) => {
      const detail = (event as CustomEvent<{ level?: number; measured?: boolean }>).detail;
      voiceLevelRef.current = Math.max(0, Math.min(1, detail?.level ?? 0));
      measuredRef.current = detail?.measured === true;
    };
    window.addEventListener("jarvis:voice-level", onVoiceLevel);
    return () => window.removeEventListener("jarvis:voice-level", onVoiceLevel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !host || !ctx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let blend = 0;
    let voiceLevel = 0;
    let pointerX = 0.5;
    let pointerY = 0.48;
    let disposed = false;
    const tau = Math.PI * 2;
    let seed = 835217;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const particles: HoloParticle[] = [];
    const add = (x: number, y: number, role: number, color: number, size = 0.52 + random() * 0.72) => {
      particles.push({
        idleX: random(),
        idleY: random(),
        phase: random() * tau,
        speed: 0.12 + random() * 0.5,
        size,
        color,
        role,
        targetX: x,
        targetY: y,
      });
    };

    const addCurve = (
      start: [number, number],
      control: [number, number],
      end: [number, number],
      count: number,
      role: number,
      color: number,
      size = 0.58,
    ) => {
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const inverse = 1 - t;
        const x = inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0];
        const y = inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1];
        add(x, y, role, color, size + random() * 0.24);
      }
    };

    // Sculptural shell: an asymmetrical, turned head with a smooth masked face.
    // Facial details are intentionally restrained, matching the chrome reference.
    for (let i = 0; i < 3600; i++) {
      const y = 0.105 + random() * 0.385;
      const t = (y - 0.295) / 0.195;
      const oval = Math.sqrt(Math.max(0.012, 1 - t * t));
      const narrowJaw = y > 0.34 ? 1 - Math.min(0.34, ((y - 0.34) / 0.15) * 0.34) : 1;
      const cheek = 1 + 0.045 * Math.exp(-Math.pow((y - 0.36) / 0.075, 2));
      const half = 0.135 * oval * narrowJaw * cheek;
      const centre = 0.515 + (y > 0.27 ? 0.014 : 0) + Math.max(0, 0.34 - y) * 0.035;
      const x = centre + (random() * 2 - 1) * half;
      const profile = y > 0.33 && y < 0.405 && x > centre + half * 0.58;
      add(x, y, profile ? 6 : 0, random() < 0.10 ? 4 : random() < 0.40 ? 2 : 0, 0.46 + random() * 0.68);
    }

    // Silvery perimeter and tapered jaw, brighter only along selected highlights.
    for (let i = 0; i < 640; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const t = random();
      const y = 0.13 + t * 0.355;
      const v = (y - 0.295) / 0.195;
      const oval = Math.sqrt(Math.max(0.01, 1 - v * v));
      const jaw = y > 0.34 ? 1 - Math.min(0.34, ((y - 0.34) / 0.15) * 0.34) : 1;
      const half = 0.135 * oval * jaw;
      add(0.515 + side * (half + (random() - 0.5) * 0.004), y, 5, random() < 0.55 ? 4 : 2, 0.68 + random() * 0.72);
    }

    // Fine horizontal metallic ribs across the mask, like polished laminated chrome.
    for (let row = 0; row < 38; row++) {
      const y0 = 0.16 + row * 0.0069;
      const t = (y0 - 0.295) / 0.195;
      const oval = Math.sqrt(Math.max(0.012, 1 - t * t));
      const jaw = y0 > 0.34 ? 1 - Math.min(0.34, ((y0 - 0.34) / 0.15) * 0.34) : 1;
      const half = 0.136 * oval * jaw;
      const count = 60 + (row % 3) * 8;
      for (let i = 0; i < count; i++) {
        const u = i / (count - 1);
        const sweep = Math.sin(u * Math.PI * 1.18 + row * 0.11) * 0.009;
        const noseLift = row > 22 && row < 29 ? Math.pow(u, 7) * 0.012 : 0;
        const x = 0.515 + (y0 > 0.27 ? 0.014 : 0) + (u * 2 - 1) * half + sweep + noseLift;
        const y = y0 + Math.sin(u * Math.PI * 2.5 + row * 0.32) * 0.0019 + (random() - 0.5) * 0.0018;
        const glint = Math.sin(u * Math.PI * 4.2 + row * 0.56);
        const color = glint > 0.82 ? 5 : glint > 0.22 ? 4 : glint < -0.58 ? 2 : 0;
        add(x, y, row > 27 ? 7 : 3, color, glint > 0.82 ? 1.02 + random() * 0.55 : 0.48 + random() * 0.45);
      }
    }

    // Eyes, brows, nose and lips are separate particle contours so the face reads as a woman,
    // not as a smooth anonymous mask. Fine silver lines stay legible without filling the face.
    for (const side of [-1, 1]) {
      const eyeX = 0.529 + side * 0.043;
      addCurve([eyeX - 0.021, 0.267], [eyeX, 0.249], [eyeX + 0.021, 0.267], 34, 3, 4, 0.54);
      addCurve([eyeX - 0.019, 0.278], [eyeX, 0.264], [eyeX + 0.019, 0.278], 32, 3, 5, 0.53);
      addCurve([eyeX - 0.018, 0.279], [eyeX, 0.289], [eyeX + 0.018, 0.279], 26, 3, 2, 0.42);

      for (let i = 0; i < 34; i++) {
        const angle = (i / 34) * tau;
        add(eyeX + Math.cos(angle) * 0.0068, 0.277 + Math.sin(angle) * 0.0062, 3, i % 3 === 0 ? 5 : 4, 0.56);
      }
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * tau;
        add(eyeX + Math.cos(angle) * 0.0028, 0.277 + Math.sin(angle) * 0.0028, 3, 5, 0.65);
      }
    }

    // Bridge and tip: slight asymmetry catches a cool highlight like polished titanium.
    addCurve([0.524, 0.282], [0.520, 0.317], [0.528, 0.351], 44, 3, 4, 0.48);
    addCurve([0.535, 0.288], [0.540, 0.323], [0.533, 0.350], 38, 3, 2, 0.39);
    addCurve([0.515, 0.356], [0.528, 0.365], [0.543, 0.356], 30, 3, 5, 0.52);
    addCurve([0.516, 0.361], [0.520, 0.365], [0.524, 0.363], 12, 3, 2, 0.40);
    addCurve([0.533, 0.363], [0.537, 0.365], [0.541, 0.360], 12, 3, 2, 0.40);

    // Soft, precise lips with a defined cupid's bow and lower-lip highlight.
    addCurve([0.501, 0.389], [0.514, 0.378], [0.529, 0.389], 28, 7, 4, 0.48);
    addCurve([0.529, 0.389], [0.544, 0.378], [0.558, 0.389], 28, 7, 4, 0.48);
    addCurve([0.501, 0.389], [0.529, 0.410], [0.558, 0.389], 42, 7, 2, 0.45);
    addCurve([0.509, 0.392], [0.529, 0.398], [0.549, 0.392], 28, 7, 5, 0.48);

    // Crown of the head, built from curved reflective contours rather than a round halo.
    for (let strand = 0; strand < 42; strand++) {
      const startX = 0.39 + (strand / 41) * 0.245;
      const count = 45;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = startX + Math.sin(t * Math.PI) * (0.515 - startX) * 0.9 + Math.sin(t * 4 + strand) * 0.002;
        const y = 0.285 - Math.sin(t * Math.PI) * (0.20 + (strand % 5) * 0.003) + (random() - 0.5) * 0.0025;
        add(x, y, 1, random() < 0.22 ? 5 : random() < 0.6 ? 4 : 2, 0.48 + random() * 0.62);
      }
    }

    // Flowing metallic hair / veil: long tapered strands drape around both temples and shoulders.
    for (let strand = 0; strand < 54; strand++) {
      const side = strand % 2 === 0 ? -1 : 1;
      const start = 0.105 + random() * 0.09;
      const drift = 0.12 + random() * 0.12;
      const wave = 0.008 + random() * 0.014;
      const count = 66;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = 0.515 + side * (start + drift * t + Math.sin(t * 5.1 + strand * 0.27) * wave + 0.013 * Math.sin(t * Math.PI));
        const y = 0.155 + t * (0.56 + (strand % 6) * 0.018) + Math.sin(t * 7.0 + strand * 0.21) * 0.007;
        const edge = Math.abs(Math.sin(t * 10 + strand * 0.35));
        add(x, y, 1, edge > 0.76 ? 5 : edge > 0.32 ? 4 : 2, 0.48 + random() * 0.68);
      }
    }

    // Wider, folded metal veils emerge from behind the skull and spill over the shoulders.
    for (let fold = 0; fold < 20; fold++) {
      const side = fold % 2 === 0 ? -1 : 1;
      const startX = 0.515 + side * (0.10 + random() * 0.08);
      const endX = 0.515 + side * (0.24 + random() * 0.12);
      const startY = 0.37 + random() * 0.10;
      const endY = 0.73 + random() * 0.15;
      const curl = (random() - 0.5) * 0.07;
      for (let i = 0; i < 190; i++) {
        const t = i / 189;
        const x = startX + (endX - startX) * t + Math.sin(t * Math.PI * 1.7 + fold) * curl;
        const y = startY + (endY - startY) * t + Math.sin(t * Math.PI * 2 + fold * 0.22) * 0.025;
        const specular = Math.sin(t * Math.PI * 8 + fold * 0.4);
        add(x, y, 10, specular > 0.7 ? 5 : specular > -0.2 ? 4 : 2, 0.5 + random() * 0.75);
      }
    }

    // Upper torso: graceful shoulders, long neck, collarbones and tapered ribcage.
    for (let i = 0; i < 3300; i++) {
      const y = 0.535 + random() * 0.405;
      let halfWidth: number;
      if (y < 0.63) {
        halfWidth = 0.058 + ((y - 0.535) / 0.095) * 0.085;
      } else if (y < 0.72) {
        halfWidth = 0.143 + ((y - 0.63) / 0.09) * 0.17;
      } else if (y < 0.81) {
        halfWidth = 0.313 - ((y - 0.72) / 0.09) * 0.025;
      } else {
        halfWidth = 0.288 - ((y - 0.81) / 0.13) * 0.12;
      }
      const drape = 0.012 * Math.sin(y * 31 + random() * 2);
      const x = 0.51 + (random() * 2 - 1) * halfWidth + drape;
      const color = random() < 0.10 ? 5 : random() < 0.38 ? 4 : random() < 0.45 ? 2 : 0;
      add(x, y, 2, color, 0.44 + random() * 0.70);
    }

    // Long folds skim diagonally over the bust and torso, creating a liquid-metal garment.
    for (let fold = 0; fold < 26; fold++) {
      const direction = fold % 2 === 0 ? 1 : -1;
      const startY = 0.62 + (fold / 26) * 0.17;
      const startX = direction > 0 ? 0.30 : 0.70;
      const endX = direction > 0 ? 0.70 : 0.30;
      const vertical = 0.08 + random() * 0.09;
      const curve = (random() - 0.5) * 0.055;
      const count = 160;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = startX + (endX - startX) * t + Math.sin(t * Math.PI) * curve + Math.sin(t * 4.5 + fold) * 0.003;
        const y = startY + vertical * t + Math.sin(t * Math.PI * 1.35 + fold * 0.4) * 0.018;
        const highlight = Math.sin(t * Math.PI * 7 + fold * 0.7);
        add(x, y, 11, highlight > 0.76 ? 5 : highlight > -0.12 ? 4 : 2, 0.5 + random() * 0.68);
      }
    }

    // Bright collarbone curves and shoulder seams, like chrome strips folded into a sculpture.
    for (let strand = 0; strand < 18; strand++) {
      const side = strand % 2 === 0 ? -1 : 1;
      const startX = 0.51 + side * (0.035 + random() * 0.07);
      const endX = 0.51 + side * (0.25 + random() * 0.055);
      const count = 120;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = startX + (endX - startX) * t;
        const y = 0.62 + t * 0.105 + Math.sin(t * Math.PI) * (side * 0.014) + Math.sin(t * 5 + strand) * 0.002;
        add(x, y, 10, Math.sin(t * Math.PI * 8 + strand) > 0.2 ? 5 : 4, 0.56 + random() * 0.72);
      }
    }

    function resize() {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.round(width * dpr);
      const nextHeight = Math.round(height * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Real chrome palette, not violet glow: cold steel, polished silver and icy highlights.
    const palette = ["#a8b6c2", "#d8e0e7", "#7793a6", "#c4d8e5", "#eef5f9", "#ffffff"];
    const particlesByColor = palette.map((_, color) => {
      const indices: number[] = [];
      for (let i = 0; i < particles.length; i++) {
        if (particles[i]!.color === color) indices.push(i);
      }
      return indices;
    });
    const pointX = new Float32Array(particles.length);
    const pointY = new Float32Array(particles.length);
    const pointR = new Float32Array(particles.length);

    function render(now: number) {
      if (disposed) return;
      resize();
      const time = now * 0.001;
      // Keep the portrait recognizable in standby; active voice tightens it into a crisp hologram.
      const targetBlend = activeRef.current ? 1 : 0.82;
      blend += (targetBlend - blend) * 0.026;
      if (Math.abs(targetBlend - blend) < 0.0008) blend = targetBlend;
      voiceLevel += (voiceLevelRef.current - voiceLevel) * 0.36;
      const synthetic = Math.max(0, Math.sin(time * 11.8 + Math.sin(time * 2.1) * 0.7));
      const mouthOpen = speakingRef.current ? (measuredRef.current ? voiceLevel : synthetic * 0.72) * 0.012 : 0;
      const lookX = (pointerX - 0.5) * 0.008;
      const lookY = (pointerY - 0.48) * 0.006;

      // Clean transparent canvas: all silhouette and reflections come from particles themselves.
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const phase = p.phase + time * p.speed;
        let idleX = ((p.idleX + time * p.speed * 0.12 + Math.sin(time * 0.18 + p.phase) * 0.045 + 1) % 1) * width;
        let idleY = ((p.idleY + time * p.speed * (i % 2 === 0 ? 0.045 : -0.045) + Math.sin(time * 0.21 + p.phase * 1.3) * 0.07 + 1) % 1) * height;
        const dx = idleX - pointerX * width;
        const dy = idleY - pointerY * height;
        const distanceSquared = dx * dx + dy * dy;
        const influence = Math.exp(-distanceSquared / Math.max(2800, Math.pow(Math.min(width, height) * 0.17, 2)));
        const distance = Math.sqrt(distanceSquared + 1);
        idleX += (dx / distance) * influence * 34 - (dy / distance) * influence * 12;
        idleY += (dy / distance) * influence * 34 + (dx / distance) * influence * 12;

        let tx = p.targetX;
        let ty = p.targetY;
        if (p.role === 0 || p.role === 3 || p.role === 4 || p.role === 5 || p.role === 6 || p.role === 7) {
          tx += lookX;
          ty += lookY * 0.55 + Math.sin(time * 0.72 + p.phase) * 0.0012;
        }
        if (p.role === 1 || p.role === 10) {
          tx += Math.sin(time * 0.8 + p.phase) * 0.002;
          ty += Math.sin(time * 0.72 + p.phase) * 0.003;
        }
        if (p.role === 11) {
          ty += Math.sin(time * 0.8 + p.phase) * 0.0015;
          if (p.targetY > 0.73 && p.targetY < 0.78) ty += mouthOpen;
        }
        if (p.role === 7) ty += mouthOpen;
        const mix = blend;
        const avatarX = width * 0.5 + (tx - 0.5) * height * 1.36;
        const x = idleX * (1 - mix) + avatarX * mix;
        const y = idleY * (1 - mix) + ty * height * mix;
        pointX[i] = x;
        pointY[i] = y;
        const pulse = 0.82 + 0.18 * Math.sin(time * 1.8 + p.phase);
        pointR[i] = p.size * pulse * (0.76 + mix * 0.28);
      }

      // Gentle metallic reflections, with no surrounding fog and no orbit curves.
      ctx.globalCompositeOperation = "screen";
      for (let color = 0; color < palette.length; color++) {
        ctx.beginPath();
        for (const i of particlesByColor[color]!) {
          const r = pointR[i]!;
          ctx.moveTo(pointX[i]! + r, pointY[i]!);
          ctx.arc(pointX[i]!, pointY[i]!, r, 0, tau);
        }
        ctx.fillStyle = palette[color]!;
        ctx.globalAlpha = color === 5 ? 0.96 : color === 4 ? 0.82 : color === 2 ? 0.56 : 0.78;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      frame = window.requestAnimationFrame(render);
    }

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
      pointerY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
    };
    const onPointerLeave = () => {
      pointerX = 0.5;
      pointerY = 0.48;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || disposed) return;
      window.cancelAnimationFrame(frame);
      resize();
      frame = window.requestAnimationFrame(render);
    };
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="jarvis-particle-avatar-canvas"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    />
  );
}

function disposeMesh(gl: WebGLRenderingContext, mesh: Mesh) {
  gl.deleteBuffer(mesh.positions);
  gl.deleteBuffer(mesh.normals);
  gl.deleteBuffer(mesh.colors);
  if (mesh.indices) gl.deleteBuffer(mesh.indices);
}

export function OrbitalCore3D({ active = false, speaking = false }: { active?: boolean; speaking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const speakingRef = useRef(speaking);
  const speakingLevelRef = useRef(0);
  const measuredSpeechRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const onVoiceLevel = (event: Event) => {
      const detail = (event as CustomEvent<{ level?: number; measured?: boolean }>).detail;
      speakingLevelRef.current = Math.max(0, Math.min(1, detail?.level ?? 0));
      measuredSpeechRef.current = detail?.measured === true;
    };
    window.addEventListener("jarvis:voice-level", onVoiceLevel);
    return () => window.removeEventListener("jarvis:voice-level", onVoiceLevel);
  }, []);

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
    let avatarBlend = 0;
    let smoothedVoiceLevel = 0;
    let particleCloud: MorphParticleCloud | null = null;
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
      particleCloud = makeMorphParticleCloud(gl, 3600);
      meshes.push(particleCloud.mesh);
    } catch {
      host.dataset.webgl = "error";
      return;
    }

    const particlePositions = particleCloud ? new Float32Array(particleCloud.idle.length) : null;

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
      if (mesh.material < 3) opacity *= 1 - avatarBlend * 0.985;
      const mvp = multiply(projectionMatrix, model);
      bindMesh(mesh);
      gl.uniformMatrix4fv(locations.mvp, false, mvp);
      gl.uniformMatrix4fv(locations.model, false, model);
      gl.uniform1f(locations.opacity, opacity);
      gl.uniform1f(locations.pointSize, mesh.material >= 3 ? Math.max(1.5, Math.min(3.4, canvas.width / 230)) : Math.max(2, Math.min(5, canvas.width / 92)));
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
      const elapsed = (now - startedAt) * 0.001 * (reducedMotion ? 0.45 : 1);
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
      angle += (activeRef.current ? 0.012 : 0.0045) * (reducedMotion ? 0.45 : 1);
      const breathing = Math.sin(sceneTime * 0.42) * 0.035;
      const tilt = rotateX(0.2 + smoothPointerY * 0.28 + Math.sin(angle * 0.36) * 0.045);
      const yaw = rotateY(angle * 0.62 + smoothPointerX * 0.3);
      const cameraX = -smoothPointerX * 0.075;
      const cameraY = smoothPointerY * 0.055;
      const cameraDepth = -3.15 + Math.sin(sceneTime * 0.22) * 0.055;
      const breathingScale = 1 + Math.sin(sceneTime * 0.31) * 0.012;
      const base = multiply(translate(cameraX, cameraY, cameraDepth), multiply(tilt, multiply(yaw, scale(breathingScale))));
      const avatarTarget = activeRef.current ? 1 : 0;
      avatarBlend += (avatarTarget - avatarBlend) * (reducedMotion ? 1 : 0.024);
      if (Math.abs(avatarTarget - avatarBlend) < 0.0008) avatarBlend = avatarTarget;
      // Prevent the fading core from writing invisible surfaces into the depth buffer.
      gl.depthMask(avatarBlend < 0.025);
      const avatarTilt = rotateX(0.07 + smoothPointerY * 0.13 + Math.sin(sceneTime * 0.48) * 0.018);
      const avatarYaw = rotateY(angle * 0.055 + smoothPointerX * 0.15);
      const avatarBase = multiply(translate(cameraX * 0.3, cameraY * 0.3, cameraDepth), multiply(avatarTilt, multiply(avatarYaw, scale(1 + avatarBlend * 0.65))));
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
      gl.depthMask(avatarBlend < 0.025);

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

      // The same points flow through the scene in standby and assemble into a living face on call.
      if (particleCloud && particlePositions) {
        const cloud = particleCloud;
        const positions = particlePositions;
        const blinkPhase = elapsed % 4.8;
        const blink = Math.max(0, 1 - Math.abs(blinkPhase - 4.55) / 0.13);
        smoothedVoiceLevel += (speakingLevelRef.current - smoothedVoiceLevel) * 0.38;
        const syntheticSpeech = Math.max(0, Math.sin(elapsed * 11.4 + Math.sin(elapsed * 2.2) * 0.65));
        const speechWave = speakingRef.current
          ? measuredSpeechRef.current
            ? smoothedVoiceLevel
            : syntheticSpeech
          : 0;
        const mouthOpen = speechWave * 0.074;
        for (let i = 0; i < cloud.phases.length; i++) {
          const k = i * 3;
          const phase = cloud.phases[i]!;
          const role = cloud.roles[i]!;
          const homeX = cloud.idle[k]!;
          const homeY = cloud.idle[k + 1]!;
          const orbitRadius = Math.hypot(homeX, homeY);
          const orbitAngle = Math.atan2(homeY, homeX) + elapsed * (0.14 + Math.min(orbitRadius, 2.5) * 0.025) + Math.sin(elapsed * 0.17 + phase) * 0.12;
          let flowX = Math.cos(orbitAngle) * orbitRadius + Math.sin(elapsed * 0.67 + phase) * 0.10;
          let flowY = Math.sin(orbitAngle) * orbitRadius * 0.60 + Math.cos(elapsed * 0.41 + phase * 1.2) * 0.07;
          const cursorX = smoothPointerX * 1.55;
          const cursorY = -smoothPointerY * 1.15;
          const cursorDx = flowX - cursorX;
          const cursorDy = flowY - cursorY;
          const cursorDistance = Math.sqrt(cursorDx * cursorDx + cursorDy * cursorDy + 0.012);
          const cursorInfluence = Math.exp(-(cursorDx * cursorDx + cursorDy * cursorDy) * 3.2);
          flowX += (cursorDx / cursorDistance) * cursorInfluence * 0.16 - cursorDy * cursorInfluence * 0.055;
          flowY += (cursorDy / cursorDistance) * cursorInfluence * 0.16 + cursorDx * cursorInfluence * 0.055;
          const flowZ = cloud.idle[k + 2]! + Math.sin(elapsed * 0.38 + phase * 1.4) * 0.22 + cursorInfluence * 0.045;
          let ax = cloud.avatar[k]!;
          let ay = cloud.avatar[k + 1]!;
          let az = cloud.avatar[k + 2]!;

          if (role === 3 || role === 5 || role === 6) {
            ax += Math.sin(sceneTime * 0.62) * 0.012 + smoothPointerX * 0.012;
            ay += Math.sin(sceneTime * 0.43) * 0.008 - smoothPointerY * 0.009;
          } else if (role === 4) {
            ay += Math.sin(sceneTime * 1.4 + phase * 0.2) * 0.012;
          }
          if (role === 1) ay -= mouthOpen;
          if (role === 2) ay += mouthOpen * 0.3;
          if (role === 5) {
            ax += smoothPointerX * 0.025;
            ay -= smoothPointerY * 0.018;
          }
          if (role === 6) ay = 0.255 + (ay - 0.255) * (1 - blink);

          const mix = avatarBlend;
          positions[k] = flowX * (1 - mix) + ax * mix;
          positions[k + 1] = flowY * (1 - mix) + ay * mix;
          positions[k + 2] = flowZ * (1 - mix) + az * mix;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, cloud.mesh.positions);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        // Let the point cloud depth-test against itself, not against the fading core.
        gl.depthMask(true);
        draw(cloud.mesh, projectionMatrix, avatarBase, 0.86, true, sceneTime);
      }
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

export function OrbitalCore({ active = false, muted = false, speaking = false, particleAvatar = true, className = "" }: { active?: boolean; muted?: boolean; speaking?: boolean; particleAvatar?: boolean; className?: string }) {
  return (
    <div
      className={cn("orbital-core", "orbital-core--webgl", className, active && "orbital-core--active", muted && "orbital-core--muted", particleAvatar && "orbital-core--particle-avatar")}
      data-active={active}
      aria-hidden="true"
    >
      {!particleAvatar && <OrbitalCore3D active={active} speaking={speaking} />}
      {particleAvatar && <ParticleAvatarOverlay active={active} speaking={speaking} />}
      {!particleAvatar && <div className="orbital-core-hud" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        <span className="orbital-core-hud-crosshair" style={{ position: "absolute", inset: "18px", borderLeft: "1px solid rgba(177, 128, 255, .14)", borderRight: "1px solid rgba(177, 128, 255, .14)" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--one" style={{ position: "absolute", top: "22%", left: "20%", width: 5, height: 5, borderRadius: "50%", background: "#b17cff", boxShadow: "0 0 12px #9b4dff" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--two" style={{ position: "absolute", top: "70%", right: "15%", width: 4, height: 4, borderRadius: "50%", background: "#78dfff", boxShadow: "0 0 10px #78dfff" }} />
        <span className="orbital-core-hud-node orbital-core-hud-node--three" style={{ position: "absolute", bottom: "18%", left: "29%", width: 4, height: 4, borderRadius: "50%", background: "#d7a8ff", boxShadow: "0 0 10px #b17cff" }} />
      </div>}
    </div>
  );
}
