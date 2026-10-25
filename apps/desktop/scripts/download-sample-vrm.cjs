/**
 * Script to idempotently download and verify AvatarSample_B.vrm for development.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

const SAMPLE_METADATA = {
  name: "AvatarSample_B",
  fileName: "AvatarSample_B.vrm",
  upstreamRepo: "https://github.com/pixiv/ChatVRM",
  pinnedCommit: "6e687a81dc74194009d3ca874cc784faf49a3a01",
  rawUrl:
    "https://raw.githubusercontent.com/pixiv/ChatVRM/6e687a81dc74194009d3ca874cc784faf49a3a01/public/AvatarSample_B.vrm",
  expectedSha256:
    "ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27",
  expectedSizeBytes: 21047556,
};

async function calculateFileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function main() {
  const destDir = path.resolve(__dirname, "../assets/sample-vrm");
  const destPath = path.join(destDir, SAMPLE_METADATA.fileName);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size === SAMPLE_METADATA.expectedSizeBytes) {
      const existingHash = await calculateFileSha256(destPath);
      if (existingHash.toLowerCase() === SAMPLE_METADATA.expectedSha256.toLowerCase()) {
        console.log(`[Sample VRM] Valid model already cached at: ${destPath}`);
        console.log(`[Sample VRM] SHA-256: ${existingHash} (${stat.size} bytes)`);
        process.exit(0);
      }
    }
    console.log("[Sample VRM] Existing file invalid or corrupted, re-downloading...");
  }

  console.log(`[Sample VRM] Downloading ${SAMPLE_METADATA.fileName} from pinned source:`);
  console.log(`  Source: ${SAMPLE_METADATA.rawUrl}`);
  console.log(`  Target: ${destPath}`);

  const tempPath = `${destPath}.tmp.${Date.now()}`;
  const response = await fetch(SAMPLE_METADATA.rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status} ${response.statusText}`);
  }

  const fileStream = fs.createWriteStream(tempPath);
  await pipeline(response.body, fileStream);

  const hash = await calculateFileSha256(tempPath);
  if (hash.toLowerCase() !== SAMPLE_METADATA.expectedSha256.toLowerCase()) {
    fs.unlinkSync(tempPath);
    throw new Error(`Checksum mismatch! Expected: ${SAMPLE_METADATA.expectedSha256}, got: ${hash}`);
  }

  fs.renameSync(tempPath, destPath);
  const finalStat = fs.statSync(destPath);
  console.log(`[Sample VRM] Download & verification succeeded!`);
  console.log(`  Path: ${destPath}`);
  console.log(`  Size: ${finalStat.size} bytes`);
  console.log(`  SHA-256: ${hash}`);
}

main().catch((err) => {
  console.error("[Sample VRM ERROR]", err);
  process.exit(1);
});
