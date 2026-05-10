import { BackupCadence, MembershipType, UserSettings, AListItem } from './DataModel';
import firestore from '@react-native-firebase/firestore';
import { EXPO_PUBLIC_FIREBASE_EMULATOR } from '@env';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { decrypt, encrypt } from './Security';
import { validateUserSettings, validateFirestoreItem } from './Contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';

function isInvalidEncryptedPayloadError(error: unknown): boolean {
  const message = String(error);
  return message.includes('Encrypted message length is invalid');
}

type FirestoreDocData = Record<string, unknown>;
type FirestoreWhereOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'array-contains'
  | 'in'
  | 'not-in';

type FirestoreDocSnapshot = {
  exists?: boolean;
  data: () => FirestoreDocData | undefined;
};

type FirestoreDocRef = {
  get: () => Promise<FirestoreDocSnapshot>;
  set: (data: FirestoreDocData) => Promise<void>;
  update: (data: Partial<FirestoreDocData>) => Promise<void>;
  delete: () => Promise<void>;
  ref?: {
    delete: () => Promise<void>;
  };
};

type FirestoreQuerySnapshot = {
  empty: boolean;
  docs: Array<{
    id: string;
    data: () => FirestoreDocData;
    ref: {
      delete: () => Promise<void>;
    };
  }>;
};

type FirestoreQueryRef = {
  where: (field: string, op: FirestoreWhereOperator, value: unknown) => FirestoreQueryRef;
  get: () => Promise<FirestoreQuerySnapshot>;
};

type FirestoreCollectionRef = {
  doc: (id: string) => FirestoreDocRef;
  where: (field: string, op: FirestoreWhereOperator, value: unknown) => FirestoreQueryRef;
};

export type StorageFirestore = {
  collection: (name: string) => FirestoreCollectionRef;
  useEmulator?: (host: string, port: number) => void;
};

function createFirestoreClient(): StorageFirestore {
  const client = firestore() as StorageFirestore;
  if (EXPO_PUBLIC_FIREBASE_EMULATOR === 'true' && client.useEmulator) {
    console.debug('Connecting to firebase emulator');
    if (Platform.OS === 'android') {
      console.debug('Operating System ', Platform.OS);
      client.useEmulator('10.0.2.2', 8080);
      auth().useEmulator('http://10.0.2.2:9099');
    } else {
      console.debug('Operating System ', Platform.OS);
      client.useEmulator('127.0.0.1', 8080);
      auth().useEmulator('http://127.0.0.1:9099');
    }
  }
  return client;
}

let firestoreClient: StorageFirestore = createFirestoreClient();

function getFirestoreClient(): StorageFirestore {
  return firestoreClient;
}

export function setFirestoreClientForTesting(client: StorageFirestore) {
  firestoreClient = client;
}

export function resetFirestoreClientForTesting() {
  firestoreClient = createFirestoreClient();
}

