import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8 } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import { decode as base64Decode, encode as base64Encode } from 'base-64';
import { KdfParams, VaultItemDocument } from './DataModel';
import { validateVaultItemPayload } from './Contracts';

/**
 * Vault cryptography: envelope encryption with XChaCha20-Poly1305 and
 * PBKDF2-HMAC-SHA256 key derivation. No key, password, plaintext, or
 * ciphertext is ever logged from this module. Keys are wiped with
 * zeroBytes when they leave use.
 *
 * Dependency review (Step 3 spike):
 * - `@noble/ciphers` 2.4.0: Cure53-audited (Sep 2024, v1.0.0, scope:
 *   everything), actively maintained, pure JS with no native code, so it
 *   runs under Hermes. Provides XChaCha20-Poly1305 here.
 * - `@noble/hashes` 2.4.0: Cure53-audited (Jan 2022, v1.0.0, scope:
 *   everything except blake3, sha3-addons, sha1, and argon2). PBKDF2 and
 *   SHA-256 used here are in scope. Pure JS, no native code.
 * - `expo-crypto` (already a dependency) supplies randomness only via
 *   `getRandomValues`. It exposes no PBKDF2 API, so the KDF cannot come
 *   from it; the KDF comes from `@noble/hashes` instead.
 *
 * KDF spike decision (transformation plan decision D2): Argon2id is
 * preferred but is NOT used. The Argon2 implementation in
 * `@noble/hashes` is experimental and explicitly outside the Cure53
 * audit scope; `react-native-argon2` 2.0.1 is unmaintained (React Native
 * 0.60–0.63, published four years ago); the only newer Expo binding,
 * `@sonnetstationsolutions/expo-argon2` 0.1.1, is unaudited, has a
 * single maintainer, and targets Expo 56 / React Native 0.85 while this
 * project is on Expo 55. The recorded PBKDF2 fallback is therefore used,
 * with versioned parameters in the vault profile (Step 2) so the KDF can
 * be upgraded later without re-encrypting everything. Pure-JS PBKDF2 at
 * 600,000 iterations is unmeasured on low-end devices: Step 5 must
 * derive off the render path with unlock progress shown, and a device
 * benchmark is a follow-up before release.
 */

export class VaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultCryptoError';
  }
}

export const VAULT_KEY_LENGTH = 32;
export const ITEM_KEY_LENGTH = 32;
export const NONCE_LENGTH = 24;
export const SALT_LENGTH = 16;

/** OWASP iteration count for PBKDF2-HMAC-SHA256. */
export const DEFAULT_KDF_ITERATIONS = 600_000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return base64Encode(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = base64Decode(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Cryptographically secure random bytes from the platform CSPRNG. */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new VaultCryptoError('randomBytes requires a positive length');
  }
  return Crypto.getRandomValues(new Uint8Array(length));
}

/** Overwrite key material in place. Callers must zero keys when done with them. */
export function zeroBytes(bytes: Uint8Array | null | undefined): void {
  if (bytes) {
    bytes.fill(0);
  }
}

