import * as forge from 'node-forge';
import { decrypt, encrypt } from './Security';
import type { AListItem } from './DataModel';

/**
 * Legacy fixture corpus for Step 1 (read-only inventory).
 *
 * These builders reproduce the shapes the current code actually reads and
 * writes; they change no production behaviour. RSA fixtures use the
 * generated in-memory test keys installed by `generateAndStoreKeys(true)`
 * in the test file — never a real key, never SecureStore. The corpus is
 * the input to the migration job in Step 10: duplicates stay duplicates,
 * malformed entries stay identifiable, and plaintext values are never
 * passed to RSA decryption.
 */

/** A raw legacy Firestore document, as returned by `doc.data()`. */
export type LegacyFirestoreRecord = Record<string, unknown>;

/** A raw legacy AsyncStorage entry, as returned by `multiGet`. */
export type LegacyAsyncStorageEntry = { key: string; raw: string | null };

/** Document ID scheme used today: content-derived, never a UUID. */
/**
 * Test-fixture corpus only: imported by `LegacyCorpus.test.ts` and by no
 * production code. It must not be imported by any step's implementation;
 * Step 10 builds its own migration readers from these shapes.
 */
export function legacyDocId(userId: string, name: string): string {
  const safeUserId = encodeURIComponent(userId.trim().replace(/\s+/g, '-'));
  const safeName = encodeURIComponent(name.trim().replace(/\s+/g, '-'));
  return `${safeUserId}_${safeName}`;
}

/** Name-prefix index, mirroring the shape written by `saveItem` today. */
export function legacySearchIndex(name: string): string[] {
  const tokens = new Set<string>();
  for (const word of name.split(' ').map((w) => w.toLocaleLowerCase())) {
    for (let i = 1; i <= word.length; i += 1) {
      tokens.add(word.slice(0, i));
    }
  }
  return [...tokens];
}

export function legacyFirestoreRecord(
  item: AListItem,
  overrides: Record<string, unknown> = {}
): LegacyFirestoreRecord {
  return {
    name: item.name,
    value: item.value,
    timestamp: item.timestamp,
    userId: item.userId,
    ...(item.encrypted !== undefined && { encrypted: item.encrypted }),
    searchIndex: legacySearchIndex(item.name),
    ...overrides,
  };
}

/** RSA-encrypt with the generated test key, via the real `Security` path. */
export async function rsaEncryptedRecord(
  name: string,
  value: string,
  userId: string,
  timestamp: number
): Promise<LegacyFirestoreRecord> {
  return legacyFirestoreRecord({
    name,
    value: await encrypt(value),
    timestamp,
    userId,
    encrypted: true,
  });
}

/** Plaintext legacy record: `encrypted` false, value stored as-is. */
export function plaintextRecord(
  name: string,
  value: string,
  userId: string,
  timestamp: number
): LegacyFirestoreRecord {
  return legacyFirestoreRecord({
    name,
    value,
    timestamp,
    userId,
    encrypted: false,
  });
}

/** Ciphertext produced under a different 512-bit test keypair. */
export async function foreignKeyRecord(
  name: string,
  value: string,
  userId: string,
  timestamp: number
): Promise<LegacyFirestoreRecord> {
  const otherKeyPair = forge.pki.rsa.generateKeyPair({ bits: 512 });
  const publicKey = forge.pki.publicKeyFromPem(forge.pki.publicKeyToPem(otherKeyPair.publicKey));
  const ciphertext = forge.util.encode64(
    publicKey.encrypt(forge.util.encodeUtf8(value), 'RSA-OAEP')
  );
  return legacyFirestoreRecord({
    name,
    value: ciphertext,
    timestamp,
    userId,
    encrypted: true,
  });
}

/** Value that is not valid base64: rejected by the Firestore contract. */
export function corruptBase64Record(
  name: string,
  userId: string,
  timestamp: number
): LegacyFirestoreRecord {
  return legacyFirestoreRecord({
    name,
    value: '!!!not-base64!!!',
    timestamp,
    userId,
    encrypted: true,
  });
}

/** Record missing `timestamp`: rejected by the Firestore contract. */
export function missingTimestampRecord(
  name: string,
  value: string,
  userId: string
): LegacyFirestoreRecord {
  const record = legacyFirestoreRecord({
    name,
    value,
    timestamp: 0,
    userId,
    encrypted: false,
  });
  delete record.timestamp;
  return record;
}

/**
 * Two records with identical name/value text but different source
 * identities. Migration must keep both: identity is the source document,
 * never the content.
 */
export function duplicateRecords(
  name: string,
  value: string,
  userId: string,
  timestamp: number
): LegacyFirestoreRecord[] {
  return [
    { ...plaintextRecord(name, value, userId, timestamp), sourceDocId: legacyDocId(userId, name) },
    {
      ...plaintextRecord(name, value, userId, timestamp),
      sourceDocId: `${legacyDocId(userId, name)}#async`,
    },
  ];
}

/** Decrypt through the real `Security` path (generated test keys). */
export async function decryptLegacyValue(ciphertext: string): Promise<string> {
  return decrypt(ciphertext);
}

/** AsyncStorage entry holding a JSON-encoded legacy item. */
export function asyncStorageEntry(key: string, item: AListItem): LegacyAsyncStorageEntry {
  return { key, raw: JSON.stringify(item) };
}

/** AsyncStorage entry whose value is not valid JSON. */
export function malformedAsyncStorageEntry(key: string): LegacyAsyncStorageEntry {
  return { key, raw: '{not json' };
}

/** Only `_ali_` keys are legacy entries; anything else is ignored. */
export function legacyAsyncStorageKeys(keys: string[]): string[] {
  return keys.filter((key) => key.startsWith('_ali_'));
}
