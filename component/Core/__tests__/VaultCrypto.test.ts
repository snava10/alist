import { pbkdf2Sync, createHash } from 'node:crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  base64ToBytes,
  bytesToBase64,
  computeVerifier,
  decryptVaultItem,
  DEFAULT_KDF_ITERATIONS,
  deriveMasterKey,
  encryptVaultItem,
  equalBytes,
  ITEM_KEY_LENGTH,
  newItemId,
  NONCE_LENGTH,
  randomBytes,
  SALT_LENGTH,
  unwrapKey,
  VAULT_KEY_LENGTH,
  VaultCryptoError,
  wrapKey,
  zeroBytes,
} from '../VaultCrypto';
import { validateVaultItemDocument } from '../Contracts';
import type { VaultItemDocument } from '../DataModel';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function flipped(bytes: Uint8Array, index = 0): Uint8Array {
  const copy = new Uint8Array(bytes);
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
}

const ITEM_ID = '123e4567-e89b-42d3-a456-426614174000';

function makeDocument(
  vaultKey: Uint8Array,
  name = 'password',
  value = 's3cret'
): VaultItemDocument {
  const encrypted = encryptVaultItem(vaultKey, ITEM_ID, 1, name, value);
  const document: VaultItemDocument = {
    id: ITEM_ID,
    userId: 'user-123',
    ...encrypted,
    algorithm: 'xchacha20-poly1305',
    schemaVersion: 2,
    version: 1,
    createdAt: 1712438400000,
    updatedAt: 1712438400000,
  };
  expect(() => validateVaultItemDocument(document)).not.toThrow();
  return document;
}

describe('VaultCrypto known-answer vectors', () => {
  it('matches the draft-irtf-cfrg-xchacha-03 A.1 XChaCha20-Poly1305 vector', () => {
    // Published vector, Appendix A.1: key 80..9f, nonce 40..57,
    // AAD 50515253c0c1c2c3c4c5c6c7.
    const key = hexToBytes('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f');
    const nonce = hexToBytes('404142434445464748494a4b4c4d4e4f5051525354555657');
    const aad = hexToBytes('50515253c0c1c2c3c4c5c6c7');
    const plaintext =
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.";
    const expectedCiphertext =
      'bd6d179d3e83d43b9576579493c0e939572a1700252bfaccbed2902c21396cbb731c7f1b0b4aa6440bf3a82f4eda7e39ae64c6708c54c216cb96b72e1213b4522f8c9ba40db5d945b11b69b982c1bb9e3f3fac2bc369488f76b2383565d3fff921f9664c97637da9768812f615c68b13b52e';
    const expectedTag = 'c0875924c1c7987947deafd8780acf49';
    const encrypted = xchacha20poly1305(key, nonce, aad).encrypt(utf8ToBytes(plaintext));
    expect(bytesToHex(encrypted)).toBe(expectedCiphertext + expectedTag);
    const decrypted = xchacha20poly1305(key, nonce, aad).decrypt(encrypted);
    expect(decrypted).toEqual(utf8ToBytes(plaintext));
  });

  it('matches the PBKDF2-HMAC-SHA256 vector at one iteration', async () => {
    const derived = await deriveMasterKey('password', utf8ToBytes('salt'), {
      iterations: 1,
      dkLen: 32,
    });
    expect(bytesToHex(derived)).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'
    );
  });

  it('agrees with Node crypto PBKDF2 at 1000 iterations', async () => {
    const salt = utf8ToBytes('salt');
    const derived = await deriveMasterKey('password', salt, { iterations: 1000, dkLen: 32 });
    expect(bytesToHex(derived)).toBe(
      pbkdf2Sync('password', salt, 1000, 32, 'sha256').toString('hex')
    );
  });

  it('computes the verifier as base64 SHA-256 of the derived key', () => {
    const key = new Uint8Array(32).fill(1);
    expect(computeVerifier(key)).toBe('cs1uhCLEB/ttCYaQ8RMLfe1+wvf14dML2dUh8BU2N5M=');
    expect(computeVerifier(key)).toBe(createHash('sha256').update(key).digest('base64'));
  });
});

