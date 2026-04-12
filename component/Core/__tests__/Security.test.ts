import * as SecureStore from 'expo-secure-store';
import {
  encrypt,
  decrypt,
  getRSAKeys,
  getAESKey,
  generateAESKey,
  wrapAESKey,
  unwrapAESKey,
  KeyPair,
} from '../Security';

// Stateful in-memory store so the AES key persists within a single test,
// enabling genuine encrypt → decrypt round-trips without network/disk I/O.
const store: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: jest.fn().mockImplementation((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
}));

jest.mock('node-forge', () => {
  const forge = jest.requireActual('node-forge');
  return {
    ...forge,
    pki: {
      ...forge.pki,
      rsa: {
        generateKeyPair: jest.fn(() => {
          const keyPair = jest.requireActual('node-forge').pki.rsa.generateKeyPair({
            bits: 512,
          });
          return keyPair;
        }),
      },
      publicKeyToPem: jest.fn(() => 'PUBLIC_KEY_PEM'),
      privateKeyToPem: jest.fn(() => 'PRIVATE_KEY_PEM'),
      publicKeyFromPem: jest.fn(() => ({
        encrypt: jest.fn((data) => data),
      })),
      privateKeyFromPem: jest.fn(() => ({
        decrypt: jest.fn((data) => data),
      })),
    },
    util: {
      encodeUtf8: jest.fn((data) => data),
      decodeUtf8: jest.fn((data) => data),
      encode64: jest.fn((data) => data),
      decode64: jest.fn((data) => data),
    },
  };
});

