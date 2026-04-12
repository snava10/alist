import { encrypt, decrypt, wrapAESKey, unwrapAESKey } from '../Security';

// ── SecureStore mock: simple in-memory key-value store ──────────────────────
const store: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
}));

// node-forge is only used for the legacy RSA fallback path; no mock needed for AES tests.
jest.mock('node-forge', () => {
  const forge = jest.requireActual('node-forge');
  return forge;
});

describe('Security – AES-256-GCM', () => {
  beforeEach(() => {
    // Clear the in-memory SecureStore so each test gets a fresh AES key
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  });

  it('encrypt returns a non-empty base64 string', async () => {
    const result = await encrypt('hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('encrypt → decrypt round-trip', async () => {
    const plaintext = 'super secret';
    const ciphertext = await encrypt(plaintext);
    const recovered = await decrypt(ciphertext);
    expect(recovered).toBe(plaintext);
  });

  it('encrypts strings longer than 214 bytes correctly', async () => {
    const longString = 'a'.repeat(500);
    const ciphertext = await encrypt(longString);
    const recovered = await decrypt(ciphertext);
    expect(recovered).toBe(longString);
  });

  it('encrypt produces a different ciphertext each call (random IV)', async () => {
    const ct1 = await encrypt('same plaintext');
    const ct2 = await encrypt('same plaintext');
    expect(ct1).not.toBe(ct2);
  });

  it('decrypt throws when ciphertext is garbage', async () => {
    // This is not a valid AES-GCM blob so it should throw (not fall through to RSA
    // because the base64 will decode to bytes that are not a valid legacy RSA blob either)
    await expect(decrypt('bm90dmFsaWQ=')).rejects.toBeDefined();
  });

  it('reuses the same AES key across multiple calls', async () => {
    const ct = await encrypt('reuse check');
    // Second decrypt reloads from SecureStore
    const recovered = await decrypt(ct);
    expect(recovered).toBe('reuse check');
  });
});

describe('Security – wrapAESKey / unwrapAESKey', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  });

  it('wrapAESKey returns a non-empty base64 string', async () => {
    const wrapped = await wrapAESKey('my-passphrase');
    expect(typeof wrapped).toBe('string');
    expect(wrapped.length).toBeGreaterThan(0);
  });

  it('wrapAESKey produces a different output each call (random salt)', async () => {
    const w1 = await wrapAESKey('pass');
    const w2 = await wrapAESKey('pass');
    expect(w1).not.toBe(w2);
  });

  it('wrapAESKey / unwrapAESKey round-trip: encrypted data decryptable after restore', async () => {
    const plaintext = 'restore me';
    const ciphertext = await encrypt(plaintext);

    // Capture the wrapped key for the current AES key
    const wrapped = await wrapAESKey('correct-horse');

    // Simulate a "new device" by clearing the stored AES key
    delete store['agus_list_aes_key'];

    // Restore via unwrapAESKey
    await unwrapAESKey(wrapped, 'correct-horse');

    // Data encrypted with the original key should now be decryptable
    const recovered = await decrypt(ciphertext);
    expect(recovered).toBe(plaintext);
  });

  it('unwrapAESKey throws on wrong passphrase', async () => {
    const wrapped = await wrapAESKey('right-passphrase');
    await expect(unwrapAESKey(wrapped, 'wrong-passphrase')).rejects.toBeDefined();
  });
});
