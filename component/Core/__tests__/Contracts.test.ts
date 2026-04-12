import {
  UserSettingsContract,
  validateUserSettings,
  validateFirestoreItem,
  validateLocalItem,
  WrappedKeyContract,
  validateWrappedKey,
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

    it('accepts optional wrappedKey field', () => {
      expect(() =>
        validateUserSettings({ ...validUserSettings, wrappedKey: 'abc123==' })
      ).not.toThrow();
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

    it('rejects empty wrappedKey', () => {
      expect(() => validateUserSettings({ ...validUserSettings, wrappedKey: '' })).toThrow(
        ZodError
      );
    });
  });

  describe('FirestoreItemContract', () => {
    const validItem = {
      name: 'password',
      value: 'YmFzZTY0ZW5jb2RlZA==',
      timestamp: 1712438400000,
      userId: 'user-123',
      encrypted: true,
    };

    it('accepts valid firestore item', () => {
      expect(() => validateFirestoreItem(validItem)).not.toThrow();
    });

    it('accepts item with encrypted=false', () => {
      expect(() => validateFirestoreItem({ ...validItem, encrypted: false })).not.toThrow();
    });

    it('rejects item missing encrypted field', () => {
      const { encrypted: _encrypted, ...noEncrypted } = validItem;
      expect(() => validateFirestoreItem(noEncrypted)).toThrow(ZodError);
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
  });

  describe('WrappedKeyContract', () => {
    const validWrappedKey = {
      userId: 'user-123',
      wrappedKey: 'AAEC/w==', // valid base64
    };

    it('accepts valid wrapped key document', () => {
      expect(() => validateWrappedKey(validWrappedKey)).not.toThrow();
    });

    it('rejects missing userId', () => {
      const { userId: _userId, ...noUserId } = validWrappedKey;
      expect(() => validateWrappedKey(noUserId)).toThrow(ZodError);
    });

    it('rejects empty userId', () => {
      expect(() => validateWrappedKey({ ...validWrappedKey, userId: '' })).toThrow(ZodError);
    });

    it('rejects missing wrappedKey', () => {
      const { wrappedKey: _wk, ...noWk } = validWrappedKey;
      expect(() => validateWrappedKey(noWk)).toThrow(ZodError);
    });

    it('rejects empty wrappedKey', () => {
      expect(() => validateWrappedKey({ ...validWrappedKey, wrappedKey: '' })).toThrow(ZodError);
    });

    it('rejects extra fields (strict)', () => {
      expect(() => WrappedKeyContract.parse({ ...validWrappedKey, extra: 'nope' })).toThrow(
        ZodError
      );
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

    it('UserSettings with wrappedKey matches the contract', () => {
      const withKey = {
        userId: 'user-789',
        backup: 'DAILY',
        membership: 'FREE',
        wrappedKey: 'c29tZVdyYXBwZWRLZXk=',
      };
      expect(() => validateUserSettings(withKey)).not.toThrow();
    });

    it('Firestore item round-trip preserves contract', () => {
      // Simulate: local item → encode → store in Firestore → read back
      const localItem = {
        name: 'wifi-pass',
        value: 'my-secret-password',
        timestamp: Date.now(),
        userId: 'user-123',
        encrypted: true,
      };

      // What gets written to Firestore (base64 encoded value)
      const firestoreDoc = {
        ...localItem,
        value: Buffer.from(localItem.value).toString('base64'),
      };
      expect(() => validateFirestoreItem(firestoreDoc)).not.toThrow();

      // What gets read back (decoded)
      const readBack = {
        ...firestoreDoc,
        value: Buffer.from(firestoreDoc.value, 'base64').toString(),
      };
      expect(readBack.value).toBe(localItem.value);
      expect(() => validateLocalItem(readBack)).not.toThrow();
    });

    it('contract rejects data drift — missing required field from backend', () => {
      // If Firebase returns an item without a timestamp (schema drift)
      const driftedItem = {
        name: 'drifted',
        value: 'c29tZXRoaW5n',
        userId: 'user-123',
        encrypted: true,
        // timestamp missing — backend schema drifted
      };
      expect(() => validateFirestoreItem(driftedItem)).toThrow(ZodError);
    });

    it('contract rejects data drift — missing encrypted field from backend', () => {
      const noEncrypted = {
        name: 'item',
        value: 'c29tZXRoaW5n',
        userId: 'user-123',
        timestamp: 123456,
        // encrypted missing
      };
      expect(() => validateFirestoreItem(noEncrypted)).toThrow(ZodError);
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
});
