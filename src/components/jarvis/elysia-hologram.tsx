import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type ElysiaHologramProps = {
  active: boolean;
  speaking: boolean;
};

type HologramKind = "body" | "garment" | "hair" | "eyes" | "detail";

type HologramShader = THREE.WebGLProgramParametersWithUniforms & {
  uniforms: THREE.WebGLProgramParametersWithUniforms["uniforms"] & {
    uElysiaTime: { value: number };
    uElysiaVoice: { value: number };
    uElysiaKind: { value: number };
  };
};

const MATERIAL_STYLE: Record<
  HologramKind,
  {
    color: number;
    emissive: number;
    emissiveIntensity: number;
    opacity: number;
    roughness: number;
    metalness: number;
    kind: number;
  }
> = {
  body: {
    color: 0xbda6ee,
    emissive: 0x56208f,
    emissiveIntensity: 0.82,
    opacity: 0.96,
    roughness: 0.3,
    metalness: 0.04,
    kind: 0,
  },
  garment: {
    color: 0xa76aff,
    emissive: 0x761dd1,
    emissiveIntensity: 1.65,
    opacity: 0.78,
    roughness: 0.2,
    metalness: 0.08,
    kind: 1,
  },
  hair: {
    color: 0xd6b7ff,
    emissive: 0x8b3cff,
    emissiveIntensity: 1.46,
    opacity: 0.91,
    roughness: 0.22,
    metalness: 0.05,
    kind: 2,
  },
  eyes: {
    color: 0xe0c6ff,
    emissive: 0x9e55ff,
    emissiveIntensity: 2.7,
    opacity: 1,
    roughness: 0.12,
    metalness: 0.02,
    kind: 3,
  },
  detail: {
    color: 0xf2e7ff,
    emissive: 0xcaa0ff,
    emissiveIntensity: 2.15,
    opacity: 0.98,
    roughness: 0.16,
    metalness: 0.02,
    kind: 4,
  },
};

function createHologramMaterial(kind: HologramKind) {
  const style = MATERIAL_STYLE[kind];
  const material = new THREE.MeshPhysicalMaterial({
    color: style.color,
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    opacity: style.opacity,
    transparent: style.opacity < 1,
    depthWrite: true,
    depthTest: true,
    roughness: style.roughness,
    metalness: style.metalness,
    clearcoat: kind === "body" || kind === "hair" ? 0.78 : 0.42,
    clearcoatRoughness: kind === "body" ? 0.15 : 0.24,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    const hologramShader = shader as HologramShader;
    hologramShader.uniforms.uElysiaTime = { value: 0 };
    hologramShader.uniforms.uElysiaVoice = { value: 0 };
    hologramShader.uniforms.uElysiaKind = { value: style.kind };

    hologramShader.vertexShader = hologramShader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vElysiaWorldPosition;
varying vec3 vElysiaWorldNormal;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vElysiaWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vElysiaWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    hologramShader.fragmentShader = hologramShader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uElysiaTime;
uniform float uElysiaVoice;
uniform float uElysiaKind;
varying vec3 vElysiaWorldPosition;
varying vec3 vElysiaWorldNormal;`,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec4 diffuseColor = vec4( diffuse, opacity );
vec3 elysiaNormal = normalize(vElysiaWorldNormal);
vec3 elysiaView = normalize(cameraPosition - vElysiaWorldPosition);
float elysiaFacing = clamp(abs(dot(elysiaNormal, elysiaView)), 0.0, 1.0);
float elysiaRim = pow(1.0 - elysiaFacing, 2.15);
float elysiaFlow = 0.5 + 0.5 * sin(
  vElysiaWorldPosition.y * 74.0
  + sin(vElysiaWorldPosition.x * 37.0 + uElysiaTime * 0.12) * 2.6
  - uElysiaTime * 0.34
);
float elysiaVeinA = abs(sin(
  vElysiaWorldPosition.x * 82.0
  + vElysiaWorldPosition.y * 25.0
  + sin(vElysiaWorldPosition.z * 61.0 - uElysiaTime * 0.16) * 2.1
));
float elysiaVeinB = abs(cos(
  vElysiaWorldPosition.z * 71.0
  - vElysiaWorldPosition.y * 31.0
  + sin(vElysiaWorldPosition.x * 48.0 + uElysiaTime * 0.11)
));
float elysiaFilament = smoothstep(0.91, 0.995, max(elysiaVeinA, elysiaVeinB));
float elysiaPulse = 0.93 + 0.07 * sin(uElysiaTime * 1.18 + vElysiaWorldPosition.y * 9.0);
vec3 elysiaViolet = mix(vec3(0.39, 0.12, 0.95), vec3(0.91, 0.76, 1.0), elysiaFlow);
float elysiaGarmentBoost = step(0.5, uElysiaKind) * (1.0 - step(2.5, uElysiaKind));
diffuseColor.rgb *= elysiaPulse;
diffuseColor.rgb += elysiaViolet * (elysiaRim * (0.34 + elysiaGarmentBoost * 0.42));
diffuseColor.rgb += vec3(0.86, 0.67, 1.0) * elysiaFilament * (0.075 + elysiaGarmentBoost * 0.23);
diffuseColor.rgb += vec3(0.55, 0.24, 1.0) * uElysiaVoice * (0.025 + elysiaRim * 0.12);
diffuseColor.a *= 0.985 + elysiaRim * 0.015;`,
      );

    material.userData["elysiaShader"] = hologramShader;
  };

  material.customProgramCacheKey = () => `elysia-hologram-${kind}-v1`;
  return material;
}

