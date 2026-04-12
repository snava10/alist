import * as forge from 'node-forge';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';

const AES_KEY_ALIAS = 'agus_list_aes_key';
const PRIVATE_KEY_ALIAS = 'agus_list_rsa_private_key';
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const WRAP_SALT_BYTES = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_FAST_ITERATIONS = 15000;
const WRAPPED_KEY_VERSION = 1;

function randomBytes(length: number): string {
  const bytes = getRandomBytes(length);
  return String.fromCharCode(...bytes);
}

function encodeUint32BE(value: number): string {
  return String.fromCharCode(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

function decodeUint32BE(bytes: string): number {
  return (
    (bytes.charCodeAt(0) << 24) |
    (bytes.charCodeAt(1) << 16) |
    (bytes.charCodeAt(2) << 8) |
    bytes.charCodeAt(3)
  );
}

// ── AES-256-GCM helpers ──────────────────────────────────────────────────────

/** Returns the raw 32-byte AES key, generating and persisting it on first use. */
async function getRawAESKeyBytes(): Promise<string> {
  const stored = await SecureStore.getItemAsync(AES_KEY_ALIAS);
  if (stored) {
    return forge.util.decode64(stored);
  }
  const rawBytes = randomBytes(AES_KEY_BYTES);
  await SecureStore.setItemAsync(AES_KEY_ALIAS, forge.util.encode64(rawBytes));
  return rawBytes;
}

/** Encrypt with AES-256-GCM. Returns base64(12-byte-IV ‖ ciphertext). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getRawAESKeyBytes();
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({ iv, tagLength: 128 });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)));

  if (!cipher.finish()) {
    throw new Error('Failed to encrypt value');
  }

  const ciphertext = cipher.output.getBytes();
  const tag = cipher.mode.tag.getBytes();
  return forge.util.encode64(iv + ciphertext + tag);
}

/**
 * Decrypt with AES-256-GCM.
 * Falls back to legacy RSA-OAEP (node-forge) when decryption fails with an
 * OperationError so that existing stored items migrate transparently.
 */
export async function decrypt(hash: string): Promise<string> {
  try {
    const combined = forge.util.decode64(hash);
    if (combined.length <= GCM_IV_BYTES + GCM_TAG_BYTES) {
      throw new Error('Invalid AES payload length');
    }

    const iv = combined.slice(0, GCM_IV_BYTES);
    const encryptedAndTag = combined.slice(GCM_IV_BYTES);
    const ciphertext = encryptedAndTag.slice(0, encryptedAndTag.length - GCM_TAG_BYTES);
    const tag = encryptedAndTag.slice(encryptedAndTag.length - GCM_TAG_BYTES);
    const key = await getRawAESKeyBytes();

    const decipher = forge.cipher.createDecipher('AES-GCM', key);
    decipher.start({ iv, tag: forge.util.createBuffer(tag), tagLength: 128 });
    decipher.update(forge.util.createBuffer(ciphertext));

    if (!decipher.finish()) {
      const operationError = new Error('AES-GCM authentication failed');
      operationError.name = 'OperationError';
      throw operationError;
    }

    return forge.util.decodeUtf8(decipher.output.getBytes());
  } catch (e) {
    if (e instanceof Error && e.name === 'OperationError') {
      return rsaDecryptLegacy(hash);
    }
    throw e;
  }
}

// ── Legacy RSA fallback (read-only — no new RSA encryptions) ─────────────────

async function rsaDecryptLegacy(hash: string): Promise<string> {
  try {
    const privatePem = await SecureStore.getItemAsync(PRIVATE_KEY_ALIAS);
    if (!privatePem) {
      throw new Error('No RSA private key available for legacy decryption');
    }
    const privateKey = forge.pki.privateKeyFromPem(privatePem);
    const decoded = forge.util.decode64(hash);
    const decrypted = privateKey.decrypt(decoded, 'RSA-OAEP');
    return forge.util.decodeUtf8(decrypted);
  } catch (e) {
    console.error('Legacy RSA decrypt failed', e);
    throw new Error('Failed to decrypt value');
  }
}

// ── Cross-device key portability ─────────────────────────────────────────────

/**
 * Wraps the AES key with a passphrase using PBKDF2-SHA256 + AES-GCM.
 * Returns base64(version ‖ iterations ‖ 16-byte-salt ‖ wrapped-key).
 */
export async function wrapAESKey(
  passphrase: string,
  options?: { mode?: 'standard' | 'fast' }
): Promise<string> {
  const rawKeyBytes = await getRawAESKeyBytes();
  const salt = randomBytes(WRAP_SALT_BYTES);
  const iterations = options?.mode === 'fast' ? PBKDF2_FAST_ITERATIONS : PBKDF2_ITERATIONS;
  const wrappingKey = forge.pkcs5.pbkdf2(
    passphrase,
    salt,
    iterations,
    AES_KEY_BYTES,
    forge.md.sha256.create()
  );

  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = forge.cipher.createCipher('AES-GCM', wrappingKey);
  cipher.start({ iv, tagLength: 128 });
  cipher.update(forge.util.createBuffer(rawKeyBytes));

  if (!cipher.finish()) {
    throw new Error('Failed to wrap key');
  }

  const wrapped = iv + cipher.output.getBytes() + cipher.mode.tag.getBytes();
  const metadata = String.fromCharCode(WRAPPED_KEY_VERSION) + encodeUint32BE(iterations);
  return forge.util.encode64(metadata + salt + wrapped);
}

/**
 * Restores the AES key from a passphrase-wrapped blob and stores it in
 * SecureStore, overwriting the current key.
 * Throws if the passphrase is wrong (GCM auth fails).
 */
export async function unwrapAESKey(wrapped: string, passphrase: string): Promise<void> {
  const combined = forge.util.decode64(wrapped);

  const legacyMinimumLength = WRAP_SALT_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES + 1;
  const versionedMinimumLength = 1 + 4 + WRAP_SALT_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES + 1;

  if (combined.length < legacyMinimumLength) {
    throw new Error('Invalid wrapped key payload');
  }

  let iterations = PBKDF2_ITERATIONS;
  let cursor = 0;
  if (combined.length >= versionedMinimumLength && combined.charCodeAt(0) === WRAPPED_KEY_VERSION) {
    iterations = decodeUint32BE(combined.slice(1, 5));
    cursor = 5;
  }

  const salt = combined.slice(cursor, cursor + WRAP_SALT_BYTES);
  const encryptedPayload = combined.slice(cursor + WRAP_SALT_BYTES);
  const iv = encryptedPayload.slice(0, GCM_IV_BYTES);
  const ciphertextWithTag = encryptedPayload.slice(GCM_IV_BYTES);
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - GCM_TAG_BYTES);
  const tag = ciphertextWithTag.slice(ciphertextWithTag.length - GCM_TAG_BYTES);

  const unwrappingKey = forge.pkcs5.pbkdf2(
    passphrase,
    salt,
    iterations,
    AES_KEY_BYTES,
    forge.md.sha256.create()
  );

  const decipher = forge.cipher.createDecipher('AES-GCM', unwrappingKey);
  decipher.start({ iv, tag: forge.util.createBuffer(tag), tagLength: 128 });
  decipher.update(forge.util.createBuffer(ciphertext));

  if (!decipher.finish()) {
    throw new Error('Invalid passphrase');
  }

  const unwrappedKeyBytes = decipher.output.getBytes();
  if (unwrappedKeyBytes.length !== AES_KEY_BYTES) {
    throw new Error('Invalid unwrapped key length');
  }

  await SecureStore.setItemAsync(AES_KEY_ALIAS, forge.util.encode64(unwrappedKeyBytes));
}
