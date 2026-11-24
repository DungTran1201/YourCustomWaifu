import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

/**
 * Safely probes whether WebGL2 or WebGL rendering is supported in the current environment.
 * Returns false cleanly in headless test environments (e.g. JSDOM) or GPU-disabled systems
 * without throwing uncaught exceptions.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    if (!window.WebGLRenderingContext) {
      return false;
    }
    // Always probe on a disposable off-DOM canvas so the target render canvas
    // never has conflicting WebGLContextAttributes bound prior to THREE.WebGLRenderer.
    const probeCanvas = document.createElement("canvas");
    const gl = (probeCanvas.getContext("webgl2") ||
      probeCanvas.getContext("webgl") ||
      probeCanvas.getContext(
        "experimental-webgl",
      )) as WebGLRenderingContext | null;
    if (!gl) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether the user or OS has requested reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Optimizes a parsed VRM scene for stable desktop rendering:
 * - Disables frustum culling on SkinnedMesh nodes so spring-bone and humanoid pose offsets never clip.
 * - Caps texture anisotropy to keep crispness while bounding GPU memory bandwidth.
 */
export function optimizeVrmScene(vrm: VRM, maxAnisotropy = 4): void {
  if (!vrm?.scene) return;

  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.frustumCulled = false;
    }

    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const mat of materials) {
      const anyMat = mat as unknown as Record<string, unknown>;
      const texKeys = [
        "map",
        "emissiveMap",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "alphaMap",
        "aoMap",
        "shadeMultiplyTexture",
      ];
      for (const key of texKeys) {
        const tex = anyMat[key] as THREE.Texture | undefined;
        if (tex && tex.isTexture) {
          tex.anisotropy = Math.min(
            maxAnisotropy,
            Math.max(1, tex.anisotropy || 1),
          );
        }
      }
    }
  });
}

/**
 * Recursively disposes geometries, materials, and textures owned by a Three.js Object3D tree.
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined): void {
  if (!root) return;

  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
      disposedGeometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }

    const rawMaterial = (
      mesh as { material?: THREE.Material | THREE.Material[] }
    ).material;
    if (!rawMaterial) return;

    const materials = Array.isArray(rawMaterial) ? rawMaterial : [rawMaterial];
    for (const mat of materials) {
      if (!mat || disposedMaterials.has(mat)) continue;
      disposedMaterials.add(mat);

      const record = mat as unknown as Record<string, unknown>;
      for (const val of Object.values(record)) {
        if (
          val &&
          typeof val === "object" &&
          (val as THREE.Texture).isTexture
        ) {
          const tex = val as THREE.Texture;
          if (!disposedTextures.has(tex)) {
            disposedTextures.add(tex);
            tex.dispose();
          }
        }
      }
      mat.dispose();
    }
  });
}
