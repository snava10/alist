import { BackupCadence, MembershipType, UserSettings, AListItem, VaultProfile } from './DataModel';
import firestore from '@react-native-firebase/firestore';
import { EXPO_PUBLIC_FIREBASE_EMULATOR } from '@env';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { decrypt, encrypt } from './Security';
import { validateUserSettings, validateFirestoreItem, validateVaultProfile } from './Contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  onSnapshot: (
    onNext: (snapshot: FirestoreQuerySnapshot) => void,
    onError?: (error: unknown) => void
  ) => () => void;
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

// ── Vault profiles (schema v2) ────────────────────────────────────────────
// The profile holds KDF parameters, a password verifier, and wrapped key
// material only — never a master password or a cleartext key. A malformed
// stored profile fails closed by throwing; it is never guessed at.

export async function getVaultProfile(userId: string): Promise<VaultProfile | null> {
  if (!userId) {
    return null;
  }
  const doc = await getFirestoreClient().collection('VaultProfiles').doc(userId).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  if (!data) {
    return null;
  }
  return validateVaultProfile(data);
}

export async function saveVaultProfile(profile: VaultProfile): Promise<void> {
  const validated = validateVaultProfile(profile);
  await getFirestoreClient().collection('VaultProfiles').doc(validated.userId).set(validated);
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

async function mapFirestoreDataToItem(data: FirestoreDocData): Promise<AListItem | null> {
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
    } catch {
      // The payload cannot be decrypted with the keys on this device
      // (for example, it was encrypted under a key from a previous
      // install or another device). Skip the item instead of failing
      // the whole list, and leave the stored data untouched.
      console.warn(
        `Skipping item "${item.name}" because it could not be decrypted with the keys on this device.`
      );
      return null;
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
 * Maps one query snapshot to decrypted items. One unreadable document is
 * skipped (and warned about) instead of failing the whole list: a bad
 * document must never hide the rest of the vault, and a failed snapshot
 * must never leave a stale list on screen.
 */
async function mapQueryDocsToItems(
  docs: Array<{ data: () => FirestoreDocData }>
): Promise<Array<AListItem>> {
  const items: AListItem[] = [];
  for (const doc of docs) {
    try {
      const item = await mapFirestoreDataToItem(doc.data());
      if (item !== null) {
        items.push(item);
      }
    } catch (error) {
      console.warn('Skipping an item document that failed validation.', error);
    }
  }
  return items;
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
  return mapQueryDocsToItems(querySnapshot.docs);
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

  return mapQueryDocsToItems(querySnapshot.docs);
}

/**
 * Live subscription to a user's items. The snapshot delivered after a
 * local write already contains that write (latency compensation), so the
 * list updates as soon as the write lands — no navigation or manual
 * reload is needed to see a newly added item. Returns the unsubscribe
 * function. A snapshot that fails to map keeps the previous list: the
 * error is reported through `onError` instead of clearing the screen.
 */
export function subscribeToItems(
  userId: string,
  filter: string | null,
  onItems: (items: AListItem[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const normalizedFilter = normalizeSearchTerm(filter ?? '');
  let query = getFirestoreClient().collection('Items').where('userId', '==', userId);
  if (normalizedFilter) {
    query = query.where('searchIndex', 'array-contains', normalizedFilter);
  }
  return query.onSnapshot(
    (snapshot) => {
      mapQueryDocsToItems(snapshot.docs).then(onItems, onError);
    },
    (error) => {
      onError?.(error);
    }
  );
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
  const items = await Promise.all(
    kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => {
        console.log('Item ', kvp[1]);
        return maybeDecrypt(JSON.parse(kvp[1] as string) as AListItem);
      })
  );
  return items.filter((item): item is AListItem => item !== null);
}

async function maybeDecrypt(item: AListItem): Promise<AListItem | null> {
  if (item.encrypted) {
    try {
      const value = await decrypt(item.value);
      return { ...item, value };
    } catch {
      console.warn(
        `Skipping local item "${item.name}" because it could not be decrypted with the keys on this device.`
      );
      return null;
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
