# Legacy inventory (Step 1, read-only)

Shape-only inventory of the pre-vault data, taken from the code at the
reverted tree. No production Firestore or on-device data was inspected;
there are no live counts here. This document is the evidence base for the
migration job in Step 10 of
[action-plan.llm](./action-plan.llm).

## Legacy Firestore documents (`Items` collection)

- Shape: `{ name, value, timestamp, userId, encrypted?, searchIndex? }`,
  validated by `FirestoreItemContract` in
  `component/Core/Contracts.ts` (`.strict()`; `value` must match a base64
  regex; `timestamp` is required; `searchIndex` is optional).
- Document ID is derived from content:
  `encodeURIComponent(userId)_encodeURIComponent(name)` in `getItemDocId`
  (`component/Core/Storage.tsx`). Two users can own the same name; one user
  cannot own two documents with the same name under this scheme.
- `value` is RSA-OAEP ciphertext (base64) when `encrypted` is true, and
  plaintext otherwise. `encrypted: false` and a missing `encrypted` field
  are both treated as plaintext by the current readers.
- `searchIndex` is a plaintext prefix index built from the item **name**
  only (`buildSearchIndex`, `component/Core/Storage.tsx`): every prefix of
  every lower-cased word. It leaks name prefixes to Firestore and must not
  be written for new items.
- Reads skip undecryptable items one by one
  (`mapFirestoreDataToItem`); the rest of the list still loads. Search
  (`getItems` with a filter) queries `searchIndex array-contains`, so
  items without a search index are invisible to filtered reads.
- Rules (`firebase-emulator/firestore.rules`): owner-only by
  `request.auth.uid == resource.data.userId` / `request.resource.data.userId`.

## Legacy encryption (`component/Core/Security.ts`)

- RSA-OAEP via `node-forge`, 1024-bit keys generated on first use and kept
  in `expo-secure-store` under `agus_list_rsa_private_key` /
  `agus_list_rsa_public_key`. The private key never leaves the device, so
  only the originating device can decrypt an RSA legacy value.
- At 1024 bits with SHA-1 OAEP, the largest encryptable value is 86 bytes.
  Longer values cannot have been RSA-encrypted by this app and surface as
  undecryptable; they must be re-entered manually, never "recovered".
- `encrypt` logs the plaintext value and `saveItem` logs the whole item
  and the ciphertext (`component/Core/Security.ts`,
  `component/Core/Storage.tsx`). Those logs are removed in Step 11.
- `encrypt`/`decrypt` throw plain strings (`Failed to encrypt/decrypt
value: ...`), not `Error` objects. Callers — including the Step 10
  migration job — must catch by value, never by `instanceof Error`.
- In tests, `generateAndStoreKeys(true)` installs 512-bit in-memory test
  keys (`PRIVATE_TEST_KEY` / `PUBLIC_TEST_KEY`); no real key material is
  used in any fixture.

## Legacy AsyncStorage entries

- Keys prefixed `_ali_`, values are JSON-encoded `AListItem` records
  (`{ name, value, timestamp, userId?, encrypted? }`), read by
  `backupLocalStorageToFirestore` in `component/Core/Storage.tsx`. That
  function logs each raw entry, and for unencrypted entries it calls
  `saveItem`, writing an RSA-encrypted Firestore copy. `clearLocalAsyncStorage`
  removes `_ali_` keys. No other app code reads AsyncStorage.
- Entries may be malformed JSON, may lack `timestamp`/`userId`, may be
  plaintext or RSA-encrypted, and may duplicate a Firestore document.
  Duplicates are separate records: identity for migration is the source
  (AsyncStorage key or Firestore document ID), never the name/value text.

## Settings, CSV export, auth

- `UserSettings` (`{ userId, backup, membership }`) lives in the flat
  `UserSettings` collection. `backup` has no working backup system behind
  it; Firestore is the store.
- `exportItemsToCsv` (`component/Core/CsvExport.ts`) exports decrypted
  items as a plaintext CSV file via the Storage Access Framework. It is
  the only existing plaintext export.
- Anonymous sign-in is enabled (`App.tsx` login properties,
  `LoginScreen` calls `auth().signInAnonymously()`). Anonymous users have
  no membership to migrate under; Step 10 reports their items as pending
  instead of migrating them. Removing anonymous sign-in is out of scope.

## Corpus

The fixture corpus in `component/Core/LegacyCorpus.ts` and its
tests in `component/Core/__tests__/LegacyCorpus.test.ts` cover: RSA
round-trip, foreign-key ciphertext, corrupt base64, oversized values,
plaintext values that must never be RSA-decrypted, duplicates, missing
timestamps, and malformed AsyncStorage entries. All RSA fixtures use
generated test keys only.
