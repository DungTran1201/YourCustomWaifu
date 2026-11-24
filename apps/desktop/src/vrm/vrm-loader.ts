import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  detectVrmVersion,
  type DetectedVrmVersion,
} from "../avatar-stage/stage-pipeline.js";
import { resolveApiBaseUrl } from "../stores/store.js";
import { optimizeVrmScene } from "./webgl-utils.js";

export interface ParsedVrmAsset {
  vrm: VRM;
  animations: THREE.AnimationClip[];
  detectedVersion: DetectedVrmVersion;
}

/**
 * Parses a raw VRM binary or glTF JSON buffer into a ready VRM instance + embedded animation clips.
 * Applies @pixiv/three-vrm geometry/skeleton optimizations when supported.
 */
export async function parseVrmFromBuffer(
  data: ArrayBuffer | string,
  maxAnisotropy = 4,
): Promise<ParsedVrmAsset> {
  if (data instanceof ArrayBuffer && data.byteLength < 12) {
    throw new Error("Invalid VRM buffer: payload is empty or truncated");
  }
  if (typeof data === "string" && data.trim().length === 0) {
    throw new Error("Invalid VRM payload: empty string");
  }

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise<ParsedVrmAsset>((resolve, reject) => {
    loader.parse(
      data,
      "",
      (gltf) => {
        try {
          const vrm = gltf.userData?.vrm as VRM | undefined;
          if (!vrm || !vrm.scene) {
            reject(
              new Error("Invalid VRM: No VRM extension data found in glTF"),
            );
            return;
          }

          try {
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.combineSkeletons(gltf.scene);
          } catch {
            // Minimal synthetic fixtures may omit full buffer attributes; safe to ignore
          }

          optimizeVrmScene(vrm, maxAnisotropy);
          const animations = Array.isArray(gltf.animations)
            ? gltf.animations
            : [];

          resolve({
            vrm,
            animations,
            detectedVersion: detectVrmVersion(vrm),
          });
        } catch (err) {
          reject(
            err instanceof Error
              ? err
              : new Error("Failed to initialize parsed VRM model"),
          );
        }
      },
      (err) => {
        reject(
          err instanceof Error
            ? err
            : new Error(String((err as { message?: string })?.message || err)),
        );
      },
    );
  });
}

/**
 * Loads the application's bundled default VRM buffer without requesting arbitrary paths
 * or user file dialogs. Prefers the Electron zero-arg IPC channel and falls back to the
 * local embedded asset endpoint when running in browser development preview.
 */
export async function loadBundledDefaultVrmBuffer(
  signal?: AbortSignal,
): Promise<{ data: ArrayBuffer; name: string }> {
  if (
    typeof window !== "undefined" &&
    typeof window.desktopAPI?.stage?.loadDefaultVrm === "function"
  ) {
    try {
      const result = await window.desktopAPI.stage.loadDefaultVrm();
      if (result?.data && result.data.byteLength > 0) {
        return result;
      }
    } catch {
      // Fall through to embedded HTTP asset endpoint
    }
  }

  const baseUrl = await resolveApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const res = await fetch(`${baseUrl}/api/v1/assets/default-vrm`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Bundled default VRM unavailable (HTTP ${res.status})`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json")
    ) {
      throw new Error("Unexpected non-binary response for bundled VRM");
    }
    const data = await res.arrayBuffer();
    if (data.byteLength < 12) {
      throw new Error("Bundled default VRM payload is empty");
    }
    return { data, name: "AvatarSample_B.vrm" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