describe('VaultCrypto key derivation', () => {
  it('uses the OWASP PBKDF2 iteration count by default', () => {
    expect(DEFAULT_KDF_ITERATIONS).toBe(600_000);
  });

  it('derives deterministically for the same password and salt', async () => {
    const salt = randomBytes(SALT_LENGTH);
    const params = { iterations: 100, dkLen: 32 };
    const first = await deriveMasterKey('correct horse', salt, params);
    const second = await deriveMasterKey('correct horse', salt, params);
    expect(first).toEqual(second);
    expect(first).toHaveLength(32);
  });

  it('derives different keys for different salts and passwords', async () => {
    const params = { iterations: 100, dkLen: 32 };
    const a = await deriveMasterKey('password', randomBytes(SALT_LENGTH), params);
    const b = await deriveMasterKey('password', randomBytes(SALT_LENGTH), params);
    const c = await deriveMasterKey('other', randomBytes(SALT_LENGTH), params);
    expect(equalBytes(a, b)).toBe(false);
    expect(equalBytes(a, c)).toBe(false);
  });

  it('rejects an empty password, a short salt, and invalid parameters', async () => {
    const salt = randomBytes(SALT_LENGTH);
    await expect(deriveMasterKey('', salt, { iterations: 100, dkLen: 32 })).rejects.toThrow(
      VaultCryptoError
    );
    await expect(
      deriveMasterKey('password', new Uint8Array(0), { iterations: 100, dkLen: 32 })
    ).rejects.toThrow(VaultCryptoError);
    await expect(deriveMasterKey('password', salt, { iterations: 0, dkLen: 32 })).rejects.toThrow(
      VaultCryptoError
    );
    await expect(deriveMasterKey('password', salt, { iterations: 100, dkLen: 0 })).rejects.toThrow(
      VaultCryptoError
    );
  });
});

describe('VaultCrypto envelope encryption', () => {
  it('round-trips name and value, including empty, unicode, and long values', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    for (const [name, value] of [
      ['password', 's3cret'],
      ['empty', ''],
      ['unicode', 'pässwörd 🔑'],
      ['long', 'x'.repeat(5000)],
    ] as const) {
      expect(decryptVaultItem(vaultKey, makeDocument(vaultKey, name, value))).toEqual({
        name,
        value,
      });
    }
  });

  it('never reuses a nonce: repeated encryptions of the same item differ', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const encrypted = encryptVaultItem(vaultKey, ITEM_ID, 1, 'password', 's3cret');
      seen.add(`${encrypted.nonce}:${encrypted.wrappedKeyNonce}:${encrypted.ciphertext}`);
    }
    expect(seen.size).toBe(100);
  });

  it('rejects a single-byte tamper in the ciphertext', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const document = makeDocument(vaultKey);
    document.ciphertext = bytesToBase64(flipped(base64ToBytes(document.ciphertext)));
    expect(() => decryptVaultItem(vaultKey, document)).toThrow(VaultCryptoError);
  });

  it('rejects a single-byte tamper in the nonce', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const document = makeDocument(vaultKey);
    document.nonce = bytesToBase64(flipped(base64ToBytes(document.nonce)));
    expect(() => decryptVaultItem(vaultKey, document)).toThrow(VaultCryptoError);
  });

  it('rejects a single-byte tamper in the wrapped item key', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const document = makeDocument(vaultKey);
    document.wrappedItemKey = bytesToBase64(flipped(base64ToBytes(document.wrappedItemKey)));
    expect(() => decryptVaultItem(vaultKey, document)).toThrow(VaultCryptoError);
  });

  it('rejects decryption under the wrong vault key', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const document = makeDocument(vaultKey);
    expect(() => decryptVaultItem(randomBytes(VAULT_KEY_LENGTH), document)).toThrow(
      VaultCryptoError
    );
  });

  it('rejects decryption when the AAD-bound version or id changes', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    const byVersion = makeDocument(vaultKey);
    byVersion.version = 2;
    expect(() => decryptVaultItem(vaultKey, byVersion)).toThrow(VaultCryptoError);
    const byId = makeDocument(vaultKey);
    byId.id = '223e4567-e89b-42d3-a456-426614174000';
    expect(() => decryptVaultItem(vaultKey, byId)).toThrow(VaultCryptoError);
  });

  it('rejects short vault keys and an empty item name', () => {
    expect(() => encryptVaultItem(randomBytes(31), ITEM_ID, 1, 'password', 'value')).toThrow(
      VaultCryptoError
    );
    expect(() => encryptVaultItem(randomBytes(VAULT_KEY_LENGTH), ITEM_ID, 1, '', 'value')).toThrow(
      VaultCryptoError
    );
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);
    expect(() => decryptVaultItem(randomBytes(31), makeDocument(vaultKey))).toThrow(
      VaultCryptoError
    );
  });
});

