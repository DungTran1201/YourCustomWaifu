import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024; // 64 MB memory hard

const LEGACY_DEV_SEED = "default-vrm-kms-master-key-dev-seed-32bytes!";

/**
 * Custom error thrown when secure storage (safeStorage / KMS_MASTER_KEY) is unavailable.
 */
export class SecureStorageUnavailableError extends Error {
  constructor(
    message = "Secure storage is unavailable on this system and no KMS_MASTER_KEY environment variable is configured.",
  ) {
    super(message);
    this.name = "SecureStorageUnavailableError";
  }
}

let activeMasterKey: Buffer | null = null;

/**
 * Configure or override the active Master Key (for tests or custom KMS providers).
 */
export function setMasterKey(key: Buffer | string | null): void {
  if (key === null) {
    activeMasterKey = null;
    return;
  }
  if (typeof key === "string") {
    activeMasterKey = crypto.createHash("sha256").update(key).digest();
  } else {
    activeMasterKey = key;
  }
}

/**
 * Initialize OS-backed master key lifecycle using Electron safeStorage or environment variables.
 * Call this during Electron startup before initializing services.
 */
export async function initMasterKey(userDataPath?: string): Promise<Buffer> {
  // 1. Explicit KMS_MASTER_KEY environment variable
  if (
    process.env.KMS_MASTER_KEY &&
    process.env.KMS_MASTER_KEY.trim().length > 0
  ) {
    activeMasterKey = crypto
      .createHash("sha256")
      .update(process.env.KMS_MASTER_KEY.trim())
      .digest();
    return activeMasterKey;
  }

  // 2. Electron safeStorage OS-backed encryption (Windows DPAPI, macOS Keychain, Linux Secret Service)
  if (userDataPath) {
    try {
      const electron = await import("electron");
      const safeStorage = electron?.safeStorage;
      if (
        safeStorage &&
        typeof safeStorage.isEncryptionAvailable === "function" &&
        safeStorage.isEncryptionAvailable()
      ) {
        const keyFilePath = path.join(userDataPath, "kms-master.enc");
        try {
          const existingEncrypted = await fs.readFile(keyFilePath);
          const decryptedHex = safeStorage.decryptString(existingEncrypted);
          if (decryptedHex && decryptedHex.length === 64) {
            activeMasterKey = Buffer.from(decryptedHex, "hex");
            return activeMasterKey;
          }
        } catch {
          // File does not exist yet or needs generation
        }

        // Generate a new cryptographically secure 256-bit random master key
        const newKeyBytes = crypto.randomBytes(32);
        const newKeyHex = newKeyBytes.toString("hex");
        const encryptedKey = safeStorage.encryptString(newKeyHex);
        await fs.writeFile(keyFilePath, encryptedKey);
        activeMasterKey = newKeyBytes;
        return activeMasterKey;
      }
    } catch {
      // Electron or safeStorage unavailable in current context
    }
  }

  // 3. Automated test environment fallback (isolated to Vitest/Node test runs)
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    activeMasterKey = crypto
      .createHash("sha256")
      .update("vitest-test-suite-secure-master-key-seed")
      .digest();
    return activeMasterKey;
  }

  // 4. Fail-Safe: Never use an insecure static fallback in production
  throw new SecureStorageUnavailableError();
}

/**
 * Retrieve the active 256-bit Master Key for envelope encryption.
 */
export function getMasterKey(): Buffer {
  if (activeMasterKey) {
    return activeMasterKey;
  }
  if (
    process.env.KMS_MASTER_KEY &&
    process.env.KMS_MASTER_KEY.trim().length > 0
  ) {
    activeMasterKey = crypto
      .createHash("sha256")
      .update(process.env.KMS_MASTER_KEY.trim())
      .digest();
    return activeMasterKey;
  }
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    activeMasterKey = crypto
      .createHash("sha256")
      .update("vitest-test-suite-secure-master-key-seed")
      .digest();
    return activeMasterKey;
  }
  throw new SecureStorageUnavailableError();
}

/**
 * Hash a password using scrypt with a unique 16-byte random salt.
 * Formats hash string: $scrypt$N=16384,r=8,p=1$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `$scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Verify a candidate password against the stored scrypt hash using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split("$");
    // Format: ["", "scrypt", "N=...,r=...,p=...", saltHex, derivedKeyHex]
    if (parts.length !== 5 || parts[1] !== "scrypt") {
      return false;
    }
    const salt = parts[3];
    const expectedKeyHex = parts[4];
    if (!salt || !expectedKeyHex) {
      return false;
    }

    const expectedKey = Buffer.from(expectedKeyHex, "hex");
    const actualKey = crypto.scryptSync(password, salt, expectedKey.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });

    if (actualKey.length !== expectedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token (e.g. for sessions or reset tokens).
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Compute SHA-256 hash of a string (used to index session tokens and reset tokens).
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Envelope encryption for user-supplied third-party API keys (Gemini, OpenAI, Anthropic).
 */
export function encryptSecret(plaintextKey: string): {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyHint: string;
} {
  const masterKey = getMasterKey();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, nonce);

  let ciphertext = cipher.update(plaintextKey, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  const keyHint =
    plaintextKey.length > 4 ? `...${plaintextKey.slice(-4)}` : "****";

  return {
    ciphertext,
    nonce: nonce.toString("hex"),
    tag,
    keyHint,
  };
}

export interface DecryptResult {
  plaintext: string;
  migratedFromLegacy: boolean;
}

/**
 * Decrypt envelope-encrypted secret with transparent legacy migration support.
 */
export function decryptSecretWithMeta(
  ciphertext: string,
  nonceHex: string,
  tagHex: string,
): DecryptResult {
  const masterKey = getMasterKey();

  // 1. Attempt decryption with active master key
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      masterKey,
      Buffer.from(nonceHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    let plaintext = decipher.update(ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");
    return { plaintext, migratedFromLegacy: false };
  } catch {
    // Active key decryption failed; check if legacy dev key decrypts it
  }

  // 2. Attempt transparent fallback decryption using legacy dev seed key
  try {
    const legacyKey = crypto
      .createHash("sha256")
      .update(LEGACY_DEV_SEED)
      .digest();
    const legacyDecipher = crypto.createDecipheriv(
      "aes-256-gcm",
      legacyKey,
      Buffer.from(nonceHex, "hex"),
    );
    legacyDecipher.setAuthTag(Buffer.from(tagHex, "hex"));

    let plaintext = legacyDecipher.update(ciphertext, "hex", "utf8");
    plaintext += legacyDecipher.final("utf8");
    return { plaintext, migratedFromLegacy: true };
  } catch {
    // Both failed
  }

  throw new Error(
    "Failed to decrypt secret: invalid ciphertext, authentication tag mismatch, or unavailable key",
  );
}

/**
 * Decrypt envelope-encrypted secret.
 */
export function decryptSecret(
  ciphertext: string,
  nonceHex: string,
  tagHex: string,
): string {
  return decryptSecretWithMeta(ciphertext, nonceHex, tagHex).plaintext;
}