function addEnergyCurve(
  parent: THREE.Group,
  points: THREE.Vector3[],
  material: THREE.Material,
  radius = 0.00165,
) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.45);
  const geometry = new THREE.TubeGeometry(curve, 72, radius, 4, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 8;
  parent.add(mesh);
}

function createEnergyFiligree() {
  const group = new THREE.Group();
  group.name = "E.L.Y.S.I.A energy filigree";

  const hairMaterial = new THREE.MeshBasicMaterial({
    color: 0xd8b5ff,
    transparent: true,
    opacity: 0.54,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const bodyMaterial = new THREE.MeshBasicMaterial({
    color: 0xc58aff,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    for (let strand = 0; strand < 15; strand++) {
      const spread = strand / 14;
      const phase = strand * 0.63 + sideIndex * 0.9;
      addEnergyCurve(
        group,
        [
          new THREE.Vector3(side * (0.018 + spread * 0.11), 1.775 - spread * 0.012, 0.02),
          new THREE.Vector3(side * (0.13 + spread * 0.09), 1.69, 0.065 + spread * 0.025),
          new THREE.Vector3(side * (0.22 + spread * 0.1), 1.55, 0.07 + Math.sin(phase) * 0.024),
          new THREE.Vector3(side * (0.30 + spread * 0.12), 1.36, 0.035 + Math.cos(phase) * 0.035),
          new THREE.Vector3(side * (0.34 + spread * 0.17), 1.10 - spread * 0.1, -0.015),
        ],
        hairMaterial,
        0.0012 + (strand % 4) * 0.00022,
      );
    }
  }

  // The rear reference has a dense, loose curtain of light rather than a
  // single graphic ponytail. These strands extend the real hair geometry to
  // the hips while keeping every visible detail procedural.
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    for (let strand = 0; strand < 18; strand++) {
      const spread = strand / 17;
      const wave = strand * 0.71 + sideIndex * 1.17;
      const outer = 0.12 + spread * 0.28;
      addEnergyCurve(
        group,
        [
          new THREE.Vector3(side * (0.018 + spread * 0.085), 1.77, -0.025),
          new THREE.Vector3(side * (0.095 + spread * 0.12), 1.63, -0.105),
          new THREE.Vector3(side * (outer + Math.sin(wave) * 0.018), 1.43, -0.155),
          new THREE.Vector3(side * (outer + 0.055 + Math.cos(wave) * 0.028), 1.18, -0.17),
          new THREE.Vector3(side * (outer + 0.035 + Math.sin(wave * 1.4) * 0.032), 0.91, -0.13),
          new THREE.Vector3(side * (0.16 + spread * 0.17 + Math.cos(wave) * 0.025), 0.63, -0.07),
          new THREE.Vector3(side * (0.115 + spread * 0.12), 0.46 - spread * 0.035, -0.015),
        ],
        hairMaterial,
        0.00115 + (strand % 5) * 0.00019,
      );
    }
  }

  addEnergyCurve(
    group,
    [
      new THREE.Vector3(0, 1.70, 0.145),
      new THREE.Vector3(0.006, 1.58, 0.188),
      new THREE.Vector3(-0.004, 1.43, 0.206),
      new THREE.Vector3(0, 1.29, 0.214),
      new THREE.Vector3(0, 1.08, 0.225),
    ],
    bodyMaterial,
    0.0022,
  );

  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    for (let line = 0; line < 7; line++) {
      const offset = line * 0.011;
      addEnergyCurve(
        group,
        [
          new THREE.Vector3(side * (0.008 + offset), 1.25 - line * 0.006, 0.225),
          new THREE.Vector3(side * (0.09 + offset * 0.7), 1.21 - line * 0.004, 0.252),
          new THREE.Vector3(side * (0.19 + offset), 1.18 + line * 0.001, 0.245),
          new THREE.Vector3(side * (0.28 + offset * 0.8), 1.12 - line * 0.003, 0.20),
          new THREE.Vector3(side * (0.34 + offset * 0.5), 1.03 - line * 0.008, 0.13),
        ],
        bodyMaterial,
        0.00135 + (line % 3) * 0.00028,
      );
    }
  }

  // Open-back filigree: a luminous spine with mirrored ribs and a low V,
  // matching the second reference while remaining hidden naturally in front.
  addEnergyCurve(
    group,
    [
      new THREE.Vector3(0, 1.49, -0.157),
      new THREE.Vector3(0.003, 1.39, -0.174),
      new THREE.Vector3(-0.003, 1.27, -0.181),
      new THREE.Vector3(0.002, 1.15, -0.174),
      new THREE.Vector3(0, 1.01, -0.151),
      new THREE.Vector3(0, 0.88, -0.116),
    ],
    bodyMaterial,
    0.00215,
  );

  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;

    addEnergyCurve(
      group,
      [
        new THREE.Vector3(side * 0.035, 1.49, -0.15),
        new THREE.Vector3(side * 0.16, 1.45, -0.13),
        new THREE.Vector3(side * 0.27, 1.36, -0.09),
        new THREE.Vector3(side * 0.20, 1.24, -0.145),
        new THREE.Vector3(side * 0.08, 1.12, -0.17),
        new THREE.Vector3(0, 0.94, -0.137),
      ],
      bodyMaterial,
      0.00185,
    );

    for (let rib = 0; rib < 6; rib++) {
      const y = 1.39 - rib * 0.072;
      addEnergyCurve(
        group,
        [
          new THREE.Vector3(side * 0.018, y + 0.035, -0.177),
          new THREE.Vector3(side * (0.085 + rib * 0.008), y + 0.018, -0.169),
          new THREE.Vector3(side * (0.165 + rib * 0.012), y - 0.015, -0.142),
          new THREE.Vector3(side * (0.235 + rib * 0.006), y - 0.052, -0.096),
        ],
        bodyMaterial,
        0.00115 + (rib % 2) * 0.00024,
      );
    }
  }

  const jewelMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3e6ff,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const jewelGeometry = new THREE.OctahedronGeometry(0.012, 0);
  [1.43, 1.31, 1.19].forEach((y, index) => {
    const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
    jewel.name = `E.L.Y.S.I.A sternum jewel ${index + 1}`;
    jewel.position.set(0, y, 0.228);
    jewel.scale.setScalar(1 - index * 0.13);
    jewel.renderOrder = 9;
    group.add(jewel);
  });

  [1.43, 1.31, 1.19, 1.07, 0.95].forEach((y, index) => {
    const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
    jewel.name = `E.L.Y.S.I.A spine jewel ${index + 1}`;
    jewel.position.set(0, y, -0.183 + index * 0.009);
    jewel.scale.set(0.78 - index * 0.055, 1.12 - index * 0.04, 0.7);
    jewel.rotation.z = Math.PI * 0.25;
    jewel.renderOrder = 9;
    group.add(jewel);
  });

  return group;
}

