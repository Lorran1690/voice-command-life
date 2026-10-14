import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error(
    "Uso: node scripts/build-elysia-hologram-model.mjs <entrada.glb> <saida.glb>",
  );
}

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const document = await io.read(inputPath);
const root = document.getRoot();

// E.L.Y.S.I.A never renders photographic maps. Keep only the rigged geometry,
// morph targets and skeleton, and give every primitive a neutral placeholder.
// The application replaces this material with its procedural hologram shader.
const hologramMaterial = document
  .createMaterial("E.L.Y.S.I.A procedural hologram")
  .setBaseColorFactor([0.48, 0.18, 0.95, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.48)
  .setDoubleSided(true);

for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    primitive.setMaterial(hologramMaterial);
  }
}

for (const material of [...root.listMaterials()]) {
  if (material !== hologramMaterial) material.dispose();
}

for (const texture of [...root.listTextures()]) texture.dispose();

await document.transform(
  dedup(),
  prune(),
  meshopt({
    encoder: MeshoptEncoder,
    level: "high",
    quantizePosition: 16,
    quantizeNormal: 12,
    quantizeWeight: 12,
    quantizeGeneric: 16,
  }),
);
await io.write(outputPath, document);

console.log(`Modelo holografico gerado sem texturas e com Meshopt: ${outputPath}`);
