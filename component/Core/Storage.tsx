import {
  BackupCadence,
  MembershipType,
  UserSettings,
  AListItem,
  QuarantineRecord,
  VAULT_ALGORITHM,
  VAULT_SCHEMA_VERSION,
  VaultItem,
  VaultItemDocument,
  VaultProfile,
} from './DataModel';
import firestore from '@react-native-firebase/firestore';
import { EXPO_PUBLIC_FIREBASE_EMULATOR } from '@env';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { decrypt, encrypt } from './Security';
import {
  validateUserSettings,
  validateFirestoreItem,
  validateVaultItemDocument,
  validateVaultProfile,
} from './Contracts';
import { decryptVaultItem, encryptVaultItem, newItemId, VAULT_KEY_LENGTH } from './VaultCrypto';
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
  settings?: (settings: { persistence?: boolean; cacheSizeBytes?: number }) => Promise<void>;
};

// ── Offline persistent cache ──────────────────────────────────────────────
// The SDK's offline cache is the only offline mechanism. It is requested
// before any other Firestore use, as the SDK requires settings to be set
// first. Whether it actually took effect is observable through
// isOfflineCacheEnabled; on-device behaviour is not verified by unit
// tests (see the Step 7 manual gate in the action plan).

const offlineCacheResults = new WeakMap<object, boolean>();
const offlineCacheAttempts = new WeakSet<object>();

async function configureOfflineCache(client: StorageFirestore): Promise<boolean> {
  if (offlineCacheAttempts.has(client)) {
    return offlineCacheResults.get(client) ?? false;
  }
  offlineCacheAttempts.add(client);
  if (!client.settings) {
    offlineCacheResults.set(client, false);
    return false;
  }
  try {
    await client.settings({ persistence: true });
    offlineCacheResults.set(client, true);
    return true;
  } catch {
    offlineCacheResults.set(client, false);
    return false;
  }
}

/**
 * Request the Firestore SDK offline/persistent cache for the current
 * client. Returns true when the SDK accepted the setting. When the SDK
 * in use does not expose settings, this returns false and no local
 * offline layer is invented for sensitive data.
 */
export function enableOfflinePersistence(
  client: StorageFirestore = getFirestoreClient()
): Promise<boolean> {
  return configureOfflineCache(client);
}

/** Whether the offline cache setting was accepted for the current client. */
export function isOfflineCacheEnabled(client: StorageFirestore = getFirestoreClient()): boolean {
  return offlineCacheResults.get(client) ?? false;
}