function aimBoneAt(bone: THREE.Bone | null, child: THREE.Bone | null, target: THREE.Vector3) {
  if (!bone || !child || !bone.parent) return;

  bone.parent.updateWorldMatrix(true, false);
  bone.updateWorldMatrix(true, false);
  const bonePosition = bone.getWorldPosition(new THREE.Vector3());
  const desiredWorld = target.clone().sub(bonePosition).normalize();
  const parentWorldQuaternion = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const desiredParent = desiredWorld.applyQuaternion(parentWorldQuaternion.invert()).normalize();
  const restChildDirection = child.position.clone().normalize();
  const restDirectionInParent = restChildDirection.applyQuaternion(bone.quaternion).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(restDirectionInParent, desiredParent);
  bone.quaternion.premultiply(delta);
  bone.updateWorldMatrix(true, true);
}

function poseHandsLikeReference(root: THREE.Object3D) {
  const leftArm = root.getObjectByName("LeftArm") as THREE.Bone | undefined;
  const leftForeArm = root.getObjectByName("LeftForeArm") as THREE.Bone | undefined;
  const leftHand = root.getObjectByName("LeftHand") as THREE.Bone | undefined;
  const rightArm = root.getObjectByName("RightArm") as THREE.Bone | undefined;
  const rightForeArm = root.getObjectByName("RightForeArm") as THREE.Bone | undefined;
  const rightHand = root.getObjectByName("RightHand") as THREE.Bone | undefined;

  root.updateMatrixWorld(true);
  aimBoneAt(leftArm ?? null, leftForeArm ?? null, new THREE.Vector3(-0.40, 1.17, 0.22));
  aimBoneAt(rightArm ?? null, rightForeArm ?? null, new THREE.Vector3(0.40, 1.15, 0.23));
  aimBoneAt(leftForeArm ?? null, leftHand ?? null, new THREE.Vector3(0.085, 1.035, 0.34));
  aimBoneAt(rightForeArm ?? null, rightHand ?? null, new THREE.Vector3(-0.075, 0.985, 0.37));

  leftHand?.rotateX(-0.14);
  leftHand?.rotateY(-0.28);
  leftHand?.rotateZ(-0.2);
  rightHand?.rotateX(-0.18);
  rightHand?.rotateY(0.3);
  rightHand?.rotateZ(0.18);

  root.updateMatrixWorld(true);
}

