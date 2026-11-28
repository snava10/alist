import {
  addSearchIndexToItems,
  addTimestampToItems,
  backupLocalStorageToFirestore,
  clearLocalAsyncStorage,
  createUserSettings,
  deleteItems,
  deleteVaultItems,
  filterVaultItems,
  getAllItems,
  getItem,
  getItems,
  getUserSettings,
  getVaultItemDocument,
  getVaultItems,
  getVaultProfile,
  listVaultItemDocuments,
  removeVaultItem,
  restoreFromFirestore,
  saveVaultItem,
  saveVaultProfile,
  VaultLockedError,
  removeItem,
  replaceItem,
  resetFirestoreClientForTesting,
  saveItem,
  setFirestoreClientForTesting,
  subscribeToItems,
} from '../Storage';
import {
  BackupCadence,
  MembershipType,
  type AListItem,
  type VaultItemDocument,
  type VaultProfile,
} from '../DataModel';
import { encrypt, generateAndStoreKeys } from '../Security';
import { encryptVaultItem, newItemId, randomBytes, VAULT_KEY_LENGTH } from '../VaultCrypto';
import { ZodError } from 'zod';
import * as forge from 'node-forge';
import { MockFirestore } from '../MockFirestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Storage', () => {
  let mockFirestore: MockFirestore;

  beforeAll(async () => {
    await generateAndStoreKeys(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = new MockFirestore();
    setFirestoreClientForTesting(mockFirestore);
  });

  afterAll(() => {
    resetFirestoreClientForTesting();
  });

  async function seedItems(items: AListItem[]) {
    // const collection = mockFirestore.collection('Items');
    await Promise.all(items.map(async (item) => await saveItem(item)));
  }

  async function encryptWithOtherKey(value: string): Promise<string> {
    const otherKeyPair = forge.pki.rsa.generateKeyPair({ bits: 512 });
    const publicKey = forge.pki.publicKeyFromPem(forge.pki.publicKeyToPem(otherKeyPair.publicKey));
    return forge.util.encode64(publicKey.encrypt(forge.util.encodeUtf8(value), 'RSA-OAEP'));
  }

  async function seedRawItem(item: {
    name: string;
    value: string;
    timestamp: number;
    userId: string;
    encrypted?: boolean;
    searchIndex?: string[];
  }) {
    await mockFirestore.collection('Items').doc(`${item.userId}_${item.name}`).set(item);
  }

  it('getItem decrypts encrypted items', async () => {
    await seedItems([
      { name: 'secret', value: 'decrypted-value', timestamp: 1, encrypted: false, userId: 'u1' },
    ]);

    const result = await getItem('secret', 'u1');

    expect(result).toEqual({
      name: 'secret',
      value: 'decrypted-value',
      timestamp: 1,
      encrypted: true,
      userId: 'u1',
    });
  });

  it('returns null when an item does not exist', async () => {
    await expect(getItem('missing', 'u1')).resolves.toBeNull();
  });

  it('getItem returns null for an item encrypted under a different key', async () => {
    const unreadableValue = await encryptWithOtherKey('other-secret');
    await seedRawItem({
      name: 'unreadable',
      value: unreadableValue,
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
    });

    await expect(getItem('unreadable', 'u1')).resolves.toBeNull();
  });

  it('getAllItems skips items encrypted under a different key instead of throwing', async () => {
    const unreadableValue = await encryptWithOtherKey('other-secret');
    await seedRawItem({
      name: 'unreadable',
      value: unreadableValue,
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
    });
    await seedItems([
      { name: 'readable', value: 'readable-value', timestamp: 2, encrypted: false, userId: 'u1' },
    ]);

    const items = await getAllItems('u1');

    expect(items).toEqual([
      {
        name: 'readable',
        value: 'readable-value',
        timestamp: 2,
        encrypted: true,
        userId: 'u1',
      },
    ]);
  });

  it('getItems with a filter skips items encrypted under a different key', async () => {
    const unreadableValue = await encryptWithOtherKey('other-secret');
    await seedRawItem({
      name: 'unreadable',
      value: unreadableValue,
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
      searchIndex: ['unread'],
    });

    const items = await getItems('u1', 'unread');

    expect(items).toHaveLength(0);
  });

  it('retrieves all items for a user', async () => {
    await seedItems([
      { name: 'item1', value: 'one', timestamp: 1, encrypted: false, userId: 'u1' },
      { name: 'item2', value: 'two', timestamp: 2, encrypted: false, userId: 'u1' },
      { name: 'item3', value: 'three', timestamp: 3, encrypted: false, userId: 'u2' },
    ]);

    const items = await getAllItems('u1');

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.name).sort()).toEqual(['item1', 'item2']);
  });

  it('adds timestamps to items that are missing one', async () => {
    const originalNow = Date.now;
    Date.now = jest.fn(() => 123456789);
    try {
      await seedItems([
        { name: 'stamped', value: 'value', timestamp: 0, encrypted: false, userId: 'u1' },
      ]);

      const result = await addTimestampToItems('u1');
      const updated = await getItem('stamped', 'u1');

      expect(result).toHaveLength(1);
      expect(updated?.timestamp).toBe(123456789);
    } finally {
      Date.now = originalNow;
    }
  });

  it('addTimestampToItems does not fail and leaves undecryptable items untouched', async () => {
    const originalNow = Date.now;
    Date.now = jest.fn(() => 123456789);
    try {
      const unreadableValue = await encryptWithOtherKey('other-secret');
      await seedRawItem({
        name: 'unreadable',
        value: unreadableValue,
        timestamp: 0,
        userId: 'u1',
        encrypted: true,
      });
      await seedItems([
        { name: 'stamped', value: 'value', timestamp: 0, encrypted: false, userId: 'u1' },
      ]);

      const result = await addTimestampToItems('u1');

      expect(result).toHaveLength(1);
      const updated = await getItem('stamped', 'u1');
      expect(updated?.timestamp).toBe(123456789);
      const untouched = await mockFirestore.collection('Items').doc('u1_unreadable').get();
      expect(untouched.exists).toBe(true);
      expect(untouched.data()?.value).toBe(unreadableValue);
    } finally {
      Date.now = originalNow;
    }
  });

  it('saveItem encrypts and stores using the user and item name as the doc id', async () => {
    await saveItem({
      name: 'myItem',
      value: 'secret',
      timestamp: 1,
      encrypted: false,
      userId: 'u1',
    });

    const storedDoc = await mockFirestore.collection('Items').doc('u1_myItem').get();
    const stored = storedDoc.data();

    expect(storedDoc.exists).toBe(true);
    expect(stored?.encrypted).toBe(true);
    expect(stored?.value).not.toBe('secret');
    expect(stored?.searchIndex).toContain('myitem');
  });

  it('adds search indexes to items that are missing them', async () => {
    const encryptedValue = await encrypt('secret');
    await mockFirestore.collection('Items').doc('u1_secret').set({
      name: 'secret',
      value: encryptedValue,
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
    });

    const result = await addSearchIndexToItems('u1');
    const updated = await mockFirestore.collection('Items').doc('u1_secret').get();

    expect(result).toHaveLength(1);
    expect(updated.data()?.searchIndex).toContain('sec');
  });

  it('replaceItem removes the old firestore doc and saves the new one', async () => {
    await seedItems([
      { name: 'old', value: 'old-value', timestamp: 1, encrypted: false, userId: 'u1' },
    ]);

    await replaceItem(
      { name: 'old', value: 'old-value', timestamp: 1, encrypted: true, userId: 'u1' },
      { name: 'new', value: 'new-value', timestamp: 5, encrypted: false, userId: 'u1' },
      false
    );

    await expect(getItem('old', 'u1')).resolves.toBeNull();
    await expect(getItem('new', 'u1')).resolves.toMatchObject({
      name: 'new',
      value: 'new-value',
      timestamp: 5,
      userId: 'u1',
    });
  });

  it('removeItem deletes from async storage and firestore', async () => {
    await seedItems([
      { name: 'gone', value: 'value', timestamp: 1, encrypted: false, userId: 'u1' },
    ]);

    await removeItem({ name: 'gone', value: 'value', timestamp: 1, encrypted: true, userId: 'u1' });

    await expect(getItem('gone', 'u1')).resolves.toBeNull();
  });

  it('creates default user settings when none exist', async () => {
    const settings = await createUserSettings('user123');

    expect(settings).toEqual({
      userId: 'user123',
      backup: BackupCadence.DAILY,
      membership: MembershipType.FREE,
    });

    await expect(getUserSettings('user123')).resolves.toEqual(settings);
  });

  it('returns existing user settings without overwriting them', async () => {
    await mockFirestore.collection('UserSettings').doc('user123').set({
      userId: 'user123',
      backup: BackupCadence.NONE,
      membership: MembershipType.PREMIUM,
    });

    await expect(createUserSettings('user123')).resolves.toEqual({
      userId: 'user123',
      backup: BackupCadence.NONE,
      membership: MembershipType.PREMIUM,
    });
  });

  it('deleteItems removes all items for a user and returns the count', async () => {
    await seedItems([
      { name: 'a', value: 'one', timestamp: 1, encrypted: false, userId: 'u1' },
      { name: 'b', value: 'two', timestamp: 2, encrypted: false, userId: 'u1' },
      { name: 'c', value: 'three', timestamp: 3, encrypted: false, userId: 'u2' },
    ]);

    const count = await deleteItems('u1');

    expect(count).toBe(2);
    await expect(getAllItems('u1')).resolves.toHaveLength(0);
    await expect(getAllItems('u2')).resolves.toHaveLength(1);
  });

  it('backupLocalStorageToFirestore decrypts encrypted local items and saves plain ones to firestore', async () => {
    const encryptedValue = await encrypt('secret');
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      '_ali_secret',
      '_ali_plain',
      'not_an_ali_key',
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      [
        '_ali_secret',
        JSON.stringify({
          name: 'secret',
          value: encryptedValue,
          timestamp: 1,
          encrypted: true,
          userId: 'u1',
        } satisfies AListItem),
      ],
      [
        '_ali_plain',
        JSON.stringify({
          name: 'plain',
          value: 'visible',
          timestamp: 2,
          encrypted: false,
          userId: 'u1',
        } satisfies AListItem),
      ],
    ]);

    const items = await backupLocalStorageToFirestore();
    const storedPlain = await mockFirestore.collection('Items').doc('u1_plain').get();

    expect(items).toEqual([
      {
        name: 'secret',
        value: 'secret',
        timestamp: 1,
        encrypted: true,
        userId: 'u1',
      },
      {
        name: 'plain',
        value: 'visible',
        timestamp: 2,
        encrypted: false,
        userId: 'u1',
      },
    ]);
    expect(AsyncStorage.multiGet).toHaveBeenCalledWith(['_ali_secret', '_ali_plain']);
    expect(storedPlain.exists).toBe(true);
    expect(storedPlain.data()?.encrypted).toBe(true);
  });

  it('backupLocalStorageToFirestore skips local items encrypted under a different key', async () => {
    const unreadableValue = await encryptWithOtherKey('other-secret');
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['_ali_foreign', '_ali_plain']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      [
        '_ali_foreign',
        JSON.stringify({
          name: 'foreign',
          value: unreadableValue,
          timestamp: 1,
          encrypted: true,
          userId: 'u1',
        } satisfies AListItem),
      ],
      [
        '_ali_plain',
        JSON.stringify({
          name: 'plain',
          value: 'visible',
          timestamp: 2,
          encrypted: false,
          userId: 'u1',
        } satisfies AListItem),
      ],
    ]);

    const items = await backupLocalStorageToFirestore();

    expect(items).toEqual([
      {
        name: 'plain',
        value: 'visible',
        timestamp: 2,
        encrypted: false,
        userId: 'u1',
      },
    ]);
    const foreignDoc = await mockFirestore.collection('Items').doc('u1_foreign').get();
    expect(foreignDoc.exists).toBe(false);
  });

  it('clear local async storage', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      '_ali_secret',
      '_ali_plain',
      'not_an_ali_key',
    ]);

    let multiRemoveMock = AsyncStorage.multiRemove as jest.Mock;

    await clearLocalAsyncStorage();
    expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    expect(multiRemoveMock).toHaveBeenLastCalledWith(['_ali_secret', '_ali_plain']);
  });

  describe('Searching', () => {
    beforeEach(async () => {
      await seedItems([
        {
          name: 'National Insurance Number',
          value: 'SA123456',
          timestamp: 1,
          encrypted: true,
          userId: 'u1',
        },
        {
          name: 'Passport',
          value: 'PAL123465',
          timestamp: 1,
          encrypted: true,
          userId: 'u1',
        },
      ]);
    });

    it('Search multiple word item', async () => {
      const items = await getItems('u1', 'nation');
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('National Insurance Number');
    });

    it('Seach single word item', async () => {
      const items = await getItems('u1', 'pass');
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Passport');
    });
  });

  describe('subscribeToItems', () => {
    const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('delivers the initial items and updates after a save and a delete', async () => {
      await seedItems([{ name: 'one', value: '1', timestamp: 1, encrypted: false, userId: 'u1' }]);
      const seen: string[][] = [];
      const unsubscribe = subscribeToItems('u1', null, (items) => {
        seen.push(items.map((item) => item.name));
      });
      await flush();
      expect(seen).toEqual([['one']]);

      await saveItem({ name: 'two', value: '2', timestamp: 2, userId: 'u1' });
      await flush();
      expect(seen).toEqual([['one'], ['one', 'two']]);

      await removeItem({ name: 'one', value: '1', timestamp: 1, userId: 'u1' });
      await flush();
      expect(seen).toEqual([['one'], ['one', 'two'], ['two']]);

      unsubscribe();
      await saveItem({ name: 'three', value: '3', timestamp: 3, userId: 'u1' });
      expect(seen).toHaveLength(3);
    });

    it('only delivers items for the subscribed user and filter', async () => {
      await seedItems([
        { name: 'National Insurance Number', value: 'SA1', timestamp: 1, userId: 'u1' },
        { name: 'Passport', value: 'PAL1', timestamp: 1, userId: 'u1' },
        { name: 'other-user', value: 'x', timestamp: 1, userId: 'u2' },
      ]);
      const seen: string[][] = [];
      const unsubscribe = subscribeToItems('u1', 'pass', (items) => {
        seen.push(items.map((item) => item.name));
      });
      await flush();
      expect(seen).toEqual([['Passport']]);
      unsubscribe();
    });
  });

  describe('getAllItems fault isolation', () => {
    it('skips a malformed document and returns the readable items', async () => {
      await seedItems([{ name: 'good', value: '1', timestamp: 1, encrypted: false, userId: 'u1' }]);
      await seedRawItem({
        name: 'bad',
        // Missing timestamp: fails contract validation on read.
        value: 'YmFzZTY0',
        timestamp: undefined as unknown as number,
        userId: 'u1',
      });
      const items = await getAllItems('u1');
      expect(items.map((item) => item.name)).toEqual(['good']);
    });
  });

  describe('Vault profiles', () => {
    function validProfile(overrides: Partial<VaultProfile> = {}): VaultProfile {
      return {
        userId: 'u1',
        schemaVersion: 1,
        kdf: {
          kdf: 'pbkdf2-hmac-sha256',
          salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
          iterations: 100,
          dkLen: 32,
          version: 1,
        },
        verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        biometricEnabled: false,
        ...overrides,
      };
    }

    it('saves and reads back a vault profile', async () => {
      const profile = validProfile({
        wrappedVaultKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        wrappedVaultKeyNonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      await saveVaultProfile(profile);
      await expect(getVaultProfile('u1')).resolves.toEqual(profile);
    });

    it('returns null for a missing profile or an empty user id', async () => {
      await expect(getVaultProfile('missing')).resolves.toBeNull();
      await expect(getVaultProfile('')).resolves.toBeNull();
    });

    it('rejects saving a malformed profile and writes nothing', async () => {
      const bad = {
        ...validProfile(),
        schemaVersion: 2,
      } as unknown as VaultProfile;
      await expect(saveVaultProfile(bad)).rejects.toThrow(ZodError);
      const stored = await mockFirestore.collection('VaultProfiles').doc('u1').get();
      expect(stored.exists).toBe(false);
    });

    it('rejects saving a profile with an extra field', async () => {
      const bad = {
        ...validProfile(),
        recoveryKey: 'nope',
      } as unknown as VaultProfile;
      await expect(saveVaultProfile(bad)).rejects.toThrow(ZodError);
    });

    it('throws when reading a malformed stored profile', async () => {
      await mockFirestore
        .collection('VaultProfiles')
        .doc('u1')
        .set({ userId: 'u1', schemaVersion: 99 });
      await expect(getVaultProfile('u1')).rejects.toThrow(ZodError);
    });
  });

  describe('Vault items', () => {
    const vaultKey = randomBytes(VAULT_KEY_LENGTH);

    async function seedVaultDocument(document: VaultItemDocument): Promise<void> {
      await mockFirestore.collection('VaultItems').doc(document.id).set(document);
    }

    async function seedForeignEncrypted(
      name: string,
      value: string,
      userId: string
    ): Promise<string> {
      const otherKey = randomBytes(VAULT_KEY_LENGTH);
      const id = newItemId();
      const encrypted = encryptVaultItem(otherKey, id, 1, name, value);
      await seedVaultDocument({
        id,
        userId,
        ...encrypted,
        algorithm: 'xchacha20-poly1305',
        schemaVersion: 2,
        version: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      return id;
    }

    it('saves an item encrypted and reads it back decrypted', async () => {
      const saved = await saveVaultItem(
        'u1',
        { name: 'secret', value: 'decrypted-value' },
        vaultKey
      );
      expect(saved.version).toBe(1);
      expect(saved.name).toBe('secret');
      expect(saved.value).toBe('decrypted-value');
      expect(saved.timestamp).toBe(saved.updatedAt);

      const stored = await getVaultItemDocument('u1', saved.id);
      expect(stored).not.toBeNull();
      expect(stored?.ciphertext).not.toContain('decrypted-value');
      expect(stored?.userId).toBe('u1');
      expect(stored?.algorithm).toBe('xchacha20-poly1305');
      expect(stored?.schemaVersion).toBe(2);

      const { items, quarantined } = await getVaultItems('u1', vaultKey);
      expect(items).toEqual([saved]);
      expect(quarantined).toEqual([]);
    });

    it('increments the version and preserves creation time on edit', async () => {
      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000);
      try {
        const created = await saveVaultItem('u1', { name: 'secret', value: 'one' }, vaultKey);
        const edited = await saveVaultItem(
          'u1',
          { id: created.id, name: 'secret', value: 'two' },
          vaultKey
        );
        expect(edited.id).toBe(created.id);
        expect(edited.version).toBe(2);
        expect(edited.value).toBe('two');
        const stored = await getVaultItemDocument('u1', created.id);
        expect(stored?.createdAt).toBe(1000);
        expect(stored?.updatedAt).toBe(2000);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('preserves a caller-supplied timestamp for a brand-new item', async () => {
      const saved = await saveVaultItem(
        'u1',
        { name: 'old', value: 'v', timestamp: 500 },
        vaultKey
      );
      expect(saved.timestamp).toBe(500);
      const stored = await getVaultItemDocument('u1', saved.id);
      expect(stored?.createdAt).toBe(500);
      expect(stored?.updatedAt).toBe(500);
    });

    it('stores migratedFrom and preserves it on edit', async () => {
      const saved = await saveVaultItem(
        'u1',
        { name: 'migrated', value: 'v', migratedFrom: 'u1_old' },
        vaultKey
      );
      expect((await getVaultItemDocument('u1', saved.id))?.migratedFrom).toBe('u1_old');
      await saveVaultItem('u1', { id: saved.id, name: 'migrated', value: 'v2' }, vaultKey);
      expect((await getVaultItemDocument('u1', saved.id))?.migratedFrom).toBe('u1_old');
    });

    it('fails closed without a vault key', async () => {
      await expect(saveVaultItem('u1', { name: 'x', value: 'y' }, null)).rejects.toThrow(
        VaultLockedError
      );
      await expect(saveVaultItem('u1', { name: 'x', value: 'y' }, randomBytes(31))).rejects.toThrow(
        VaultLockedError
      );
      await expect(getVaultItems('u1', undefined)).rejects.toThrow(VaultLockedError);
      await expect(restoreFromFirestore('u1', null)).rejects.toThrow(VaultLockedError);
    });

    it('rejects empty names, missing users, and invalid timestamps without writing', async () => {
      await expect(saveVaultItem('u1', { name: '', value: 'y' }, vaultKey)).rejects.toThrow();
      await expect(saveVaultItem('', { name: 'x', value: 'y' }, vaultKey)).rejects.toThrow();
      await expect(
        saveVaultItem('u1', { name: 'x', value: 'y', timestamp: -1 }, vaultKey)
      ).rejects.toThrow();
      const { documents } = await listVaultItemDocuments('u1');
      expect(documents).toEqual([]);
    });

    it('returns items newest first and quarantines undecryptable documents', async () => {
      await saveVaultItem('u1', { name: 'newer', value: 'n', timestamp: 200 }, vaultKey);
      await saveVaultItem('u1', { name: 'older', value: 'o', timestamp: 100 }, vaultKey);
      const foreignId = await seedForeignEncrypted('foreign', 'secret', 'u1');
      const { items, quarantined } = await getVaultItems('u1', vaultKey);
      expect(items.map((item) => item.name)).toEqual(['newer', 'older']);
      expect(quarantined).toEqual([
        expect.objectContaining({ legacyDocId: foreignId, reason: 'undecryptable' }),
      ]);
    });

    it('quarantines malformed documents in reads and restore reports', async () => {
      await saveVaultItem('u1', { name: 'good', value: 'v' }, vaultKey);
      await mockFirestore
        .collection('VaultItems')
        .doc('bad-doc')
        .set({ userId: 'u1', ciphertext: 'x' });
      const { items, quarantined } = await getVaultItems('u1', vaultKey);
      expect(items.map((item) => item.name)).toEqual(['good']);
      expect(quarantined).toEqual([
        expect.objectContaining({ legacyDocId: 'bad-doc', reason: 'malformed-document' }),
      ]);

      const report = await restoreFromFirestore('u1', vaultKey);
      expect(report.firestoreTotal).toBe(2);
      expect(report.decrypted).toBe(1);
      expect(report.quarantined).toBe(1);
      expect(report.items.map((item) => item.name)).toEqual(['good']);
      expect(report.quarantinedItems.map((record) => [record.legacyDocId, record.reason])).toEqual([
        ['bad-doc', 'malformed-document'],
      ]);
    });

    it('restoreFromFirestore reports counts with no quarantine when all decrypt', async () => {
      await saveVaultItem('u1', { name: 'a', value: '1' }, vaultKey);
      await saveVaultItem('u1', { name: 'b', value: '2' }, vaultKey);
      const report = await restoreFromFirestore('u1', vaultKey);
      expect(report.firestoreTotal).toBe(2);
      expect(report.decrypted).toBe(2);
      expect(report.quarantined).toBe(0);
      expect(report.quarantinedItems).toEqual([]);
    });

    it('getVaultItemDocument returns null for missing, foreign, and malformed docs', async () => {
      const saved = await saveVaultItem('u1', { name: 'mine', value: 'v' }, vaultKey);
      await expect(getVaultItemDocument('u1', 'missing')).resolves.toBeNull();
      await expect(getVaultItemDocument('u2', saved.id)).resolves.toBeNull();
      await mockFirestore
        .collection('VaultItems')
        .doc('bad-doc')
        .set({ userId: 'u1', ciphertext: 'x' });
      await expect(getVaultItemDocument('u1', 'bad-doc')).resolves.toBeNull();
    });

    it('listVaultItemDocuments separates documents from malformed ids', async () => {
      await saveVaultItem('u1', { name: 'good', value: 'v' }, vaultKey);
      await mockFirestore
        .collection('VaultItems')
        .doc('bad-doc')
        .set({ userId: 'u1', ciphertext: 'x' });
      const { documents, malformedDocIds } = await listVaultItemDocuments('u1');
      expect(documents.map((document) => document.id)).toHaveLength(1);
      expect(malformedDocIds).toEqual(['bad-doc']);
    });

    it('removeVaultItem deletes only the caller’s item', async () => {
      const mine = await saveVaultItem('u1', { name: 'mine', value: 'v' }, vaultKey);
      const foreignId = await seedForeignEncrypted('theirs', 'secret', 'u2');
      await removeVaultItem('u1', mine.id);
      await expect(getVaultItemDocument('u1', mine.id)).resolves.toBeNull();
      await removeVaultItem('u1', foreignId);
      await expect(getVaultItemDocument('u2', foreignId)).resolves.not.toBeNull();
      await removeVaultItem('u1', 'missing');
    });

    it('deleteVaultItems deletes only the caller’s items and counts them', async () => {
      await saveVaultItem('u1', { name: 'a', value: '1' }, vaultKey);
      await saveVaultItem('u1', { name: 'b', value: '2' }, vaultKey);
      await saveVaultItem('u2', { name: 'c', value: '3' }, vaultKey);
      expect(await deleteVaultItems('u1')).toBe(2);
      expect(await getVaultItems('u1', vaultKey)).toEqual({ items: [], quarantined: [] });
      expect((await getVaultItems('u2', vaultKey)).items).toHaveLength(1);
      expect(await deleteVaultItems('u1')).toBe(0);
    });

    it('filterVaultItems searches decrypted names client-side', async () => {
      const items = [
        {
          id: '1',
          name: 'National Insurance',
          value: 'x',
          timestamp: 1,
          userId: 'u1',
          version: 1,
          updatedAt: 1,
        },
        {
          id: '2',
          name: 'Passport',
          value: 'y',
          timestamp: 1,
          userId: 'u1',
          version: 1,
          updatedAt: 1,
        },
      ];
      expect(filterVaultItems(items, null)).toEqual(items);
      expect(filterVaultItems(items, '  ')).toEqual(items);
      expect(filterVaultItems(items, 'NAT')).toEqual([items[0]]);
      expect(filterVaultItems(items, 'pass')).toEqual([items[1]]);
      expect(filterVaultItems(items, 'zzz')).toEqual([]);
    });
  });
});