function createFirestoreClient(): StorageFirestore {
  const client = firestore() as StorageFirestore;
  void configureOfflineCache(client);
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

// ── Vault items (schema v2) ───────────────────────────────────────────────
// Vault reads and writes require the in-memory vault key held by the
// vault provider; without it they fail closed. Each document is
// fault-isolated: one undecryptable or malformed document is
// quarantined and the rest of the vault still loads.

export class VaultLockedError extends Error {
  constructor(message = 'The vault is locked') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

function requireVaultKey(key: Uint8Array | null | undefined): Uint8Array {
  if (!(key instanceof Uint8Array) || key.length !== VAULT_KEY_LENGTH) {
    throw new VaultLockedError();
  }
  return key;
}

/** Lists raw vault documents for a user, without decrypting them. */
export async function listVaultItemDocuments(userId: string): Promise<{
  documents: VaultItemDocument[];
  malformedDocIds: string[];
}> {
  const querySnapshot = await getFirestoreClient()
    .collection('VaultItems')
    .where('userId', '==', userId)
    .get();
  const documents: VaultItemDocument[] = [];
  const malformedDocIds: string[] = [];
  for (const doc of querySnapshot.docs) {
    try {
      documents.push(validateVaultItemDocument(doc.data()));
    } catch {
      malformedDocIds.push(doc.id);
    }
  }
  return { documents, malformedDocIds };
}

export async function getVaultItemDocument(
  userId: string,
  itemId: string
): Promise<VaultItemDocument | null> {
  const doc = await getFirestoreClient().collection('VaultItems').doc(itemId).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  if (!data) {
    return null;
  }
  try {
    const validated = validateVaultItemDocument(data);
    return validated.userId === userId ? validated : null;
  } catch {
    return null;
  }
}

export type SaveVaultItemInput = {
  id?: string;
  name: string;
  value: string;
  /**
   * Original time for a brand-new item (migration preserving a legacy
   * timestamp). Ignored on edits, where updatedAt is always now.
   */
  timestamp?: number;
  migratedFrom?: string;
};

/**
 * Encrypts and writes one vault item. A new item gets a random UUID and
 * version 1; an existing item keeps its ID and creation time with an
 * incremented version. The write is validated against the vault
 * contract before it reaches Firestore.
 */
export async function saveVaultItem(
  userId: string,
  input: SaveVaultItemInput,
  vaultKey: Uint8Array | null | undefined
): Promise<VaultItem> {
  const key = requireVaultKey(vaultKey);
  if (!userId) {
    throw new Error('saveVaultItem requires userId');
  }
  if (!input.name) {
    throw new Error('saveVaultItem requires a name');
  }
  if (input.timestamp !== undefined && (!Number.isFinite(input.timestamp) || input.timestamp < 0)) {
    throw new Error('saveVaultItem requires a valid timestamp');
  }
  const now = Date.now();
  const existing = input.id ? await getVaultItemDocument(userId, input.id) : null;
  const id = existing?.id ?? newItemId();
  const version = existing ? existing.version + 1 : 1;
  const createdAt = existing?.createdAt ?? input.timestamp ?? now;
  const updatedAt = existing ? now : (input.timestamp ?? now);
  const migratedFrom = input.migratedFrom ?? existing?.migratedFrom;
  const encrypted = encryptVaultItem(key, id, version, input.name, input.value);
  const document: VaultItemDocument = {
    id,
    userId,
    ...encrypted,
    algorithm: VAULT_ALGORITHM,
    schemaVersion: VAULT_SCHEMA_VERSION,
    version,
    createdAt,
    updatedAt,
    ...(migratedFrom !== undefined ? { migratedFrom } : {}),
  };
  const validated = validateVaultItemDocument(document);
  await getFirestoreClient().collection('VaultItems').doc(id).set(validated);
  return {
    id,
    name: input.name,
    value: input.value,
    timestamp: updatedAt,
    userId,
    version,
    updatedAt,
  };
}

function sortVaultItems(items: VaultItem[]): VaultItem[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

function decryptDocuments(
  documents: VaultItemDocument[],
  malformedDocIds: string[],
  vaultKey: Uint8Array,
  now: number
): { items: VaultItem[]; quarantined: QuarantineRecord[] } {
  const quarantined: QuarantineRecord[] = malformedDocIds.map((legacyDocId) => ({
    legacyDocId,
    reason: 'malformed-document',
    at: now,
  }));
  const items: VaultItem[] = [];
  for (const document of documents) {
    try {
      const { name, value } = decryptVaultItem(vaultKey, document);
      items.push({
        id: document.id,
        name,
        value,
        timestamp: document.updatedAt,
        userId: document.userId,
        version: document.version,
        updatedAt: document.updatedAt,
      });
    } catch {
      quarantined.push({ legacyDocId: document.id, reason: 'undecryptable', at: now });
    }
  }
  return { items: sortVaultItems(items), quarantined };
}

/**
 * One-shot vault read. Each document is fault-isolated: one
 * undecryptable or malformed document is quarantined (by document ID
 * only) and the rest of the vault still loads.
 */
export async function getVaultItems(
  userId: string,
  vaultKey: Uint8Array | null | undefined
): Promise<{ items: VaultItem[]; quarantined: QuarantineRecord[] }> {
  const key = requireVaultKey(vaultKey);
  const now = Date.now();
  const { documents, malformedDocIds } = await listVaultItemDocuments(userId);
  return decryptDocuments(documents, malformedDocIds, key, now);
}

/** Re-sync report: Firestore count vs decrypted count, with quarantine details. */
export async function restoreFromFirestore(
  userId: string,
  vaultKey: Uint8Array | null | undefined
): Promise<{
  firestoreTotal: number;
  decrypted: number;
  quarantined: number;
  items: VaultItem[];
  quarantinedItems: QuarantineRecord[];
}> {
  const key = requireVaultKey(vaultKey);
  const now = Date.now();
  const { documents, malformedDocIds } = await listVaultItemDocuments(userId);
  const { items, quarantined } = decryptDocuments(documents, malformedDocIds, key, now);
  return {
    firestoreTotal: documents.length + malformedDocIds.length,
    decrypted: items.length,
    quarantined: quarantined.length,
    items,
    quarantinedItems: quarantined,
  };
}

/**
 * Merges a snapshot of raw vault documents into a decrypted item list.
 * Duplicate documents for one ID resolve last-writer-wins by
 * (version, updatedAt); documents belonging to another user or carrying
 * a malformed shape are quarantined once each; the rest decrypt
 * per-item with quarantine isolation. The snapshot is the merge input:
 * Firestore remains the source of truth and no divergent local copy
 * is kept.
 */
export async function mergeVaultSnapshot(
  userId: string,
  vaultKey: Uint8Array | null | undefined,
  rawDocs: Array<{ id: string; data: () => unknown }>
): Promise<{ items: VaultItem[]; quarantined: QuarantineRecord[] }> {
  const key = requireVaultKey(vaultKey);
  const now = Date.now();
  const quarantined: QuarantineRecord[] = [];
  const quarantinedIds = new Set<string>();
  const quarantineOnce = (legacyDocId: string, reason: string) => {
    if (!quarantinedIds.has(legacyDocId)) {
      quarantinedIds.add(legacyDocId);
      quarantined.push({ legacyDocId, reason, at: now });
    }
  };
  const byId = new Map<string, VaultItemDocument>();
  for (const rawDoc of rawDocs) {
    let document: VaultItemDocument;
    try {
      document = validateVaultItemDocument(rawDoc.data());
    } catch {
      quarantineOnce(rawDoc.id, 'malformed-document');
      continue;
    }
    if (document.userId !== userId) {
      quarantineOnce(document.id, 'owner-mismatch');
      continue;
    }
    const previous = byId.get(document.id);
    if (
      !previous ||
      document.version > previous.version ||
      (document.version === previous.version && document.updatedAt > previous.updatedAt)
    ) {
      byId.set(document.id, document);
    }
  }
  const decrypted = decryptDocuments([...byId.values()], [], key, now);
  return { items: decrypted.items, quarantined: [...quarantined, ...decrypted.quarantined] };
}

/**
 * Live sync: subscribes to the user's VaultItems collection. Remote and
 * locally-queued (offline) changes arrive through the same snapshot,
 * merged by mergeVaultSnapshot. A snapshot error is reported through
 * `onError` and keeps the previous list. Returns the unsubscribe
 * function.
 */
export function subscribeToVaultItems(
  userId: string,
  vaultKey: Uint8Array | null | undefined,
  onResult: (result: { items: VaultItem[]; quarantined: QuarantineRecord[] }) => void,
  onError?: (error: unknown) => void
): () => void {
  const key = requireVaultKey(vaultKey);
  return getFirestoreClient()
    .collection('VaultItems')
    .where('userId', '==', userId)
    .onSnapshot(
      (snapshot) => {
        void mergeVaultSnapshot(userId, key, snapshot.docs).then(onResult, onError);
      },
      (error) => {
        onError?.(error);
      }
    );
}

/** Client-side search over decrypted items, after unlock. No server-side index. */
export function filterVaultItems(items: VaultItem[], query: string | null): VaultItem[] {
  const term = (query ?? '').trim().toLowerCase();
  if (!term) {
    return [...items];
  }
  return items.filter((item) => item.name.toLowerCase().includes(term));
}

export async function removeVaultItem(userId: string, itemId: string): Promise<void> {
  const existing = await getVaultItemDocument(userId, itemId);
  if (!existing) {
    return;
  }
  await getFirestoreClient().collection('VaultItems').doc(itemId).delete();
}

export async function deleteVaultItems(userId: string): Promise<number> {
  const querySnapshot = await getFirestoreClient()
    .collection('VaultItems')
    .where('userId', '==', userId)
    .get();
  if (querySnapshot.empty) return 0;
  const results = await Promise.all(
    querySnapshot.docs.map((doc) =>
      doc.ref
        .delete()
        .then(() => 1)
        .catch(() => 0)
    )
  );
  return results.reduce((a, b) => a + b, 0);
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
  // No searchIndex is written: search is client-side over decrypted
  // items after unlock, so no plaintext name prefix may leak to
  // Firestore. (addSearchIndexToItems below is the legacy backfill and
  // is removed in Step 11 with the rest of the legacy paths.)
  const res = {
    ...item,
    encrypted: true,
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