describe('VaultCrypto key wrapping', () => {
  it('round-trips a wrapped key and uses a fresh nonce each time', () => {
    const wrappingKey = randomBytes(VAULT_KEY_LENGTH);
    const key = randomBytes(VAULT_KEY_LENGTH);
    const first = wrapKey(key, wrappingKey, 'purpose:v1');
    const second = wrapKey(key, wrappingKey, 'purpose:v1');
    expect(first.nonce).not.toBe(second.nonce);
    expect(unwrapKey(first, wrappingKey, 'purpose:v1')).toEqual(key);
  });

  it('rejects unwrapping under the wrong key or the wrong AAD', () => {
    const wrappingKey = randomBytes(VAULT_KEY_LENGTH);
    const wrapped = wrapKey(randomBytes(VAULT_KEY_LENGTH), wrappingKey, 'purpose:v1');
    expect(() => unwrapKey(wrapped, randomBytes(VAULT_KEY_LENGTH), 'purpose:v1')).toThrow(
      VaultCryptoError
    );
    expect(() => unwrapKey(wrapped, wrappingKey, 'other:v1')).toThrow(VaultCryptoError);
  });

  it('rejects a tampered wrapped key and missing AAD', () => {
    const wrappingKey = randomBytes(VAULT_KEY_LENGTH);
    const wrapped = wrapKey(randomBytes(VAULT_KEY_LENGTH), wrappingKey, 'purpose:v1');
    wrapped.ciphertext = bytesToBase64(flipped(base64ToBytes(wrapped.ciphertext)));
    expect(() => unwrapKey(wrapped, wrappingKey, 'purpose:v1')).toThrow(VaultCryptoError);
    expect(() => wrapKey(randomBytes(VAULT_KEY_LENGTH), wrappingKey, '')).toThrow(VaultCryptoError);
    expect(() => wrapKey(randomBytes(VAULT_KEY_LENGTH), randomBytes(16), 'purpose:v1')).toThrow(
      VaultCryptoError
    );
  });
});

describe('VaultCrypto byte helpers and ids', () => {
  it('round-trips base64, including every byte value and the empty input', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) {
      allBytes[i] = i;
    }
    expect(base64ToBytes(bytesToBase64(allBytes))).toEqual(allBytes);
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(bytesToBase64(utf8ToBytes('hello'))).toBe('aGVsbG8=');
  });

  it('generates unique random bytes and rejects invalid lengths', () => {
    expect(randomBytes(16)).toHaveLength(16);
    expect(randomBytes(NONCE_LENGTH)).toHaveLength(NONCE_LENGTH);
    expect(randomBytes(ITEM_KEY_LENGTH)).not.toEqual(randomBytes(ITEM_KEY_LENGTH));
    expect(() => randomBytes(0)).toThrow(VaultCryptoError);
    expect(() => randomBytes(-1)).toThrow(VaultCryptoError);
    expect(() => randomBytes(1.5)).toThrow(VaultCryptoError);
  });

  it('zeroes key material and compares bytes without early exit on values', () => {
    const key = randomBytes(VAULT_KEY_LENGTH);
    zeroBytes(key);
    expect(key).toEqual(new Uint8Array(VAULT_KEY_LENGTH));
    zeroBytes(null);
    zeroBytes(undefined);
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(equalBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });

  it('generates unique UUID v4 ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const id = newItemId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(200);
  });
});