function getItemDocId(name: string, userId: string): string {
  const safeUserId = encodeURIComponent(userId.trim().replace(/\s+/g, '-'));
  const safeName = encodeURIComponent(name.trim().replace(/\s+/g, '-'));
  return `${safeUserId}_${safeName}`;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function buildSearchIndex(name: string): string[] {
  const words = name.split(' ').map((w) => w.toLocaleLowerCase());
  const tokens = new Set<string>();
  for (const word of words) {
    for (let i = 1; i <= word.length; i++) {
      tokens.add(word.slice(0, i));
    }
  }
  return [...tokens];
}

async function mapFirestoreDataToItem(data: FirestoreDocData): Promise<AListItem> {
  const raw = validateFirestoreItem(data);
  const item: AListItem = {
    name: raw.name,
    value: raw.value,
    timestamp: raw.timestamp,
    userId: raw.userId,
    ...(raw.encrypted !== undefined && { encrypted: raw.encrypted }),
  };

  if (item.encrypted) {
    try {
      item.value = await decrypt(item.value);
    } catch (error) {
      if (isInvalidEncryptedPayloadError(error)) {
        console.warn(
          `Skipping decrypt for item "${item.name}" because payload is not valid encrypted text.`
        );
        item.encrypted = false;
      } else {
        throw error;
      }
    }
  }

  return item;
}

/**
 * Fetches an item from Firestore for a given user and item name.
 * @param name The name of the item (not prefixed)
 * @param userId The user ID to scope the query
 */
export async function getItem(name: string, userId: string): Promise<AListItem | null> {
  const doc = await getFirestoreClient().collection('Items').doc(getItemDocId(name, userId)).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  if (!data) {
    return null;
  }
  return mapFirestoreDataToItem(data);
}

export async function addTimestampToItems(userid: string): Promise<void[]> {
  return Promise.all(
    (await getAllItems(userid))
      .filter((item) => !item.timestamp)
      .map((item) =>
        getFirestoreClient()
          .collection('Items')
          .doc(getItemDocId(item.name, userid))
          .update({ timestamp: Date.now() })
      )
  );
}

/**
 * Fetches all items for a user from Firestore.
 * @param userId The user ID to scope the query
 */
export async function getAllItems(userId: string): Promise<Array<AListItem>> {
  const querySnapshot = await getFirestoreClient()
    .collection('Items')
    .where('userId', '==', userId)
    .get();
  if (querySnapshot.empty) return [];
  return Promise.all(querySnapshot.docs.map((doc) => mapFirestoreDataToItem(doc.data())));
}

export async function getItems(
  userId: string,
  filter: string | null = null
): Promise<Array<AListItem>> {
  console.log(`Get items for user: ${userId}`);
  const normalizedFilter = normalizeSearchTerm(filter ?? '');
  if (!normalizedFilter) {
    return getAllItems(userId);
  }

  const querySnapshot = await getFirestoreClient()
    .collection('Items')
    .where('userId', '==', userId)
    .where('searchIndex', 'array-contains', normalizedFilter)
    .get();

  if (querySnapshot.empty) return [];

  return Promise.all(querySnapshot.docs.map((doc) => mapFirestoreDataToItem(doc.data())));
}

/**
 * Saves an item to the local storage. The item should be unencrypted,
 * this function will encrypt it before saving it.
 * @param item AListItem to save
 */
export async function saveItem(item: AListItem) {
  console.log(`Saving ${JSON.stringify(item)}`);
  if (!item.userId) {
    throw new Error('saveItem requires item.userId');
  }
  const res = {
    ...item,
    encrypted: true,
    searchIndex: buildSearchIndex(item.name),
  };
  res.value = await encrypt(item.value);
  console.log(`Encrypted result ${res.value}`);
  await getFirestoreClient()
    .collection('Items')
    .doc(getItemDocId(item.name, item.userId))
    .set(res)
    .catch((e) => {
      console.error(e);
      throw e;
    });
}

export async function addSearchIndexToItems(userId: string): Promise<void[]> {
  const querySnapshot = await getFirestoreClient()
    .collection('Items')
    .where('userId', '==', userId)
    .get();

  if (querySnapshot.empty) {
    return [];
  }

  return Promise.all(
    querySnapshot.docs
      .filter((doc) => {
        const searchIndex = doc.data().searchIndex;
        return !Array.isArray(searchIndex) || searchIndex.length === 0;
      })
      .map((doc) =>
        getFirestoreClient()
          .collection('Items')
          .doc(doc.id)
          .update({ searchIndex: buildSearchIndex(validateFirestoreItem(doc.data()).name) })
      )
  );
}

export async function replaceItem(old: AListItem, newItem: AListItem, timestamp: boolean = true) {
  await removeItem(old);
  if (timestamp) {
    newItem.timestamp = Date.now();
  }
  await saveItem(newItem);
}

export async function removeItem(item: AListItem) {
  if (!item.userId) {
    return;
  }
  await getFirestoreClient().collection('Items').doc(getItemDocId(item.name, item.userId)).delete();
}

/**
 * Returns the count of ali-prefixed items for a user from Firestore.
 * @param userId The user ID to scope the query
 */
export async function getItemsCount(userId: string): Promise<number> {
  // Query Firestore for all items for the user
  const querySnapshot = await getFirestoreClient()
    .collection('Items')
    .where('userId', '==', userId)
    .get();
  if (querySnapshot.empty) return 0;
  // Only count items whose name starts with 'ali_'
  return querySnapshot.docs.filter((doc) => {
    const data = doc.data();
    return data && typeof data.name === 'string' && data.name.startsWith('ali_');
  }).length;
}

export async function getUserSettings(userId?: string): Promise<UserSettings | null> {
  if (!userId) {
    return null;
  }
  return getFirestoreClient()
    .collection('UserSettings')
    .doc(userId)
    .get()
    .then((doc) => {
      const data = doc.data();
      if (!data) return null;
      return validateUserSettings(data);
    });
}

export async function createUserSettings(userId: string): Promise<UserSettings> {
  const userSettings = await getUserSettings(userId);
  if (userSettings) return userSettings;
  const defaultSettings = {
    userId,
    backup: BackupCadence.DAILY,
    membership: MembershipType.FREE,
  } as UserSettings;
  const validated = validateUserSettings(defaultSettings);
  return getFirestoreClient()
    .collection('UserSettings')
    .doc(userId)
    .set(validated)
    .then(() => validated);
}

const _compareItems = (a: AListItem, b: AListItem) => a.name.localeCompare(b.name);

// export async function pushItem(item: AListItem, userId: string) {
//   const encodedValue = base64.encode(item.value);
//   firestore()
//     .collection("Items")
//     .doc(`${userId}_${item.name}`)
//     .set({ ...item, userId, value: encodedValue })
//     .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
// }

export async function deleteItems(userId: string): Promise<number> {
  return getFirestoreClient()
    .collection('Items')
    .where('userId', '==', userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return [];
      return querySnapshot.docs;
    })
    .then((docs) =>
      Promise.all(
        docs.map((doc) =>
          doc.ref
            .delete()
            .then(() => 1)
            .catch(() => 0)
        )
      )
    )
    .then((result) => result.reduce((a, b) => a + b, 0));
}

export async function backupLocalStorageToFirestore(): Promise<AListItem[]> {
  const keys = await AsyncStorage.getAllKeys();
  const kvp = await AsyncStorage.multiGet(keys.filter((k) => k.startsWith('_ali_')));
  return Promise.all(
    kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => {
        console.log('Item ', kvp[1]);
        return maybeDecrypt(JSON.parse(kvp[1] as string) as AListItem);
      })
  );
}

async function maybeDecrypt(item: AListItem): Promise<AListItem> {
  if (item.encrypted) {
    try {
      const value = await decrypt(item.value);
      return { ...item, value };
    } catch (error) {
      if (isInvalidEncryptedPayloadError(error)) {
        console.warn(
          `Skipping local decrypt for item "${item.name}" because payload is not valid encrypted text.`
        );
        return { ...item, encrypted: false };
      }
      throw error;
    }
  } else {
    console.debug('Item not encrypted ', JSON.stringify(item));
    await saveItem(item);
  }
  return item;
}

export async function clearLocalAsyncStorage(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('_ali_'));
  return await AsyncStorage.multiRemove(keys);
}
