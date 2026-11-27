import { generateAndStoreKeys, encrypt } from '../Security';
import { validateFirestoreItem, validateLocalItem } from '../Contracts';
import {
  corruptBase64Record,
  decryptLegacyValue,
  duplicateRecords,
  foreignKeyRecord,
  legacyAsyncStorageKeys,
  legacyDocId,
  malformedAsyncStorageEntry,
  asyncStorageEntry,
  missingTimestampRecord,
  plaintextRecord,
  rsaEncryptedRecord,
} from '../LegacyCorpus';
import type { AListItem } from '../DataModel';

/**
 * Step 1 inventory tests. These exercise the existing decrypt/contract
 * paths with generated 512-bit test keys only; they assert the shapes
 * the migration job in Step 10 must handle. No production code changes.
 */
describe('LegacyCorpus', () => {
  beforeAll(async () => {
    await generateAndStoreKeys(true);
  });

  /**
   * `Security.decrypt`/`encrypt` reject with plain strings, not `Error`
   * objects, so `rejects.toThrow()` does not observe them. Assert on the
   * rejection value instead; Step 10 must catch by value, not by type.
   */
  async function expectFailure(promise: Promise<unknown>, fragment: string): Promise<void> {
    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(String(caught)).toContain(fragment);
  }

  it('round-trips a short value through the real RSA decrypt path', async () => {
    const record = await rsaEncryptedRecord('secret', 'decrypted-value', 'u1', 1);
    await expect(decryptLegacyValue(record.value as string)).resolves.toBe('decrypted-value');
  });

  it('round-trips an empty value through the real RSA decrypt path', async () => {
    const record = await rsaEncryptedRecord('empty', '', 'u1', 1);
    await expect(decryptLegacyValue(record.value as string)).resolves.toBe('');
  });

  it('rejects ciphertext encrypted under a different key', async () => {
    const record = await foreignKeyRecord('foreign', 'other-secret', 'u1', 1);
    await expectFailure(decryptLegacyValue(record.value as string), 'Failed to decrypt value');
  });

  it('rejects corrupt base64 ciphertext', async () => {
    const record = corruptBase64Record('corrupt', 'u1', 1);
    await expectFailure(decryptLegacyValue(record.value as string), 'Failed to decrypt value');
  });

  it('rejects values too large for 1024-bit RSA-OAEP (86-byte cap)', async () => {
    await expectFailure(encrypt('x'.repeat(100)), 'Failed to encrypt value');
  });

  it('never RSA-decrypts a plaintext legacy value', async () => {
    const record = plaintextRecord('plain', 'visible', 'u1', 1);
    // A plaintext value fed to RSA decryption must fail; Step 10 treats
    // unencrypted records as plaintext and encrypts them directly.
    await expectFailure(decryptLegacyValue(record.value as string), 'Failed to decrypt value');
  });

  it('accepts a well-formed RSA record through the Firestore contract', async () => {
    const record = await rsaEncryptedRecord('secret', 'decrypted-value', 'u1', 1);
    expect(validateFirestoreItem(record)).toMatchObject({
      name: 'secret',
      timestamp: 1,
      userId: 'u1',
      encrypted: true,
    });
  });

  it('rejects a record missing its timestamp through the Firestore contract', () => {
    expect(() => validateFirestoreItem(missingTimestampRecord('no-ts', 'v', 'u1'))).toThrow();
  });

  it('rejects corrupt base64 through the Firestore contract before any decrypt', () => {
    expect(() => validateFirestoreItem(corruptBase64Record('corrupt', 'u1', 1))).toThrow();
  });

  it('rejects unknown extra fields through the strict Firestore contract', async () => {
    const record = await rsaEncryptedRecord('secret', 'v', 'u1', 1);
    expect(() => validateFirestoreItem({ ...record, unexpected: true })).toThrow();
  });

  it('keeps duplicate name/value records as two distinct source documents', () => {
    const records = duplicateRecords('dup', 'same', 'u1', 1);
    expect(records).toHaveLength(2);
    expect(records[0]?.sourceDocId).not.toBe(records[1]?.sourceDocId);
    expect(records[0]?.name).toBe(records[1]?.name);
  });

  it('derives legacy document IDs from user ID and name, not from content', () => {
    expect(legacyDocId('u1', 'my secret')).toBe('u1_my-secret');
    expect(legacyDocId('u1', 'my secret')).toBe(legacyDocId('u1', 'my secret'));
  });

  it('parses a well-formed AsyncStorage entry as a local item', () => {
    const item: AListItem = {
      name: 'secret',
      value: 'visible',
      timestamp: 1,
      userId: 'u1',
      encrypted: false,
    };
    const entry = asyncStorageEntry('_ali_secret', item);
    expect(validateLocalItem(JSON.parse(entry.raw as string))).toEqual(item);
  });

  it('reports a malformed AsyncStorage entry instead of parsing it', () => {
    const entry = malformedAsyncStorageEntry('_ali_broken');
    expect(() => JSON.parse(entry.raw as string)).toThrow();
  });

  it('selects only _ali_ AsyncStorage keys as legacy entries', () => {
    expect(legacyAsyncStorageKeys(['_ali_a', 'other', '_ali_b', 'ali_c'])).toEqual([
      '_ali_a',
      '_ali_b',
    ]);
  });
});
