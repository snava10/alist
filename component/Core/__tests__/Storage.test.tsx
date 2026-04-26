import {
  addTimestampToItems,
  backupLocalStorageToFirestore,
  clearLocalAsyncStorage,
  createUserSettings,
  deleteItems,
  getAllItems,
  getItem,
  getItems,
  getItemsCount,
  getUserSettings,
  removeItem,
  replaceItem,
  resetFirestoreClientForTesting,
  saveItem,
  setFirestoreClientForTesting,
} from '../Storage';
import { BackupCadence, MembershipType, type AListItem } from '../DataModel';
import { encrypt, generateAndStoreKeys } from '../Security';
import { MockFirestore } from './MockFirestore';
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
    const collection = mockFirestore.collection('Items');
    await Promise.all(
      items.map(async (item) => {
        const value = item.encrypted ? item.value : await encrypt(item.value);
        await collection.doc(`${item.userId}_${item.name}`).set({
          ...item,
          value,
          encrypted: true,
        });
      })
    );
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

  it('filters items by case-insensitive name match', async () => {
    await seedItems([
      { name: 'Apple', value: 'one', timestamp: 1, encrypted: false, userId: 'u1' },
      { name: 'banana', value: 'two', timestamp: 2, encrypted: false, userId: 'u1' },
    ]);

    const items = await getItems('u1', 'app');

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe('Apple');
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

  it('counts only ali-prefixed items for a user', async () => {
    await seedItems([
      { name: 'ali_a', value: 'one', timestamp: 1, encrypted: false, userId: 'u1' },
      { name: 'ali_b', value: 'two', timestamp: 2, encrypted: false, userId: 'u1' },
      { name: 'other', value: 'three', timestamp: 3, encrypted: false, userId: 'u1' },
    ]);

    await expect(getItemsCount('u1')).resolves.toBe(2);
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
});