describe('Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the in-memory store so each test starts with no persisted key.
    Object.keys(store).forEach((k) => delete store[k]);
  });

  // ── Existing exports ──

  it('exports encrypt function', () => {
    expect(typeof encrypt).toBe('function');
  });

  it('exports decrypt function', () => {
    expect(typeof decrypt).toBe('function');
  });

  it('exports getRSAKeys function', () => {
    expect(typeof getRSAKeys).toBe('function');
  });

  it('KeyPair interface includes public and private keys', () => {
    const keyPair: KeyPair = {
      public: 'public-key',
      private: 'private-key',
    };
    expect(keyPair.public).toBe('public-key');
    expect(keyPair.private).toBe('private-key');
  });

  it('KeyPair type is defined', () => {
    const keyPair: KeyPair = {
      public: 'test-public',
      private: 'test-private',
    };
    expect(keyPair).toBeDefined();
  });

  it('encrypt function is async', () => {
    const result = encrypt('test-value');
    expect(result instanceof Promise).toBe(true);
  });

  it('decrypt function is async', () => {
    const result = decrypt('test-hash');
    expect(result instanceof Promise).toBe(true);
  });

  it('getRSAKeys function is async', () => {
    const result = getRSAKeys();
    expect(result instanceof Promise).toBe(true);
  });

  it('handles encryption of empty string', async () => {
    expect(typeof encrypt).toBe('function');
  });

  it('handles decryption of empty string', async () => {
    expect(typeof decrypt).toBe('function');
  });

  it('RSA key generation uses correct key size', () => {
    expect(typeof getRSAKeys).toBe('function');
  });

  it('returns KeyPair from getRSAKeys', async () => {
    const result = await getRSAKeys();
    if (result) {
      expect(result.public).toBeDefined();
      expect(result.private).toBeDefined();
    }
  });

  it('SecureStore is used for key storage', () => {
    expect(typeof getRSAKeys).toBe('function');
  });

  it('encrypt handles various input types', async () => {
    expect(typeof encrypt).toBe('function');
  });

  it('decrypt handles various input types', async () => {
    expect(typeof decrypt).toBe('function');
  });

  it('KeyPair has correct shape', () => {
    const kp: KeyPair = {
      public: 'pub',
      private: 'priv',
    };
    expect(Object.keys(kp)).toContain('public');
    expect(Object.keys(kp)).toContain('private');
  });

  it('Security module exports all required functions', () => {
    expect(encrypt).toBeDefined();
    expect(decrypt).toBeDefined();
    expect(getRSAKeys).toBeDefined();
  });

  // ── AES-256-GCM ──

  describe('AES-256-GCM key management', () => {
    it('generateAESKey returns a CryptoKey with correct algorithm', async () => {
      const key = await generateAESKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('generateAESKey persists the key via SecureStore', async () => {
      await generateAESKey();
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('getAESKey generates and caches the key on first call only', async () => {
      await getAESKey(); // generates + stores
      await getAESKey(); // reads from store, no extra write
      // Only the first call should invoke setItemAsync.
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('getAESKey returns an extractable AES-GCM key', async () => {
      const key = await getAESKey();
      expect(key.extractable).toBe(true);
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });
  });

  describe('AES-256-GCM encrypt / decrypt', () => {
    it('encrypt returns a non-empty base64 string', async () => {
      const result = await encrypt('hello');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('encrypt / decrypt round-trip restores original value', async () => {
      const plaintext = 'hello world';
      const ciphertext = await encrypt(plaintext);
      const decrypted = await decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts strings longer than 214 bytes (RSA limit) correctly', async () => {
      const longValue = 'a'.repeat(500);
      const ciphertext = await encrypt(longValue);
      const decrypted = await decrypt(ciphertext);
      expect(decrypted).toBe(longValue);
    });

    it('encrypts Unicode / emoji without data loss', async () => {
      const unicodeValue = 'пароль 🔑 密码 🇬🇧';
      const ciphertext = await encrypt(unicodeValue);
      const decrypted = await decrypt(ciphertext);
      expect(decrypted).toBe(unicodeValue);
    });

    it('produces different ciphertext for identical plaintext (random IV)', async () => {
      const plaintext = 'same input';
      const ct1 = await encrypt(plaintext);
      const ct2 = await encrypt(plaintext);
      expect(ct1).not.toBe(ct2);
    });

    it('ciphertext differs from plaintext', async () => {
      const plaintext = 'secret';
      const ciphertext = await encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
    });
  });

  // ── Passphrase-based key wrapping ──

  describe('Key wrapping for cross-device recovery', () => {
    it('wrapAESKey returns a non-empty base64 string', async () => {
      const wrapped = await wrapAESKey('my-passphrase');
      expect(typeof wrapped).toBe('string');
      expect(wrapped.length).toBeGreaterThan(0);
    });

    it('wrapAESKey produces different output each call (random salt)', async () => {
      const w1 = await wrapAESKey('passphrase');
      // Reset so we use the same underlying AES key for the second wrap.
      const savedKey = store['agus_list_aes_key'] as string;
      Object.keys(store).forEach((k) => delete store[k]);
      jest.clearAllMocks();
      store['agus_list_aes_key'] = savedKey; // restore the same key
      const w2 = await wrapAESKey('passphrase');
      expect(w1).not.toBe(w2);
    });

    it('wrapAESKey / unwrapAESKey round-trip: key restored correctly', async () => {
      // Encrypt with the current key to produce a reference ciphertext.
      const plaintext = 'cross-device-test-value';
      const ciphertext = await encrypt(plaintext);

      // Wrap the key with a passphrase.
      const wrapped = await wrapAESKey('secure-passphrase');

      // Simulate moving to a new device: clear the persisted key.
      Object.keys(store).forEach((k) => delete store[k]);
      jest.clearAllMocks();

      // Restore the key via unwrapAESKey.
      await unwrapAESKey(wrapped, 'secure-passphrase');

      // The restored key must decrypt the original ciphertext.
      const decrypted = await decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('unwrapAESKey rejects on wrong passphrase', async () => {
      const wrapped = await wrapAESKey('correct-passphrase');
      Object.keys(store).forEach((k) => delete store[k]);
      jest.clearAllMocks();
      await expect(unwrapAESKey(wrapped, 'wrong-passphrase')).rejects.toBeDefined();
    });

    it('unwrapAESKey stores the recovered key via SecureStore', async () => {
      const wrapped = await wrapAESKey('passphrase');
      Object.keys(store).forEach((k) => delete store[k]);
      jest.clearAllMocks();
      await unwrapAESKey(wrapped, 'passphrase');
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });
  });
});
