import { app } from "electron";
import { join } from "node:path";
import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";

export const SAMPLE_VRM_METADATA = {
  name: "AvatarSample_B",
  fileName: "AvatarSample_B.vrm",
  upstreamRepo: "https://github.com/pixiv/ChatVRM",
  pinnedCommit: "6e687a81dc74194009d3ca874cc784faf49a3a01",
  rawUrl:
    "https://raw.githubusercontent.com/pixiv/ChatVRM/6e687a81dc74194009d3ca874cc784faf49a3a01/public/AvatarSample_B.vrm",
  expectedSha256:
    "ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27",
  expectedSizeBytes: 21047556,
  maxSizeBytes: 35 * 1024 * 1024, // 35 MB
  timeoutMs: 35000,
  license: "VRoid Sample Model Terms / CC-like permissive 3D avatar terms",
  author: "VRoid Project (pixiv Inc.)",
};

/**
 * Computes the SHA-256 hex digest of a local file.
 */
export async function calculateFileSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

/**
 * Returns the default development destination path for the sample VRM.
 */
export function getSampleVrmPath(customDir?: string): string {
  if (customDir) {
    return join(customDir, SAMPLE_VRM_METADATA.fileName);
  }
  try {
    const userData = app.getPath("userData");
    return join(userData, "development-assets", SAMPLE_VRM_METADATA.fileName);
  } catch {
    return join(
      process.cwd(),
      "assets",
      "sample-vrm",
      SAMPLE_VRM_METADATA.fileName,
    );
  }
}

/**
 * Checks whether a file exists at the given path and matches the expected SHA-256.
 */
export async function isValidSampleVrm(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size !== SAMPLE_VRM_METADATA.expectedSizeBytes) {
      return false;
    }
    const digest = await calculateFileSha256(filePath);
    return (
      digest.toLowerCase() === SAMPLE_VRM_METADATA.expectedSha256.toLowerCase()
    );
  } catch {
    return false;
  }
}

export interface EnsureSampleVrmResult {
  success: boolean;
  filePath: string;
  fileName: string;
  cached: boolean;
  sha256: string;
  sizeBytes: number;
  error?: string;
}

/**
 * Ensures the sample VRM is present locally and validated against its pinned checksum.
 * If already cached and valid, returns immediately without re-downloading.
 */
export async function ensureSampleVrm(
  destinationDir?: string,
): Promise<EnsureSampleVrmResult> {
  const targetPath = getSampleVrmPath(destinationDir);

  // 1. Check if already cached and valid
  if (await isValidSampleVrm(targetPath)) {
    const stat = await fs.stat(targetPath);
    return {
      success: true,
      filePath: targetPath,
      fileName: SAMPLE_VRM_METADATA.fileName,
      cached: true,
      sha256: SAMPLE_VRM_METADATA.expectedSha256,
      sizeBytes: stat.size,
    };
  }

  // 2. Ensure destination directory exists
  const parentDir = join(targetPath, "..");
  await fs.mkdir(parentDir, { recursive: true });

  const tempPath = `${targetPath}.download.${Date.now()}.tmp`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SAMPLE_VRM_METADATA.timeoutMs,
    );

    const response = await fetch(SAMPLE_VRM_METADATA.rawUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "YourCustomWaifu-DevPreview/0.1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status} ${response.statusText} fetching sample VRM`,
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error("Received HTML error page instead of binary VRM stream");
    }

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    // Stream to temp file
    const writeStream = createWriteStream(tempPath);
    // @ts-ignore Node stream from Web ReadableStream
    await pipeline(response.body, writeStream);

    // Verify temp file size
    const stat = await fs.stat(tempPath);
    if (stat.size === 0) {
      throw new Error("Downloaded sample VRM file is 0 bytes (empty file)");
    }
    if (stat.size > SAMPLE_VRM_METADATA.maxSizeBytes) {
      throw new Error(
        `Downloaded file size (${stat.size} bytes) exceeds maximum allowable limit (${SAMPLE_VRM_METADATA.maxSizeBytes} bytes)`,
      );
    }

    // Check for Git LFS pointer text
    if (stat.size < 1000) {
      const headerSnippet = await fs.readFile(tempPath, { encoding: "utf8" });
      if (headerSnippet.includes("version https://git-lfs.github.com")) {
        throw new Error(
          "Downloaded file is a Git LFS pointer, not real VRM binary",
        );
      }
    }

    // Verify SHA-256 checksum
    const calculatedHash = await calculateFileSha256(tempPath);
    if (
      calculatedHash.toLowerCase() !==
      SAMPLE_VRM_METADATA.expectedSha256.toLowerCase()
    ) {
      throw new Error(
        `SHA-256 checksum mismatch for sample VRM! Expected ${SAMPLE_VRM_METADATA.expectedSha256}, got ${calculatedHash}`,
      );
    }

    // Atomic rename into place
    await fs.rename(tempPath, targetPath);

    return {
      success: true,
      filePath: targetPath,
      fileName: SAMPLE_VRM_METADATA.fileName,
      cached: false,
      sha256: calculatedHash,
      sizeBytes: stat.size,
    };
  } catch (err: any) {
    // Clean up temporary download file if it exists
    await fs.unlink(tempPath).catch(() => {});
    return {
      success: false,
      filePath: targetPath,
      fileName: SAMPLE_VRM_METADATA.fileName,
      cached: false,
      sha256: "",
      sizeBytes: 0,
      error: err?.message || "Failed to download and verify sample VRM",
    };
  }
}
