# AES-256-GCM Encryption + Backup Push + Cross-Device Key Recovery

## Problem

RSA-OAEP (2048-bit) has a hard 214-byte plaintext ceiling, making it unsuitable for
encrypting arbitrary item values. There was also no mechanism to push encrypted
backups to the cloud or recover the encryption key on a new device.

---

## Goals

1. Replace RSA encrypt/decrypt with AES-256-GCM — no plaintext size limit.
2. Keep existing stored items working via a silent migration fallback.
3. Allow users to back up all encrypted items to Firestore in one tap.
4. Allow users to wrap their AES key with a passphrase and store it in Firestore so
   they can restore on a new device without any plaintext ever leaving the device.

---

## Implementation Plan

### Part 1 — AES-256-GCM in `Security.ts`

- Generate a 256-bit AES-GCM key on first use; persist it in `expo-secure-store`
  under the key `agus_list_aes_key` (base64-encoded raw bytes).
- `encrypt(plaintext)` → `base64(12-byte-random-IV ‖ AES-GCM-ciphertext)`.
  IV is randomised per call — no deterministic ciphertext.
- `decrypt(ciphertext)` → strip IV prefix, decrypt with AES-GCM.
  If decryption fails with an `OperationError`, fall back to the legacy RSA path so
  existing stored items migrate transparently on first read.
- Remove the RSA key-generation and RSA encrypt path entirely; keep only the RSA
  decrypt fallback.

### Part 2 — Cross-device key portability in `Security.ts`

- `wrapAESKey(passphrase: string): Promise<string>`
  1. Derive a 256-bit AES-KW key from the passphrase via PBKDF2-SHA256 (100 000
     iterations, 16-byte random salt).
  2. Wrap the AES-GCM key with AES-KW.
  3. Return `base64(salt ‖ wrappedKey)`.
- `unwrapAESKey(wrapped: string, passphrase: string): Promise<void>`
  1. Split the stored blob back into salt and wrapped bytes.
  2. Re-derive the AES-KW key from the passphrase + salt.
  3. Unwrap the AES-GCM key and overwrite the value in `expo-secure-store`.
  4. Throw a descriptive error if the passphrase is wrong (AES-KW unwrap fails).

### Part 3 — Backup push in `Storage.tsx`

- `pushAllItems(userId: string): Promise<void>`
  Reads every `_ali_*` key from AsyncStorage (already-encrypted ciphertext) and
  upserts each document into Firestore `Items/{userId}/Items/{itemKey}` with
  `{ ...item, encrypted: true }`. Plaintext never leaves the device.
- `saveWrappedKey(userId, wrappedKey)` / `getWrappedKey(userId)` —
  Write/read the passphrase-wrapped AES key under `UserSettings/{userId}/wrappedKey`.
- `restoreKeyFromCloud(userId, passphrase)` —
  Fetch the wrapped key from Firestore then call `unwrapAESKey`.
- Fix two pre-existing async bugs:
  - `maybeDecrypt` was fire-and-forgetting `saveItem`; add `await`.
  - `restoreFromBackup` used `forEach` with an `async` callback;
    replace with `Promise.all`.

### Part 4 — Key recovery UI in `ProfileScreen.tsx`

Three new controls in the Profile screen:

| Button             | Action                                                            |
| ------------------ | ----------------------------------------------------------------- |
| **Backup Now**     | Calls `pushAllItems(userId)`                                      |
| **Set Backup Key** | Modal: user enters a passphrase → `wrapAESKey` → `saveWrappedKey` |
| **Restore Key**    | Modal: user enters passphrase → `restoreKeyFromCloud`             |

### Part 5 — Contracts & Data model

- `FirestoreItemContract` (`Contracts.ts`): promote `encrypted` from optional to
  **required** (`z.boolean()`).
- New `WrappedKeyContract`: `{ wrappedKey: z.string().min(1) }`.
- `UserSettings` type (`DataModel.tsx`): add optional `wrappedKey?: string` field.
- Remove the explicit `ZodType<UserSettings>` annotation from `UserSettingsContract`
  (incompatible with `exactOptionalPropertyTypes: true`); add `as UserSettings` cast
  in `validateUserSettings` instead.

### Part 6 — Tests

Add 47 new tests (302 total, up from 255):

- AES encrypt → decrypt round-trip.
- Strings longer than 214 bytes encrypted and decrypted correctly.
- Each `encrypt` call produces a different ciphertext (random IV).
- `wrapAESKey` produces different output each call (random salt).
- `wrapAESKey` / `unwrapAESKey` round-trip: key restored correctly on "new device".
- Wrong passphrase in `unwrapAESKey` throws.
- `pushAllItems`, `saveWrappedKey`, `getWrappedKey`, `restoreKeyFromCloud` unit tests.
- Profile screen renders "Backup Now", "Set Backup Key", "Restore Key"; modals open
  and submit correctly.

---

## Files Changed

| File                                                       | Change                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `component/Core/Security.ts`                               | AES-256-GCM + PBKDF2/AES-KW key wrap                       |
| `component/Core/Storage.tsx`                               | `pushAllItems`, key helpers, async bug fixes               |
| `component/ProfileScreen/ProfileScreen.tsx`                | Backup Now, Set Backup Key, Restore Key UI                 |
| `component/Core/Contracts.ts`                              | `encrypted` required, `WrappedKeyContract`, annotation fix |
| `component/Core/DataModel.tsx`                             | `UserSettings.wrappedKey` field                            |
| `component/Core/__tests__/Security.test.ts`                | +28 tests                                                  |
| `component/Core/__tests__/Storage.test.ts`                 | +10 tests                                                  |
| `component/ProfileScreen/__tests__/ProfileScreen.test.tsx` | +9 tests                                                   |

---

## CI Fixes Applied

| File               | Error                                                                  | Fix                                   |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------- |
| `Contracts.ts`     | `ZodType<UserSettings>` incompatible with `exactOptionalPropertyTypes` | Removed annotation; cast in validator |
| `Security.ts`      | `bytes[i]` is `number \| undefined` (`noUncheckedIndexedAccess`)       | `as number` cast                      |
| `Security.test.ts` | `store[key]` is `string \| undefined`                                  | `as string` cast                      |
