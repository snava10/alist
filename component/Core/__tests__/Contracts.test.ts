import {
  UserSettingsContract,
  VaultItemDocumentContract,
  VaultProfileContract,
  validateKdfParams,
  validateUserSettings,
  validateFirestoreItem,
  validateLocalItem,
  validateVaultItemDocument,
  validateVaultItemPayload,
  validateVaultProfile,
} from '../Contracts';
import { ZodError } from 'zod';

describe('Firestore Contracts', () => {
  describe('UserSettingsContract', () => {
    const validUserSettings = {
      userId: 'user-123',
      backup: 'DAILY',
      membership: 'FREE',
    };

    it('accepts valid user settings', () => {
      expect(() => validateUserSettings(validUserSettings)).not.toThrow();
    });

    it('accepts all backup cadence values', () => {
      for (const backup of ['NONE', 'DAILY', 'INSTANT']) {
        expect(() => validateUserSettings({ ...validUserSettings, backup })).not.toThrow();
      }
    });

    it('accepts all membership types', () => {
      for (const membership of ['FREE', 'PREMIUM']) {
        expect(() => validateUserSettings({ ...validUserSettings, membership })).not.toThrow();
      }
    });

    it('rejects missing userId', () => {
      const { userId: _userId, ...noUserId } = validUserSettings;
      expect(() => validateUserSettings(noUserId)).toThrow(ZodError);
    });

    it('rejects empty userId', () => {
      expect(() => validateUserSettings({ ...validUserSettings, userId: '' })).toThrow(ZodError);
    });

    it('rejects invalid backup cadence', () => {
      expect(() => validateUserSettings({ ...validUserSettings, backup: 'WEEKLY' })).toThrow(
        ZodError
      );
    });

    it('rejects invalid membership type', () => {
      expect(() => validateUserSettings({ ...validUserSettings, membership: 'GOLD' })).toThrow(
        ZodError
      );
    });

    it('rejects missing backup field', () => {
      const { backup: _backup, ...noBackup } = validUserSettings;
      expect(() => validateUserSettings(noBackup)).toThrow(ZodError);
    });

    it('rejects missing membership field', () => {
      const { membership: _membership, ...noMembership } = validUserSettings;
      expect(() => validateUserSettings(noMembership)).toThrow(ZodError);
    });

    it('rejects extra fields (strict)', () => {
      expect(() =>
        UserSettingsContract.parse({ ...validUserSettings, extraField: 'nope' })
      ).toThrow(ZodError);
    });
  });

  describe('FirestoreItemContract', () => {
    const validItem = {
      name: 'password',
      value: 'YmFzZTY0ZW5jb2RlZA==',
      timestamp: 1712438400000,
      userId: 'user-123',
    };

    it('accepts valid firestore item', () => {
      expect(() => validateFirestoreItem(validItem)).not.toThrow();
    });

    it('accepts item with encrypted flag', () => {
      expect(() => validateFirestoreItem({ ...validItem, encrypted: true })).not.toThrow();
    });

    it('accepts item with search index', () => {
      expect(() =>
        validateFirestoreItem({ ...validItem, searchIndex: ['p', 'pa', 'pas', 'pass'] })
      ).not.toThrow();
    });

    it('rejects missing name', () => {
      const { name: _name, ...noName } = validItem;
      expect(() => validateFirestoreItem(noName)).toThrow(ZodError);
    });

    it('rejects empty name', () => {
      expect(() => validateFirestoreItem({ ...validItem, name: '' })).toThrow(ZodError);
    });

    it('rejects missing value', () => {
      const { value: _value, ...noValue } = validItem;
      expect(() => validateFirestoreItem(noValue)).toThrow(ZodError);
    });

    it('rejects missing timestamp', () => {
      const { timestamp: _timestamp, ...noTimestamp } = validItem;
      expect(() => validateFirestoreItem(noTimestamp)).toThrow(ZodError);
    });

    it('rejects string timestamp', () => {
      expect(() => validateFirestoreItem({ ...validItem, timestamp: '2024-01-01' })).toThrow(
        ZodError
      );
    });

    it('rejects missing userId', () => {
      const { userId: _userId, ...noUserId } = validItem;
      expect(() => validateFirestoreItem(noUserId)).toThrow(ZodError);
    });

    it('rejects empty userId', () => {
      expect(() => validateFirestoreItem({ ...validItem, userId: '' })).toThrow(ZodError);
    });

    it('rejects non-boolean encrypted', () => {
      expect(() => validateFirestoreItem({ ...validItem, encrypted: 'yes' })).toThrow(ZodError);
    });

    it('rejects non-array search index', () => {
      expect(() => validateFirestoreItem({ ...validItem, searchIndex: 'pass' })).toThrow(ZodError);
    });
  });

  describe('LocalItemContract', () => {
    const validLocalItem = {
      name: 'password',
      value: 'my-secret',
      timestamp: 1712438400000,
    };

    it('accepts valid local item (no userId)', () => {
      expect(() => validateLocalItem(validLocalItem)).not.toThrow();
    });

    it('accepts local item with userId', () => {
      expect(() => validateLocalItem({ ...validLocalItem, userId: 'user-123' })).not.toThrow();
    });

    it('rejects missing name', () => {
      const { name: _name, ...noName } = validLocalItem;
      expect(() => validateLocalItem(noName)).toThrow(ZodError);
    });

    it('rejects missing timestamp', () => {
      const { timestamp: _timestamp, ...noTimestamp } = validLocalItem;
      expect(() => validateLocalItem(noTimestamp)).toThrow(ZodError);
    });
  });

  describe('Contract consistency (frontend ↔ Firestore)', () => {
    it('UserSettings created by the app match the contract', () => {
      // Simulates what createUserSettings() builds
      const appCreated = {
        userId: 'new-user-456',
        backup: 'DAILY',
        membership: 'FREE',
      };
      expect(() => validateUserSettings(appCreated)).not.toThrow();
    });

    it('Firestore item round-trip preserves contract', () => {
      // Simulate: local item → encode → store in Firestore → read back
      const localItem = {
        name: 'wifi-pass',
        value: 'my-secret-password',
        timestamp: Date.now(),
        userId: 'user-123',
        encrypted: false,
      };

      // What gets written to Firestore (base64 encoded value)
      const firestoreDoc = {
        ...localItem,
        value: Buffer.from(localItem.value).toString('base64'),
        searchIndex: ['w', 'wi', 'wifi'],
      };
      expect(() => validateFirestoreItem(firestoreDoc)).not.toThrow();

      // What gets read back (decoded)
      const readBack = {
        ...firestoreDoc,
        value: Buffer.from(firestoreDoc.value, 'base64').toString(),
      };
      const { searchIndex: _searchIndex, ...localReadBack } = readBack;
      expect(readBack.value).toBe(localItem.value);
      expect(() => validateLocalItem(localReadBack)).not.toThrow();
    });

    it('contract rejects data drift — missing required field from backend', () => {
      // If Firebase returns an item without a timestamp (schema drift)
      const driftedItem = {
        name: 'drifted',
        value: 'c29tZXRoaW5n',
        userId: 'user-123',
        // timestamp missing — backend schema drifted
      };
      expect(() => validateFirestoreItem(driftedItem)).toThrow(ZodError);
    });

    it('contract rejects wrong enum from backend', () => {
      // If a Firestore rule or admin panel sets an invalid backup value
      const badSettings = {
        userId: 'user-789',
        backup: 'HOURLY', // not in the enum
        membership: 'FREE',
      };
      expect(() => validateUserSettings(badSettings)).toThrow(ZodError);
    });
  });

  describe('KdfParamsContract', () => {
    const validKdf = {
      kdf: 'pbkdf2-hmac-sha256',
      salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
      iterations: 600_000,
      dkLen: 32,
      version: 1,
    };

    it('accepts valid PBKDF2 parameters', () => {
      expect(() => validateKdfParams(validKdf)).not.toThrow();
    });

    it('rejects an unknown KDF (argon2id is not defined until the Step 3 spike)', () => {
      expect(() => validateKdfParams({ ...validKdf, kdf: 'argon2id' })).toThrow(ZodError);
    });

    it('rejects an unknown KDF version', () => {
      expect(() => validateKdfParams({ ...validKdf, version: 2 })).toThrow(ZodError);
    });

    it('rejects a missing salt', () => {
      const { salt: _salt, ...noSalt } = validKdf;
      expect(() => validateKdfParams(noSalt)).toThrow(ZodError);
    });

    it('rejects a non-base64 or empty salt', () => {
      expect(() => validateKdfParams({ ...validKdf, salt: '!!!' })).toThrow(ZodError);
      expect(() => validateKdfParams({ ...validKdf, salt: '' })).toThrow(ZodError);
    });

    it('rejects non-positive or non-integer iteration counts', () => {
      expect(() => validateKdfParams({ ...validKdf, iterations: 0 })).toThrow(ZodError);
      expect(() => validateKdfParams({ ...validKdf, iterations: -1 })).toThrow(ZodError);
      expect(() => validateKdfParams({ ...validKdf, iterations: 1.5 })).toThrow(ZodError);
    });

    it('rejects a non-positive derived key length', () => {
      expect(() => validateKdfParams({ ...validKdf, dkLen: 0 })).toThrow(ZodError);
    });

    it('rejects extra fields (strict)', () => {
      expect(() => validateKdfParams({ ...validKdf, memoryKiB: 65536 })).toThrow(ZodError);
    });
  });

  describe('VaultProfileContract', () => {
    const validProfile = {
      userId: 'user-123',
      schemaVersion: 1,
      kdf: {
        kdf: 'pbkdf2-hmac-sha256',
        salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
        iterations: 600_000,
        dkLen: 32,
        version: 1,
      },
      verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      biometricEnabled: false,
    };

    it('accepts a minimal profile without wrapped or biometric fields', () => {
      expect(() => validateVaultProfile(validProfile)).not.toThrow();
    });

    it('accepts a profile with a wrapped vault key pair', () => {
      expect(() =>
        validateVaultProfile({
          ...validProfile,
          wrappedVaultKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          wrappedVaultKeyNonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
      ).not.toThrow();
    });

    it('accepts a profile with biometric fields when biometric unlock is enabled', () => {
      expect(() =>
        validateVaultProfile({
          ...validProfile,
          biometricEnabled: true,
          biometricWrappedKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          biometricWrapNonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
      ).not.toThrow();
    });

    it('rejects a missing verifier', () => {
      const { verifier: _verifier, ...noVerifier } = validProfile;
      expect(() => validateVaultProfile(noVerifier)).toThrow(ZodError);
    });

    it('rejects a non-base64 verifier', () => {
      expect(() => validateVaultProfile({ ...validProfile, verifier: 'not base64!' })).toThrow(
        ZodError
      );
    });

    it('rejects biometric unlock claimed without wrapped key fields', () => {
      expect(() => validateVaultProfile({ ...validProfile, biometricEnabled: true })).toThrow(
        ZodError
      );
    });

    it('rejects biometric unlock with only one wrapped key field', () => {
      expect(() =>
        validateVaultProfile({
          ...validProfile,
          biometricEnabled: true,
          biometricWrappedKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        })
      ).toThrow(ZodError);
    });

    it('rejects a wrapped vault key without its nonce, and vice versa', () => {
      expect(() =>
        validateVaultProfile({
          ...validProfile,
          wrappedVaultKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        })
      ).toThrow(ZodError);
      expect(() =>
        validateVaultProfile({
          ...validProfile,
          wrappedVaultKeyNonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
      ).toThrow(ZodError);
    });

    it('rejects an unknown profile schema version', () => {
      expect(() => validateVaultProfile({ ...validProfile, schemaVersion: 2 })).toThrow(ZodError);
    });

    it('rejects extra fields (strict)', () => {
      expect(() => VaultProfileContract.parse({ ...validProfile, recoveryKey: 'nope' })).toThrow(
        ZodError
      );
    });

    it('rejects a legacy-shaped profile document', () => {
      expect(() =>
        validateVaultProfile({ userId: 'user-123', backup: 'DAILY', membership: 'FREE' })
      ).toThrow(ZodError);
    });
  });

  describe('VaultItemDocumentContract', () => {
    const validDocument = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      userId: 'user-123',
      ciphertext: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      nonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      wrappedItemKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      wrappedKeyNonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      algorithm: 'xchacha20-poly1305',
      schemaVersion: 2,
      version: 1,
      createdAt: 1712438400000,
      updatedAt: 1712438400000,
    };

    it('accepts a valid vault document', () => {
      expect(() => validateVaultItemDocument(validDocument)).not.toThrow();
    });

    it('accepts a vault document with migratedFrom', () => {
      expect(() =>
        validateVaultItemDocument({ ...validDocument, migratedFrom: 'u1_secret' })
      ).not.toThrow();
    });

    it('rejects a document missing algorithm', () => {
      const { algorithm: _algorithm, ...noAlgorithm } = validDocument;
      expect(() => validateVaultItemDocument(noAlgorithm)).toThrow(ZodError);
    });

    it('rejects a document missing schemaVersion', () => {
      const { schemaVersion: _schemaVersion, ...noVersion } = validDocument;
      expect(() => validateVaultItemDocument(noVersion)).toThrow(ZodError);
    });

    it('rejects an unknown schema version, past or future', () => {
      expect(() => validateVaultItemDocument({ ...validDocument, schemaVersion: 1 })).toThrow(
        ZodError
      );
      expect(() => validateVaultItemDocument({ ...validDocument, schemaVersion: 3 })).toThrow(
        ZodError
      );
    });

    it('rejects a different algorithm', () => {
      expect(() =>
        validateVaultItemDocument({ ...validDocument, algorithm: 'aes-256-gcm' })
      ).toThrow(ZodError);
      expect(() => validateVaultItemDocument({ ...validDocument, algorithm: 'rsa-oaep' })).toThrow(
        ZodError
      );
    });

    it('rejects a non-UUID document id', () => {
      expect(() => validateVaultItemDocument({ ...validDocument, id: 'u1_secret' })).toThrow(
        ZodError
      );
    });

    it('rejects non-base64 or empty ciphertext', () => {
      expect(() => validateVaultItemDocument({ ...validDocument, ciphertext: '!!!' })).toThrow(
        ZodError
      );
      expect(() => validateVaultItemDocument({ ...validDocument, ciphertext: '' })).toThrow(
        ZodError
      );
    });

    it('rejects version zero or a non-integer version', () => {
      expect(() => validateVaultItemDocument({ ...validDocument, version: 0 })).toThrow(ZodError);
      expect(() => validateVaultItemDocument({ ...validDocument, version: 1.5 })).toThrow(ZodError);
    });

    it('rejects negative timestamps', () => {
      expect(() => validateVaultItemDocument({ ...validDocument, createdAt: -1 })).toThrow(
        ZodError
      );
    });

    it('rejects extra fields (strict), including plaintext name/value and searchIndex', () => {
      expect(() => VaultItemDocumentContract.parse({ ...validDocument, name: 'password' })).toThrow(
        ZodError
      );
      expect(() => VaultItemDocumentContract.parse({ ...validDocument, value: 'visible' })).toThrow(
        ZodError
      );
      expect(() =>
        VaultItemDocumentContract.parse({ ...validDocument, searchIndex: ['p'] })
      ).toThrow(ZodError);
    });

    it('rejects a legacy-shaped document', () => {
      expect(() =>
        validateVaultItemDocument({
          name: 'password',
          value: 'YmFzZTY0ZW5jb2RlZA==',
          timestamp: 1712438400000,
          userId: 'user-123',
          encrypted: true,
        })
      ).toThrow(ZodError);
    });
  });

  describe('VaultItemPayloadContract', () => {
    it('accepts a decrypted name/value payload, including an empty value', () => {
      expect(validateVaultItemPayload({ name: 'password', value: '' })).toEqual({
        name: 'password',
        value: '',
      });
    });

    it('rejects an empty name and a non-string value', () => {
      expect(() => validateVaultItemPayload({ name: '', value: 'x' })).toThrow(ZodError);
      expect(() => validateVaultItemPayload({ name: 'password', value: 42 })).toThrow(ZodError);
    });

    it('rejects extra fields (strict)', () => {
      expect(() =>
        validateVaultItemPayload({ name: 'password', value: 'x', userId: 'user-123' })
      ).toThrow(ZodError);
    });
  });
});