function setMorph(root: THREE.Object3D, name: string, value: number) {
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    const index = mesh.morphTargetDictionary?.[name];
    if (index !== undefined && mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences[index] = value;
    }
  });
}

function materialKindFor(objectName: string): HologramKind {
  const name = objectName.toLowerCase();
  if (name.includes("ponytail")) return "hair";
  if (name.includes("high-poly")) return "eyes";
  if (name.includes("eyebrow") || name.includes("eyelash") || name.includes("teeth")) return "detail";
  if (name.includes("casualsuit")) return "garment";
  return "body";
}

export function ElysiaHologram({ active, speaking }: ElysiaHologramProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const speakingRef = useRef(speaking);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;

    let disposed = false;
    let frame = 0;
    let avatar: THREE.Object3D | null = null;
    let head: THREE.Bone | null = null;
    let spine: THREE.Bone | null = null;
    const hairBones: Array<{ bone: THREE.Bone; rest: THREE.Quaternion; phase: number }> = [];
    const compiledMaterials: THREE.MeshPhysicalMaterial[] = [];
    const restHead = new THREE.Quaternion();
    const restSpine = new THREE.Quaternion();
    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(23, 1, 0.05, 12);
    camera.position.set(0, 1.38, 3.02);
    camera.lookAt(0, 1.38, 0.055);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = false;
    renderer.domElement.className = "elysia-hologram-canvas";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd9c0ff, 0x12031e, 2.15));
    const keyLight = new THREE.PointLight(0xf0ddff, 20, 8, 1.5);
    keyLight.position.set(-1.1, 2.1, 2.2);
    scene.add(keyLight);
    const violetRim = new THREE.PointLight(0x873cff, 31, 7, 1.65);
    violetRim.position.set(1.3, 1.55, -0.7);
    scene.add(violetRim);
    const lowerGlow = new THREE.PointLight(0xb56dff, 13, 5, 1.55);
    lowerGlow.position.set(0, 0.82, 1.15);
    scene.add(lowerGlow);

    function resize() {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.82 ? 28 : camera.aspect > 1.65 ? 21.5 : 23;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      "/models/elysia-hologram.glb",
      (gltf) => {
        if (disposed) return;
        avatar = gltf.scene;
        avatar.name = "E.L.Y.S.I.A faithful hologram";

        avatar.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;

          const kind = materialKindFor(mesh.name);
          const material = createHologramMaterial(kind);
          compiledMaterials.push(material);
          mesh.material = material;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.frustumCulled = false;
          mesh.renderOrder = kind === "hair" ? 5 : kind === "detail" || kind === "eyes" ? 6 : 3;

          if (mesh.name.toLowerCase().includes("tongue")) mesh.visible = false;
        });

        poseHandsLikeReference(avatar);
        head = (avatar.getObjectByName("Head") as THREE.Bone | undefined) ?? null;
        spine = (avatar.getObjectByName("Spine2") as THREE.Bone | undefined) ?? null;
        if (head) restHead.copy(head.quaternion);
        if (spine) restSpine.copy(spine.quaternion);

        ["PonytailRoot", "Ponytail1", "Ponytail2", "Ponytail3"].forEach((name, index) => {
          const bone = avatar?.getObjectByName(name) as THREE.Bone | undefined;
          if (bone) hairBones.push({ bone, rest: bone.quaternion.clone(), phase: index * 0.72 });
        });

        setMorph(avatar, "eyeWideLeft", 0.09);
        setMorph(avatar, "eyeWideRight", 0.09);
        setMorph(avatar, "mouthPucker", 0.045);
        setMorph(avatar, "mouthShrugUpper", 0.035);
        setMorph(avatar, "jawOpen", 0.018);

        avatar.add(createEnergyFiligree());
        scene.add(avatar);
        setLoadState("ready");
      },
      undefined,
      (error) => {
        console.error("Falha ao carregar a geometria holografica da E.L.Y.S.I.A.", error);
        if (!disposed) setLoadState("error");
      },
    );

    function render() {
      if (disposed) return;
      const time = clock.getElapsedTime();
      const voice = speakingRef.current
        ? 0.34 + Math.max(0, Math.sin(time * 11.8 + Math.sin(time * 2.2))) * 0.66
        : activeRef.current
          ? 0.08
          : 0;

      for (const material of compiledMaterials) {
        const shader = material.userData["elysiaShader"] as HologramShader | undefined;
        if (!shader) continue;
        shader.uniforms.uElysiaTime.value = time;
        shader.uniforms.uElysiaVoice.value = voice;
      }

      if (avatar) {
        const breath = Math.sin(time * 0.86) * 0.008;
        avatar.position.y = breath;
        avatar.rotation.y = Math.sin(time * 0.31) * 0.012;

        if (head) {
          head.quaternion.copy(restHead);
          head.rotateX(Math.sin(time * 0.42) * 0.014);
          head.rotateY(Math.sin(time * 0.29 + 0.6) * 0.018);
        }
        if (spine) {
          spine.quaternion.copy(restSpine);
          spine.rotateZ(Math.sin(time * 0.34) * 0.005);
        }
        for (const item of hairBones) {
          item.bone.quaternion.copy(item.rest);
          item.bone.rotateX(Math.sin(time * 0.72 + item.phase) * 0.014);
          item.bone.rotateZ(Math.sin(time * 0.51 + item.phase) * 0.018);
        }

        const blinkCycle = time % 5.4;
        const blink = blinkCycle > 5.12
          ? Math.sin(((blinkCycle - 5.12) / 0.28) * Math.PI)
          : 0;
        setMorph(avatar, "eyeBlinkLeft", blink);
        setMorph(avatar, "eyeBlinkRight", blink);
        setMorph(avatar, "jawOpen", 0.018 + voice * 0.19);
        setMorph(avatar, "viseme_aa", voice * 0.23);
        setMorph(avatar, "mouthSmileLeft", activeRef.current ? 0.028 : 0.012);
        setMorph(avatar, "mouthSmileRight", activeRef.current ? 0.028 : 0.012);
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    }
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="elysia-hologram" data-state={loadState} aria-hidden="true">
      {loadState === "loading" && <span className="elysia-hologram-status">FORMANDO MATRIZ HOLOGRÁFICA</span>}
      {loadState === "error" && <span className="elysia-hologram-status elysia-hologram-status--error">FALHA NA MATRIZ 3D</span>}
    </div>
  );
}
