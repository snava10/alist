import {
  addSearchIndexToItems,
  addTimestampToItems,
  backupLocalStorageToFirestore,
  clearLocalAsyncStorage,
  createUserSettings,
  deleteItems,
  getAllItems,
  getItem,
  getItems,
  getUserSettings,
  removeItem,
  replaceItem,
  resetFirestoreClientForTesting,
  saveItem,
  setFirestoreClientForTesting,
  type StorageFirestore,
} from '../Storage';
import { BackupCadence, MembershipType, type AListItem } from '../DataModel';
import { encrypt, generateAndStoreKeys } from '../Security';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  terminate,
  updateDoc,
  where,
  type Firestore,
  type WhereFilterOp,
  type QueryConstraint,
} from 'firebase/firestore';
import { randomUUID } from 'crypto';

type FirestoreDocData = Record<string, unknown>;

function createFirestoreClientAdapter(db: Firestore): StorageFirestore {
  const buildQueryRef = (collectionName: string, constraints: QueryConstraint[] = []) => ({
    where: (field: string, op: WhereFilterOp, value: unknown) =>
      buildQueryRef(collectionName, [...constraints, where(field, op, value)]),
    get: async () => {
      const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
      return {
        empty: snapshot.empty,
        docs: snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          data: () => (snapshotDoc.data() as FirestoreDocData) ?? {},
          ref: {
            delete: () => deleteDoc(snapshotDoc.ref),
          },
        })),
      };
    },
  });

  return {
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const snapshot = await getDoc(doc(db, collectionName, id));
          return {
            exists: snapshot.exists(),
            data: () => snapshot.data() as FirestoreDocData | undefined,
          };
        },
        set: (data: FirestoreDocData) => setDoc(doc(db, collectionName, id), data),
        update: (data: Partial<FirestoreDocData>) => updateDoc(doc(db, collectionName, id), data),
        delete: () => deleteDoc(doc(db, collectionName, id)),
      }),
      where: (field: string, op: WhereFilterOp, value: unknown) =>
        buildQueryRef(collectionName, [where(field, op, value)]),
    }),
  };
}

describe('Storage', () => {
  let app: FirebaseApp;
  let db: Firestore;

  beforeAll(async () => {
    app = initializeApp({
      projectId: `alist-test-project-${randomUUID()}`,
    });
    db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    setFirestoreClientForTesting(createFirestoreClientAdapter(db));
    await generateAndStoreKeys(true);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const collectionsToClear = ['Items', 'UserSettings'];
    await Promise.all(
      collectionsToClear.map(async (collectionName) => {
        const snapshot = await getDocs(collection(db, collectionName));
        await Promise.all(snapshot.docs.map((itemDoc) => deleteDoc(itemDoc.ref)));
      })
    );
  });

  afterAll(async () => {
    await terminate(db);
    await deleteApp(app);
    resetFirestoreClientForTesting();
  });

  async function seedItems(items: AListItem[]) {
    // const collection = mockFirestore.collection('Items');
    await Promise.all(items.map(async (item) => await saveItem(item)));
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

    const storedDoc = await getDoc(doc(db, 'Items', 'u1_myItem'));
    const stored = storedDoc.data();

    expect(storedDoc.exists()).toBe(true);
    expect(stored?.encrypted).toBe(true);
    expect(stored?.value).not.toBe('secret');
    expect(stored?.searchIndex).toContain('myitem');
  });

  it('adds search indexes to items that are missing them', async () => {
    const encryptedValue = await encrypt('secret');
    await setDoc(doc(db, 'Items', 'u1_secret'), {
      name: 'secret',
      value: encryptedValue,
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
    });

    const result = await addSearchIndexToItems('u1');
    const updated = await getDoc(doc(db, 'Items', 'u1_secret'));

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
    await setDoc(doc(db, 'UserSettings', 'user123'), {
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
    const storedPlain = await getDoc(doc(db, 'Items', 'u1_plain'));

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
    expect(storedPlain.exists()).toBe(true);
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
});