/** Length-and-content comparison that does not short-circuit on the first difference. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Random UUID v4 from the platform CSPRNG. Document IDs never derive from content. */
export function newItemId(): string {
  const bytes = randomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Derive the master key from a master password and per-account salt.
 * The async variant keeps long derivations off the render path.
 */
export async function deriveMasterKey(
  password: string,
  salt: Uint8Array,
  params: Pick<KdfParams, 'iterations' | 'dkLen'>
): Promise<Uint8Array> {
  if (!password) {
    throw new VaultCryptoError('Master password is required');
  }
  if (salt.length === 0) {
    throw new VaultCryptoError('KDF salt is required');
  }
  // Production salts are always SALT_LENGTH bytes (generated with
  // randomBytes at profile creation in Step 5). Derivation itself accepts
  // any non-empty salt so published KDF vectors remain testable.
  if (!Number.isInteger(params.iterations) || params.iterations <= 0) {
    throw new VaultCryptoError('KDF iteration count is invalid');
  }
  if (!Number.isInteger(params.dkLen) || params.dkLen <= 0) {
    throw new VaultCryptoError('KDF derived key length is invalid');
  }
  try {
    return await pbkdf2Async(sha256, utf8ToBytes(password), salt, {
      c: params.iterations,
      dkLen: params.dkLen,
    });
  } catch {
    throw new VaultCryptoError('Failed to derive the master key');
  }
}

/** Password verifier: SHA-256 of the derived key, stored in the vault profile. */
export function computeVerifier(masterKey: Uint8Array): string {
  return bytesToBase64(sha256(masterKey));
}

function itemAad(itemId: string, version: number): Uint8Array {
  return utf8ToBytes(`item:${itemId}:${version}`);
}

function itemKeyWrapAad(itemId: string, version: number): string {
  return `item-key:${itemId}:${version}`;
}

export type WrappedKey = {
  ciphertext: string;
  nonce: string;
};

/**
 * Wrap a key under a wrapping key with a fresh random nonce and
 * caller-supplied AAD. The AAD binds the wrapped key to its purpose
 * (for example, one item at one version); a wrapped key presented with
 * different AAD fails to unwrap.
 */
export function wrapKey(keyToWrap: Uint8Array, wrappingKey: Uint8Array, aad: string): WrappedKey {
  if (wrappingKey.length !== VAULT_KEY_LENGTH) {
    throw new VaultCryptoError('Wrapping key has an unexpected length');
  }
  if (!aad) {
    throw new VaultCryptoError('Key wrapping requires AAD');
  }
  const nonce = randomBytes(NONCE_LENGTH);
  const ciphertext = xchacha20poly1305(wrappingKey, nonce, utf8ToBytes(aad)).encrypt(keyToWrap);
  return { ciphertext: bytesToBase64(ciphertext), nonce: bytesToBase64(nonce) };
}

/** Unwrap a key; any authentication failure rejects without detail. */
export function unwrapKey(wrapped: WrappedKey, wrappingKey: Uint8Array, aad: string): Uint8Array {
  if (wrappingKey.length !== VAULT_KEY_LENGTH) {
    throw new VaultCryptoError('Wrapping key has an unexpected length');
  }
  if (!aad) {
    throw new VaultCryptoError('Key unwrapping requires AAD');
  }
  try {
    return xchacha20poly1305(wrappingKey, base64ToBytes(wrapped.nonce), utf8ToBytes(aad)).decrypt(
      base64ToBytes(wrapped.ciphertext)
    );
  } catch {
    throw new VaultCryptoError('Failed to unwrap the key');
  }
}

export type EncryptedVaultItem = Pick<
  VaultItemDocument,
  'ciphertext' | 'nonce' | 'wrappedItemKey' | 'wrappedKeyNonce'
>;

/**
 * Encrypt one item: a fresh random per-item key encrypts the name and
 * value together with AAD bound to the item ID and version, and the
 * vault key wraps the per-item key with AAD bound to the same item and
 * version. Nonces are never reused: both are freshly random.
 */
export function encryptVaultItem(
  vaultKey: Uint8Array,
  itemId: string,
  version: number,
  name: string,
  value: string
): EncryptedVaultItem {
  if (vaultKey.length !== VAULT_KEY_LENGTH) {
    throw new VaultCryptoError('Vault key has an unexpected length');
  }
  if (!name) {
    throw new VaultCryptoError('Item name is required');
  }
  if (typeof value !== 'string') {
    throw new VaultCryptoError('Item value must be a string');
  }
  const itemKey = randomBytes(ITEM_KEY_LENGTH);
  try {
    const payload = utf8ToBytes(JSON.stringify({ name, value }));
    const nonce = randomBytes(NONCE_LENGTH);
    const ciphertext = xchacha20poly1305(itemKey, nonce, itemAad(itemId, version)).encrypt(payload);
    const wrapped = wrapKey(itemKey, vaultKey, itemKeyWrapAad(itemId, version));
    return {
      ciphertext: bytesToBase64(ciphertext),
      nonce: bytesToBase64(nonce),
      wrappedItemKey: wrapped.ciphertext,
      wrappedKeyNonce: wrapped.nonce,
    };
  } finally {
    zeroBytes(itemKey);
  }
}

/**
 * Decrypt one vault document. AAD, authentication-tag, key, or payload
 * failures all reject as VaultCryptoError so callers quarantine the item
 * instead of treating undecryptable data as plaintext.
 */
export function decryptVaultItem(
  vaultKey: Uint8Array,
  document: VaultItemDocument
): { name: string; value: string } {
  if (vaultKey.length !== VAULT_KEY_LENGTH) {
    throw new VaultCryptoError('Vault key has an unexpected length');
  }
  let itemKey: Uint8Array | null = null;
  try {
    itemKey = unwrapKey(
      { ciphertext: document.wrappedItemKey, nonce: document.wrappedKeyNonce },
      vaultKey,
      itemKeyWrapAad(document.id, document.version)
    );
    const plaintext = xchacha20poly1305(
      itemKey,
      base64ToBytes(document.nonce),
      itemAad(document.id, document.version)
    ).decrypt(base64ToBytes(document.ciphertext));
    const parsed: unknown = JSON.parse(bytesToUtf8(plaintext));
    return validateVaultItemPayload(parsed);
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }
    throw new VaultCryptoError('Failed to decrypt the vault item');
  } finally {
    zeroBytes(itemKey);
  }
}
