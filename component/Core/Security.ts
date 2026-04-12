import * as forge from 'node-forge';
import * as SecureStore from 'expo-secure-store';

// ── AES-256-GCM constants ──
const AES_KEY_ALIAS = 'agus_list_aes_key';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for GCM

// ── Legacy RSA constants (kept for backward-compatibility migration) ──
const RSA_KEY_SIZE = 2048;
const PRIVATE_KEY_ALIAS = 'agus_list_rsa_private_key';
const PUBLIC_KEY_ALIAS = 'agus_list_rsa_public_key';

export interface KeyPair {
  public: string;
  private: string;
}

// ── ArrayBuffer ↔ Base64 helpers ──

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── AES-256-GCM key management ──

/**
 * Generates a new AES-256 key, stores it in SecureStore, and returns it.
 * Exposed for testing; prefer `getAESKey` for application code.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: AES_KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = await crypto.subtle.exportKey('raw', key);
  await SecureStore.setItemAsync(AES_KEY_ALIAS, arrayBufferToBase64(exported));
  return key;
}

/**
 * Returns the stored AES-256 key, generating and persisting one if absent.
 */
export async function getAESKey(): Promise<CryptoKey> {
  const stored = await SecureStore.getItemAsync(AES_KEY_ALIAS);
  if (stored) {
    const rawKey = base64ToArrayBuffer(stored);
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }
  return generateAESKey();
}

// ── Encryption / Decryption ──

/**
 * Encrypts `value` with AES-256-GCM.
 * The returned string is base64(12-byte-IV || ciphertext).
 */
export async function encrypt(value: string): Promise<string> {
  try {
    const key = await getAESKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), IV_LENGTH);
    return arrayBufferToBase64(result.buffer);
  } catch (e) {
    console.error('Failed to encrypt value', e);
    throw 'Failed to encrypt value';
  }
}

/**
 * Decrypts a value produced by `encrypt`.
 * Falls back to legacy RSA decryption for items encrypted before the AES migration.
 */
export async function decrypt(hash: string): Promise<string> {
  try {
    return await decryptAES(hash);
  } catch {
    // Legacy path: item was encrypted with RSA before the AES migration.
    return await decryptLegacyRSA(hash);
  }
}

async function decryptAES(hash: string): Promise<string> {
  const key = await getAESKey();
  const data = base64ToArrayBuffer(hash);
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function decryptLegacyRSA(hash: string): Promise<string> {
  const keyPair = await getRSAKeys();
  if (!keyPair) {
    throw 'Failed to get RSA keys';
  }
  const privateKey = forge.pki.privateKeyFromPem(keyPair.private);
  const decoded = forge.util.decode64(hash);
  const decrypted = privateKey.decrypt(decoded, 'RSA-OAEP');
  return forge.util.decodeUtf8(decrypted);
}

// ── Passphrase-based key wrapping for cross-device recovery ──

async function deriveKeyFromPassphrase(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Wraps the local AES key with a passphrase using PBKDF2 + AES-KW.
 * The returned string is base64(16-byte-salt || AES-KW-wrapped-key).
 * Store this in Firestore; the passphrase never leaves the device.
 */
export async function wrapAESKey(passphrase: string): Promise<string> {
  const aesKey = await getAESKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveKeyFromPassphrase(passphrase, salt.buffer as ArrayBuffer);
  const wrapped = await crypto.subtle.wrapKey('raw', aesKey, wrapKey, 'AES-KW');
  const result = new Uint8Array(16 + wrapped.byteLength);
  result.set(salt, 0);
  result.set(new Uint8Array(wrapped), 16);
  return arrayBufferToBase64(result.buffer);
}

/**
 * Unwraps a key produced by `wrapAESKey` using the original passphrase and
 * stores it locally, making it available for decrypt() calls.
 */
export async function unwrapAESKey(wrappedKeyData: string, passphrase: string): Promise<void> {
  const data = base64ToArrayBuffer(wrappedKeyData);
  const salt = data.slice(0, 16);
  const wrapped = data.slice(16);
  const wrapKey = await deriveKeyFromPassphrase(passphrase, salt);
  const key = await crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    wrapKey,
    'AES-KW',
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  await SecureStore.setItemAsync(AES_KEY_ALIAS, arrayBufferToBase64(exported));
}

// ── Legacy RSA key management (used only for the migration fallback) ──

export async function getRSAKeys(): Promise<KeyPair | null> {
  const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY_ALIAS);
  const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_ALIAS);

  if (publicKey && privateKey) {
    return { public: publicKey, private: privateKey };
  }

  try {
    return await generateAndStoreRSAKeys();
  } catch (e) {
    console.error(`Failed to generate and store RSA keys ${e}`);
    throw 'Failed to generate and store RSA keys';
  }
}

async function generateAndStoreRSAKeys(): Promise<KeyPair> {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: RSA_KEY_SIZE });
  const publicPem = forge.pki.publicKeyToPem(keypair.publicKey);
  const privatePem = forge.pki.privateKeyToPem(keypair.privateKey);
  await SecureStore.setItemAsync(PRIVATE_KEY_ALIAS, privatePem);
  await SecureStore.setItemAsync(PUBLIC_KEY_ALIAS, publicPem);
  return { public: publicPem, private: privatePem };
}
