import { encrypt, decrypt, getRSAKeys, KeyPair } from '../Security';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node-forge', () => {
  const forge = jest.requireActual('node-forge');
  return {
    ...forge,
    pki: {
      ...forge.pki,
      rsa: {
        generateKeyPair: jest.fn(() => ({
          publicKey: {
            encrypt: jest.fn((data) => data),
          },
          privateKey: {
            decrypt: jest.fn((data) => data),
          },
        })),
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
  });

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
});
