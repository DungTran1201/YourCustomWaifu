import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  encryptSecret,
  decryptSecret,
  decryptSecretWithMeta,
  setMasterKey,
  getMasterKey,
  SecureStorageUnavailableError,
} from "../electron/server/crypto.js";

describe("P0 Security: Master Key Lifecycle, Encryption & Legacy Migration", () => {
  const TEST_KEY = "custom-test-master-key-seed-32bytes-long!";
  const LEGACY_DEV_SEED = "default-vrm-kms-master-key-dev-seed-32bytes!";

  beforeEach(() => {
    setMasterKey(TEST_KEY);
  });

  afterEach(() => {
    setMasterKey(null);
  });

  it("derives a 256-bit (32-byte) master key buffer from configured key", () => {
    const key = getMasterKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("encrypts and decrypts user API secrets cleanly with AES-256-GCM envelope", () => {
    const sampleApiKey = "AIzaSySecretTestingApiKey123456789";
    const encrypted = encryptSecret(sampleApiKey);

    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.keyHint).toBe("...6789");

    const decrypted = decryptSecret(
      encrypted.ciphertext,
      encrypted.nonce,
      encrypted.tag,
    );
    expect(decrypted).toBe(sampleApiKey);
  });

  it("fails securely when ciphertext or auth tag is tampered with", () => {
    const sampleApiKey = "sk-proj-TestingOpenAIApiKey99887766";
    const encrypted = encryptSecret(sampleApiKey);

    // Tamper with ciphertext by flipping characters
    const tamperedCiphertext =
      encrypted.ciphertext.slice(0, -2) +
      (encrypted.ciphertext.slice(-2) === "aa" ? "bb" : "aa");

    expect(() =>
      decryptSecret(tamperedCiphertext, encrypted.nonce, encrypted.tag),
    ).toThrow();

    // Tamper with authentication tag
    const tamperedTag =
      encrypted.tag.slice(0, -2) +
      (encrypted.tag.slice(-2) === "00" ? "11" : "00");

    expect(() =>
      decryptSecret(encrypted.ciphertext, encrypted.nonce, tamperedTag),
    ).toThrow();
  });

  it("transparently migrates legacy records encrypted under the dev seed", () => {
    // 1. Simulate an old record encrypted under the legacy dev seed
    const legacyKey = crypto
      .createHash("sha256")
      .update(LEGACY_DEV_SEED)
      .digest();
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", legacyKey, nonce);
    const legacyPlaintext = "AIzaSyLegacyKeyRequiringMigration777";
    let legacyCiphertext = cipher.update(legacyPlaintext, "utf8", "hex");
    legacyCiphertext += cipher.final("hex");
    const legacyTag = cipher.getAuthTag().toString("hex");

    // 2. Decrypt with active secure master key configured (which is different from legacy)
    const result = decryptSecretWithMeta(
      legacyCiphertext,
      nonce.toString("hex"),
      legacyTag,
    );

    expect(result.plaintext).toBe(legacyPlaintext);
    expect(result.migratedFromLegacy).toBe(true);
  });

  it("fails safely when secure storage is completely unavailable and no KMS_MASTER_KEY is configured", () => {
    setMasterKey(null);
    const origEnv = process.env.KMS_MASTER_KEY;
    const origNodeEnv = process.env.NODE_ENV;
    const origVitest = process.env.VITEST;

    try {
      delete process.env.KMS_MASTER_KEY;
      delete process.env.VITEST;
      process.env.NODE_ENV = "production";

      expect(() => getMasterKey()).toThrow(SecureStorageUnavailableError);
    } finally {
      process.env.KMS_MASTER_KEY = origEnv;
      process.env.NODE_ENV = origNodeEnv;
      process.env.VITEST = origVitest;
      setMasterKey(TEST_KEY);
    }
  });

  it("never includes the raw secret key in error messages", () => {
    const superSecretKey = "SuperSensitivePasswordSecret999";
    try {
      decryptSecret("invalidhex", "invalidnonce", "invalidtag");
    } catch (err: any) {
      expect(err.message).not.toContain(superSecretKey);
    }
  });
});
