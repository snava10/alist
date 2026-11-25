# Password Manager Transformation Plan

> Status: plan only. No code was changed to produce this document. Do not start
> implementation until the decisions in §12 are confirmed and Phase 0 is complete.
> Companion guardrails for any later implementation work:
> [PASSWORD_MANAGER_SECURITY_SKILL.md](../skills/PASSWORD_MANAGER_SECURITY_SKILL.md).
> Existing quality gates still apply: see
> [zero-slop-ai.md](./zero-slop-ai.md) and [AGENTS.md](../../AGENTS.md).

## 1. Goal

Turn `alist` (`aguslist`, v2.2.2) from a single-device list of encrypted
name/value pairs into a fully fledged, zero-knowledge password manager in the
shape of 1Password / LastPass / Bitwarden: a vault the user can unlock on any
of their devices and re-sync from Firebase on a new device — without the
server ever being able to read the secrets. Membership is by Firebase login
only; the anonymous option is removed. Only encrypted data is stored in
Firebase: the encrypted items saved in Firestore are themselves the store,
and there is no separate backup system.

The non-negotiable outcome is **no existing user loses data**. Every phase
below is ordered so that a failure leaves the user's current data readable by
the current app version. If a phase cannot meet its exit criteria, stop and
roll back instead of pushing forward.

## 2. Current state (evidence, not opinion)

Stack: React Native 0.83 + Expo SDK 55, TypeScript (strict), Firebase Auth
(Google, Apple, Facebook, anonymous, email/password) and Firestore as the
only persistence layer. Tests: Jest + React Native Testing Library, Zod
contracts, Stryker mutation testing, dependency-cruiser, Maestro E2E.

| Area       | Today                                                                                                                                                                            | Evidence                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data model | One flat type: `name`, `value`, `timestamp`, optional `userId`/`encrypted`. No username, URL, notes, category, folder, tags, favourite, TOTP, or history.                        | [DataModel.tsx](../../component/Core/DataModel.tsx)                                                                                                                      |
| Storage    | Firestore collection `Items`, one document per item. Document ID is derived from the user ID + item name. No listeners, no offline cache, no versioning, no tombstones.          | [Storage.tsx](../../component/Core/Storage.tsx)                                                                                                                          |
| Encryption | Each value encrypted directly with RSA-OAEP (2048-bit) and base64-encoded. New keypair per device, generated in JavaScript.                                                      | [Security.ts](../../component/Core/Security.ts)                                                                                                                          |
| Backup     | A `BackupCadence` setting (NONE/DAILY/INSTANT) is stored but never acted on. "Backup Restore" does nothing. The legacy local-storage backup function is dead code in production. | [Storage.tsx](../../component/Core/Storage.tsx), [ProfileScreen.tsx](../../component/ProfileScreen.tsx)                                                                  |
| UI         | Two tabs (Home, Profile). Add/edit is one modal with two plain fields. Secrets render in clear text. No detail screen, generator, categories, lock screen, or onboarding.        | [HomeScreen.tsx](../../component/HomeScreen.tsx), [AddItemModal.tsx](../../component/AddItemModal.tsx), [AListItemComponent.tsx](../../component/AListItemComponent.tsx) |
| Auth       | Firebase Auth proves identity. Nothing else gates access to secrets: no master password, no biometrics, no auto-lock, no re-authentication.                                      | [App.tsx](../../App.tsx), [LoginScreen.tsx](../../component/Login/LoginScreen.tsx)                                                                                       |

## 3. Findings: the four limitations, precisely

### 3.1 Security is weak

| #   | Finding                                                                                                                                                                                                                                                          | Evidence                                                                                                                                                              | Impact                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| S1  | RSA is used as a bulk cipher. RSA-OAEP with a 2048-bit key can only encrypt ~190 bytes, so long values fail outright, and there is no authenticated symmetric layer, no per-item key, and no integrity tag beyond OAEP itself.                                   | [Security.ts](../../component/Core/Security.ts):24                                                                                                                    | Long secrets are unusable; tampering is detected only by opaque decrypt failure.                             |
| S2  | Keys are generated in JavaScript (`node-forge`) and stored as exportable PEM strings in SecureStore. They are not hardware-backed, not non-extractable, and any code that can read SecureStore can export the private key.                                       | [Security.ts](../../component/Core/Security.ts):76,81-82                                                                                                              | A compromised app process or a device-backup restore can exfiltrate the only key.                            |
| S3  | Android backup of SecureStore is enabled (`configureAndroidBackup: true`), so keys can travel with a device backup to a different device/account context.                                                                                                        | [app.json](../../app.json)                                                                                                                                            | Key material leaves the device's hardware boundary.                                                          |
| S4  | There is no master password, KDF, salt, or verifier. Firebase sign-in alone unlocks the vault. No biometric gate, no lock timeout, no step-up re-auth before delete account, revoke device, or reveal recovery key.                                              | Whole app; no `expo-local-authentication` dependency                                                                                                                  | Anyone holding the signed-in device reads every secret; theft of the Firebase session is theft of the vault. |
| S5  | Plaintext secrets are logged: `encrypt()` logs the value, `saveItem()` logs the whole item, and item names flow to Analytics.                                                                                                                                    | [Security.ts](../../component/Core/Security.ts):17, [Storage.tsx](../../component/Core/Storage.tsx):218,228, [HomeScreen.tsx](../../component/HomeScreen.tsx):168-180 | Secrets and metadata leak to logcat, crash reports, and analytics.                                           |
| S6  | Item names and name prefixes are stored in cleartext in Firestore (`name` field + `searchIndex`), and the document ID encodes the name. The server — and anyone with Firestore access — learns what every item is, even though values are encrypted.             | [Storage.tsx](../../component/Core/Storage.tsx):99-118,225                                                                                                            | Metadata leakage defeats the point of encrypting values; also enables targeted tampering.                    |
| S7  | Corrupt ciphertext is silently downgraded: on an invalid-length payload the item is returned with `encrypted: false` and its raw value. A tampered or legacy-plaintext payload is then treated as a real secret.                                                 | [Storage.tsx](../../component/Core/Storage.tsx):130-142,374-387                                                                                                       | Silent integrity failure; plaintext confusion during migration.                                              |
| S8  | No recovery story. The private key lives only on one device. Clear SecureStore, reinstall the app, or lose the phone and every Firestore ciphertext becomes permanently unreadable. No recovery key, no key backup, no escrow — and no warning saying so.        | [Security.ts](../../component/Core/Security.ts):48-72                                                                                                                 | Single point of total, silent data loss. S8 is the reason §10 (migration) exists.                            |
| S9  | No password health features: no generator, no strength check, no reuse/age detection, no breach check. The only item shape is a name/value pair, which this plan keeps (§4.1) — the gap is the missing generator and health checks, not more fields.             | [AddItemModal.tsx](../../component/AddItemModal.tsx)                                                                                                                  | Users keep weak, reused passwords; the app cannot help them improve.                                         |
| S10 | Test doubles weaken the crypto tests: the security suite mocks `node-forge` encrypt/decrypt to identity functions and asserts mostly that functions exist. Nothing proves a round-trip, tamper rejection, or wrong-key failure against real crypto.              | [Security.test.ts](../../component/Core/__tests__/Security.test.ts)                                                                                                   | The crypto layer is effectively untested where it matters.                                                   |
| S11 | Firebase credential files (`google-services.json`, `GoogleService-Info.plist`) are committed to git, contrary to [AGENTS.md](../../AGENTS.md). Verify whether they are production credentials; if so, rotate them and remove them from history handling per §13. | `git ls-files`                                                                                                                                                        | Credential exposure risk; independent of the crypto work, fix first.                                         |

### 3.2 Multi-device is impossible by construction

- The private key never leaves the device that generated it. A second device
  calls `getRSAKeys()`, finds nothing in its own SecureStore, generates a
  **different** keypair, and can decrypt nothing written by the first device.
  Worse, edits from the second device are encrypted under its key, so the
  vault silently splits into per-device-readable fragments.
- There is no device registry, no public-key directory, no key-wrapping, and
  no enrolment/approval flow.
- Sync is one-shot `get()` queries. No `onSnapshot` listener, no offline
  queue, no sync state in the UI. Rename is delete + create (`replaceItem`),
  non-atomic, keyed by the old name — concurrent edits on two devices race
  and one side's delete can win.
- One undecryptable item rejects the whole `Promise.all` in `getAllItems()`,
  so a single corrupt item hides the entire vault on another device.

### 3.3 Backup / restore does not work and cannot be trusted

- The "Backup Restore" button's accept handler only logs an Analytics event.
  The real call is commented out and no `restoreFromBackup` function exists
  anywhere in the codebase. The existing test mocks it and its assertion is
  commented out too. **Restore has never worked in this codebase.**
- `backupLocalStorageToFirestore()` is misnamed and buggy: for encrypted
  local items it decrypts and returns them without writing anything to
  Firestore; only unencrypted items are saved. It is called by no production
  code (tests only) and it returns decrypted items to its caller. The legacy
  `_ali_` AsyncStorage keys it reads belong to the deprecated local storage
  (commit `fb8d4aa`, "Deprecate local storage").
- `BackupCadence` is write-only configuration: the Profile screen builds the
  cadence picker options and discards them; no scheduler, background task, or
  snapshot ever runs. There are no snapshots, versions, retention rules, or
  exports at all. Deleting an item deletes its only copy.
- Restore semantics are undefined: replace vs merge, conflict handling,
  verification, and partial failure are all unspecified because restore does
  not exist. Revised direction (this plan, §8): there is no separate backup
  system to restore from — Firebase itself is the store, and "restore" means
  re-syncing the encrypted Firestore data onto a device. That is the fix
  this plan designs; it does not add snapshots or exports.

### 3.4 UI needs modernising

- Secrets are displayed in full, in bold, on the list row; tapping anywhere
  copies the secret to the clipboard with no masking, no reveal control, no
  clipboard expiry, and no confirmation of what was copied.
- `AddItemModal` initialises its state from props once and never resyncs, so
  editing a second item can show the first item's values; it has no
  validation, no secure-text field, and no generator.
- Navigation props are untyped (`any`), the user object is copied into
  route params and goes stale, and screens carry inline styles alongside
  `GlobalStyles`, whose single blue palette has no dark mode, no spacing or
  typography scale, and no semantic tokens (success/warning, surfaces).
- There are no loading, empty, error, or offline states: failures are
  `console.log` and an empty list. No accessibility labels, no haptics, no
  empty-state guidance beyond "tap +".
- Maestro covers only anonymous login and adding an item. There is no E2E
  coverage for restore, migration, locking, or sync. (The anonymous login
  flow is removed by this plan — see §4.2 — so that flow is replaced, not
  extended.)

## 4. Target product: what "fully fledged" means here

Scope is deliberately 1Password/LastPass-shaped, cut to what this codebase
can reach in phases (§11). Anything not listed is a non-goal until re-planned.

### 4.1 Vault model: key–value pairs only

There is exactly one item shape — the key–value pair the app already has.
No other field sets are added, in any phase of this plan.

| User field | Meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| Key        | The name/label of the item (today's `name`).                 |
| Value      | The secret to remember and use frequently (today's `value`). |

Both fields are encrypted together in a single ciphertext payload (§6.1).
There are no usernames, URLs, notes, custom fields, TOTP seeds, cards,
identities, or any other per-type fields. If a user needs to remember a
username or a URL, they store it as another key–value pair, as today.

System metadata — not user fields, and containing no user content — is the
only other data on an item: a stable UUID (identity is the UUID, never the
key text, so two items may carry the same key text and stay distinct),
`version`, `createdAt`/`updatedAt`, and a `deletedAt` tombstone for
soft-delete (§8). There are no folders, collections, tags, favourites, or
per-item history. Search is over decrypted keys on the device, after
unlock (§6.3).

### 4.2 Feature set by release

| Capability         | V1 (this plan's end state)                                                                                                                                                                                                                                                                         | Later / non-goal                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vault              | Unlock with master password + biometrics, auto-lock, multi-device sync, offline access                                                                                                                                                                                                             | Browser extension, desktop app, CLI                                                                                                   |
| Generate & health  | Configurable password/passphrase generator, strength meter, reuse/weak/old report                                                                                                                                                                                                                  | Breach monitoring (HIBP k-anonymity, opt-in, §12 D5)                                                                                  |
| Storage / restore  | Encrypted key–value items saved directly in Firestore — Firebase is the store. No separate backup system or snapshots. One narrow migration-only plaintext-CSV export/import exists (§10.8) and is not a backup feature. Restore means re-syncing the encrypted Firestore data onto a device (§8). | General exports, snapshots, and separate backup systems (only if re-requested)                                                        |
| Autofill           | In-app copy + reveal with expiry                                                                                                                                                                                                                                                                   | Native iOS Credential Provider / Android Autofill (Phase 6 spike)                                                                     |
| Auth               | Firebase Auth for membership (Google, Apple, Facebook, email/password) + separate master password for the vault; account recovery via recovery key only. **Anonymous sign-in is removed** — no anonymous option, no anonymous vaults.                                                              | Passkeys, hardware security keys, SSO                                                                                                 |
| Follow-up (not V1) | —                                                                                                                                                                                                                                                                                                  | Sharing with other people, and organising (folders, tags, favourites, collections). Deferred; see §7. Nothing in V1 presupposes them. |

### 4.3 Non-negotiable product rules

1. **Only encrypted data is stored in Firebase.** The server never sees a
   master password, vault key, item key, or plaintext key or value.
   Firestore holds only ciphertext, wrapped keys, public device keys, and
   the non-content system metadata named in §6 (UUID, version, timestamps,
   `schemaVersion`, `algorithm`) — nothing more. No plaintext key, value,
   tag, search index, or user content appears in any Firestore document,
   document ID, filename, log, or Analytics event. The sole exception to
   this rule is the on-device plaintext CSV migration file in §10.8,
   which is never in Firebase, never logged or uploaded, and
   user-managed with mandatory warnings.
2. Forgetting the master password **and** losing the recovery key means the
   vault is unrecoverable. The app must say this in plain language at setup,
   and must never offer an email "reset" that bypasses it (that would be a
   backdoor, not recovery).
3. **No sharing in V1.** There are no invites, roles, members, or shared
   vaults. Only the user's own enrolled devices may obtain the Vault Key.
   Sharing with other people is a follow-up (§7) and must not be designed
   or half-built in V1.
4. **No anonymous membership.** Firebase login is required before vault
   setup. The anonymous sign-in option is removed from the login UI and
   from all auth flows; existing anonymous users are handled only as in
   §10.6.
5. Deleting is recoverable until the user empties trash: soft-delete first,
   hard-delete only from trash. Trash holds tombstoned ciphertext for 30
   days (§8); there is no snapshot to roll back to, and emptying trash or
   deleting the account is permanent — the UI must say so.

## 5. Target security architecture (zero-knowledge)

### 5.1 Principles

- **Envelope encryption, AEAD everywhere.** Every secret is encrypted with a
  random per-item key under an authenticated cipher; keys are wrapped, never
  stored in cleartext. No RSA bulk encryption anywhere in new code.
- **Never roll custom crypto.** Use audited primitives only, with known
  test vectors pinned in tests. Any new dependency needs a review note on
  audit status, maintenance, and React Native support before adoption.
- **Keys live in hardware where possible;** where the platform cannot prove
  that, the residual risk is documented (§5.4) rather than hidden.
- **Fail closed.** A decrypt failure quarantines that item and shows an
  error; it never downgrades to plaintext (fixing S7), never hides the whole
  vault (fixing §3.2), and never logs the payload.

### 5.2 Key hierarchy

```text
Master Password ──Argon2id(salt)──► Master Key (memory only, wiped on lock)
                                        │ wraps
                                        ▼
                          Vault Key (random 256-bit, one per user)
                       ┌──────────────────┼──────────────────┐
                       │ wraps            │ wraps            │ wraps
                       ▼                  ▼                  ▼
                  Item Key 1 ──►    Item Key 2     Vault Key for
                  (per item)        (per item)     a new device
                       │                  │
                       ▼                  ▼
                 Item ciphertext    Item ciphertext
                 (AEAD, random      (AEAD, random
                  nonce, AAD)        nonce, AAD)
                  (encrypts key      (encrypts key
                   + value)           + value)
```

- **Master Key:** derived on unlock with Argon2id from the master password
  and a per-account salt stored in Firestore (a salt is not secret). The
  Master Key is never persisted and never leaves the device. A separate
  password verifier (e.g. a hash of the Master Key) stored server-side lets
  the app detect a wrong master password without attempting a full decrypt.
- **Vault Key:** random 256-bit, generated once per user. Stored only in
  wrapped form: wrapped by the Master Key, wrapped once per authorised
  device key (the user's own devices only — there is no sharing in V1),
  and wrapped by the recovery key (§5.5).
- **Item Key:** random per item, wrapped by the Vault Key. Each item's
  ciphertext encrypts its key and its value together, under its Item Key.
- **Device Key:** per-device asymmetric keypair for enrolment of the
  user's own devices. The public key is registered in Firestore; the
  private key stays on the device (§5.4).

### 5.3 Algorithms and libraries — decision gate, not a guess

| Purpose                       | Recommendation                                                                                   | Gate before use                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symmetric encryption          | XChaCha20-Poly1305 (192-bit nonce, misuse-resistant, no nonce-reuse fragility from short nonces) | Spike: confirm `@noble/ciphers` (or equivalent audited lib) passes KATs on iOS + Android release builds, including long values. AES-256-GCM via WebCrypto is the fallback only if the spike fails, with nonce discipline documented.                                             |
| KDF                           | Argon2id (OWASP parameters)                                                                      | Spike: benchmark on a low-end Android device; if no maintained React Native Argon2id binding exists, use PBKDF2-HMAC-SHA256 at OWASP iteration counts via `expo-crypto` and record the downgrade explicitly. Never use plain SHA-256, bcrypt with low cost, or a home-grown KDF. |
| Asymmetric (device enrolment) | X25519 key exchange (sealed-box style wrapping)                                                  | Same spike: confirm `@noble/curves` on device; Ed25519 signatures for device enrolment approval if the enrolment design needs them.                                                                                                                                              |
| Randomness                    | `expo-crypto.getRandomValues` (CSPRNG) only                                                      | Grep gate: no `Math.random` anywhere near crypto; add a lint/dependency-cruiser rule.                                                                                                                                                                                            |
| Hashing / blind index         | SHA-256 / BLAKE2 via audited lib                                                                 | Only for the optional blind search index in §6.3, never for passwords.                                                                                                                                                                                                           |

RSA-OAEP and `node-forge` are **legacy-decrypt only** after Phase 2 (§10.4):
kept in a clearly named `LegacyCrypto` module, read-only, deleted in the
cutover phase. No new code may call it to encrypt.

### 5.4 Device keys, biometrics, and locking

- Each device generates its device keypair on first unlock and registers
  the public key under `devices/{deviceId}` (see §6). Spike first whether
  the private key can be held non-extractably: iOS Keychain
  (`ThisDeviceOnly` + biometry) and Android Keystore are the target;
  evaluate `react-native-keychain` vs `expo-secure-store` options
  (`requireAuthentication`, keychain accessibility) and record what each
  platform actually guarantees. Until hardware backing is proven, treat
  device keys as "SecureStore-held, exportable by a privileged process"
  and say so in the threat model.
- Biometric unlock wraps the Master Key with a hardware key so Face ID /
  fingerprint can re-derive it without retyping the master password; it
  never stores the master password itself. Biometrics must be re-prompted
  after any Master Key rotation and can be revoked per device.
- Auto-lock: configurable (1 / 5 / 15 minutes, immediately on background).
  Locking wipes the Master Key, Vault Keys, and decrypted items from memory,
  clears the clipboard if the app set it, and shows the lock screen on
  foreground. Sensitive actions (delete account, revoke device, reveal
  recovery key, change master password) require fresh unlock/re-auth.
- Hardening: disable screenshots / screen recording of secret surfaces
  (`FLAG_SECURE` on Android, blur on iOS backgrounding), mask secrets by
  default with an explicit reveal (with auto re-mask), auto-clear the
  clipboard 30–60s after copy, and never put secrets in screenshots,
  previews, or the app-switcher preview image.
- **Remove S5 entirely:** no `console.log` of values, keys, or ciphertexts
  in crypto/storage paths; Analytics events carry no item keys or counts
  that identify content. Add a CI grep gate for `console.log` in
  `component/Core/` (the existing `deps:check` pattern is the model).

### 5.5 Recovery

- At setup, generate a random 256-bit recovery key, display it once, and
  require the user to confirm they saved it (retype a check fragment).
  The wrapped Vault Key under the recovery key is stored in Firestore;
  recovery = Firebase Auth sign-in + recovery key entry on any device,
  which provisions that device and rotates nothing else.
- Changing the master password re-wraps the Vault Key and re-issues the
  recovery key flow (old recovery key stops working; say so). There is no
  "forgot master password" email flow — see rule 2 in §4.3. Support copy
  must never ask for, or accept, a master password or recovery key.

### 5.6 Threat model (what this design does and does not defend)

| Attacker                               | Defence in this plan                                                                                                           | Residual / out of scope                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Curious server / leaked Firestore dump | Ciphertext + wrapped keys only; keys and values encrypted; rules enforce ownership (§6)                                        | Metadata that remains (counts, timestamps, device names) is minimised and listed in §6; traffic analysis is out of scope. |
| Stolen locked device                   | Hardware-backed keys + auto-lock + no plaintext at rest (cache holds ciphertext only)                                          | An unlocked/rooted device with the vault open is out of scope; document it.                                               |
| Revoked device                         | Device approval + Vault Key rotation on device revoke; server cannot mint envelopes without an authorised device's wrapped key | A device that copied secrets before revocation cannot be "un-seen". Say so in the UI.                                     |
| Network attacker                       | TLS (Firebase) + AEAD + AAD binding items to item ID/version                                                                   | Client compromise (malicious keyboard, overlay) is platform-scope, not app crypto.                                        |
| Insider / support                      | Zero-knowledge: no support tool can decrypt; no master-password reset                                                          | Account deletion is permanent with no post-deletion restore (§8); the flow must make that unmistakable.                   |

## 6. Data, sync, and storage architecture

### 6.1 Schema v2 (one personal vault per user; legacy collections untouched until §10)

Every item is one document under the owning user. There is no separate
vaults collection, no members collection, and no backup/snapshot
collection: the user's encrypted items in Firestore are the store (§8).

`schemaVersion: 2` and `algorithm` fields on every document let old and new
readers coexist during the migration window and let the app refuse unknown
future versions instead of mis-decrypting them. An item's `ciphertext`
encrypts its key and its value together, in one payload — Firebase never
holds either field in cleartext.

```text
users/{uid}
  profile: { schemaVersion, migrationState, kdfSalt, passwordVerifier,
             createdAt, updatedAt }          # crypto params only, no user content
  devices/{deviceId}
    { publicKey, platform, deviceName, createdAt, lastSeenAt, revokedAt }
  keyEnvelopes/{envelopeId}
    { wrappedVaultKey, wrappedFor: deviceId | "recovery",
      algorithm, createdAt }
  items/{itemUuid}
    { ciphertext, nonce, wrappedItemKey, algorithm,
      version, createdAt, updatedAt, deletedAt, createdByDeviceId,
      migratedFrom?: legacyDocId | "csv-export" }
```

The one-time legacy archive created in §10.2 is the only other collection
that holds user-related data: verbatim, still-encrypted copies of legacy
documents in Firestore, created solely as a migration safeguard. It is not
a product backup feature and is deleted at cutover (§10.7).

Design rules:

- Document IDs are random UUIDs. Never derive an ID from key text or an
  email, and never store a key or value in cleartext — fixing S6.
- The legacy `Items` and `UserSettings` collections keep their current
  shape and rules until cutover. No migration step renames, moves, or
  rewrites a legacy document in place; v2 items are new documents.
- Every Firestore write that changes device enrolment, Vault Key rotation,
  or key envelopes uses a transaction/batch so a half-applied enrolment or
  rotation cannot strand the vault. Ordinary item edits are
  single-document writes with an incrementing `version`.
- Zod contracts in `Contracts.ts` are extended (not edited in place for v1):
  `VaultItemContractV2`, `KeyEnvelopeContract`, `DeviceContract`.
  `.strict()` stays on; unknown fields fail. Until the crypto spike lands,
  contracts must reject any document without `algorithm` + `schemaVersion`.

### 6.2 Sync and offline

- Source of truth is Firestore; the device keeps a **ciphertext-only**
  local cache (spike: `expo-sqlite` vs MMKV, §12 D4 — either way the cache
  holds ciphertext and wrapped keys only, never plaintext or the Master
  Key). The cache is what makes offline use and fast launch possible; it
  must be wipeable from Settings and on sign-out, and it must be encrypted
  at rest by the platform store where the engine supports it.
- Live sync via `onSnapshot` on the user's `items` collection (replacing
  one-shot `get()`), with a visible sync state (synced / syncing / offline /
  error) and a manual retry. Writes made offline queue locally with
  `updatedAt` + `version` and flush in order; the queue survives app
  restarts.
- Conflicts: last-writer-wins by `(version, updatedAt)` is the default, but
  a dirty local edit that conflicts with a newer server version is **never
  silently overwritten** — both versions are kept, the conflict is surfaced
  in the item detail screen, and the user picks which to keep (the loser is
  then tombstoned; no history is retained). Deletes are tombstones
  (`deletedAt`, retained 30 days) so a delete on one device does not
  resurrect or vanish items on another.
- Reads are per-item fault-isolated: one undecryptable item is quarantined
  (§10.5) and the rest of the vault still loads — the opposite of today's
  `Promise.all` failure mode.

### 6.3 Search without leaking names

Today's plaintext prefix `searchIndex` must go. Options, in order of
preference:

1. **Client-side search after unlock** (recommended for V1): decrypt items
   in memory, filter on the decrypted keys locally. Simple, zero leakage,
   fast enough for a personal vault; measure on a 1,000-item vault in the
   spike.
2. **Blind index** (only if option 1 measures too slow): HMAC-SHA-256 of
   key tokens under a dedicated search key, truncated prefixes stored
   server-side. Document that it leaks equality/prefix patterns, rotate the
   search key on Vault Key rotation, and never index values.

### 6.4 Firestore rules and App Check

- Rewrite `firestore.rules` for v2: a caller may read/write only documents
  under their own UID — their own items, devices, and key envelopes — and
  nothing under another user's UID. Rules must also validate field types
  and reject writes missing `algorithm` / `schemaVersion`, and must keep
  the current legacy `Items` rules untouched during the migration window so
  old app versions keep working.
- Rules tests run against the Firebase emulator on every PR
  (`@firebase/rules-unit-testing` or equivalent): owner, stranger, revoked
  device, malformed document, and legacy-rule regression cases.
- Enable App Check (Play Integrity / App Attest) before multi-device ships
  (Phase 4, §11), so envelope/device writes cannot be scripted from an
  arbitrary client with a stolen token alone. App Check is
  defence-in-depth, never a substitute for rules or encryption.

## 7. Sharing — deferred to a follow-up (not V1)

Sharing with other people is **not part of this plan**. There is no sharing
design in V1: no invites, no roles, no members, no shared vaults, no
sharing UI, no sharing Firestore collections or rules, and no sharing
key-wrapping for other users. Device enrolment (§5.4, §6) covers the
user's own devices only and must not be generalised into sharing.

A follow-up that wants sharing must re-open this plan and design it from
scratch: recipient identity resolution, invite/accept, roles, key-wrapping
for recipients, revocation with Vault Key rotation, and an audit trail —
with its own threat review. Nothing in V1 may presuppose it: no `members`
collection, no `role` field, no invite endpoint, and no UI affordance that
implies an item can be shared.

## 8. Firebase is the store: sync and restore (no separate backup system)

This section is the fix for §3.3. There is deliberately **no separate
backup system**: no snapshots, no backup service, no backup retention.
The only export/import is the migration-only CSV bridge in §10.8, which
is not a backup feature. Encrypted items are saved directly in
Firestore on every create/edit, and that Firestore copy — encrypted — is
the store. The local ciphertext cache is a working copy for offline use
and fast launch; clearing it never loses data while the Firestore copy
and the keys are intact. The drills in §14 prove the re-sync below; none
of this ships without them.

### 8.1 Saving: encrypted, directly, every time

Every create/edit encrypts the key–value pair on the device (§5) and writes
the resulting ciphertext document to the user's `items` collection (§6.1)
through the normal sync path. There is no "back up now" action and no
`BackupCadence` behaviour: `BackupCadence` as a user-facing setting is
retired, the field is left untouched until cutover, then removed from
contracts in a later release (see §10.7). Sync is continuous (§6.2), so a
saved item is in Firebase as soon as the device is online.

### 8.2 Restore = re-sync from Firebase

"Restore" in this plan has exactly one meaning: a signed-in, unlocked
device downloads its encrypted items from Firestore and decrypts them
locally. It is the flow for a new device, a reinstalled app, or a cleared
cache. (The old "Backup Restore" button in Profile was dead — it only
logged an event — and has been removed; a restore entry point must be
added anew when restore is implemented — see §10.3.)

1. Firebase sign-in (no anonymous option, §4.3 rule 4), then unlock with
   the master password or the recovery key (§5.5). A new device completes
   device enrolment first, so it holds a Vault Key envelope.
2. The app downloads every document in the user's `items` collection and
   attempts to decrypt each one locally, showing progress and a report:
   N items in Firebase, M decrypted, Q undecryptable (quarantined, listed
   by ID only, per §10.5). Nothing is written to Firebase during the
   download itself, other than the enrolment envelopes from step 1.
3. The merge into the local cache is **non-destructive**: items are matched
   by UUID + `version`; a remote item never deletes a local item that has
   no tombstone, and a newer local edit is never overwritten by an older
   remote one without the conflict handling in §6.2.
4. **Verification:** the local item count must equal the Firestore count
   (minus tombstones the user has chosen to hide), and every item must have
   passed a decrypt attempt. Any mismatch shows an error the user can act
   on (retry, check the device enrolment, contact no one with secrets);
   the merge is not committed, the local cache keeps its prior state, and
   restore never writes to the Firestore copy.
5. What restore cannot do must be stated in the UI: if the master password
   and the recovery key are both lost, the Firestore ciphertext cannot be
   decrypted by anyone, and there is no snapshot or other copy to roll
   back to. That is the consequence of the no-separate-backup direction,
   and the recovery-key ceremony (§5.5) is the only mitigation.

### 8.3 Trash (the only "undo" in V1)

Deleting an item soft-deletes it: the document stays in Firestore with
`deletedAt` set (a tombstone, §6.2) for 30 days, hidden from the list, and
restorable from Trash by clearing `deletedAt` with a version bump. Emptying
Trash hard-deletes the documents. Emptying Trash is permanent — there is
no snapshot to restore from — and the confirmation copy must say so.

### 8.4 Account deletion, done safely

Deletion today removes Firestore items and the Firebase user while stating
"data will still be available in your phone" — which is false once the key
is gone and dangerous in both directions. That message is removed. New
flow: require fresh unlock and explicit confirmation stating that deletion
is permanent and there is no backup copy; revoke all devices, delete the
items, key envelopes, devices, and profile documents, then delete the
Firebase user. No final snapshot is taken and there is no grace-period
restore: the user must understand before confirming that this cannot be
undone.

## 9. UI / UX modernisation

Modernisation is a re-architecture of the interface around the vault model,
not a reskin. It runs as a parallel track from Phase 2 (§11) but must not
ship secret-handling screens on top of the legacy crypto.

### 9.1 Design system

- Extend `GlobalStyles.tsx` into tokens before any screen is rebuilt:
  colours (light + dark, semantic: surface, border, text-primary/secondary,
  success, warning, danger), spacing scale, radius scale, typography scale,
  elevation. No new hardcoded hex values in screens; no new inline style
  objects in render (the existing project convention). Dark mode follows
  the OS setting with a manual override in Settings.
- Shared primitives first: `Button`, `TextField` (with masked/secure
  variant), `Sheet` (bottom sheet for detail/edit), `EmptyState`,
  `ErrorState` with retry, `LoadingState`, `SearchBar`, `ItemRow`. Screens
  compose primitives; primitives carry the accessibility labels, hit
  targets (≥44pt), contrast, and Dynamic Type behaviour once.
- Motion: sheet transitions, reveal/mask animation, copy confirmation, and
  haptics on copy/lock/unlock only — no decorative animation on secret
  surfaces.

### 9.2 Navigation and screens

Typed navigation throughout (replace `any` route props; param types live in
`DataModel.tsx` per project convention). Proposed structure:

```text
Root stack: Onboarding → Lock → Main tabs → Sheets
  Onboarding:   welcome, create-account / sign-in, set master password,
                recovery-key ceremony, first item + generator tour
  Lock:         master-password / biometric unlock, recovery-key entry,
                "locked, vault wiped from memory" state
  Main tabs:    Vault | Generator | Settings
    Vault:      list (search over keys), item detail sheet
                (masked key/value, reveal, copy, delete),
                add/edit sheet (key/value fields, generator inline, validation)
    Generator:  length/charset/passphrase options, strength meter; a
                generated password lives only while the sheet is open
                (then gone unless saved as an item)
    Settings:   lock timeout, biometrics, devices (rename/revoke),
                restore from Firebase (§8), CSV import (§10.8), trash,
                account & deletion, security report (reuse/weak/old), about
```

- Every screen has defined loading / empty / error / offline states; list
  rows show a sync badge only where sync state is real (§6.2). Error copy
  never includes ciphertext, keys, or stack traces.
- Accessibility pass per screen: labels on every icon button (today's edit/
  delete/copy icons have none), focus order in sheets, sufficient contrast
  in both themes, and no colour-only meaning (e.g. "Copied" state).

### 9.3 Secret-handling interactions (the trust surface)

- Secrets are masked by default everywhere. Reveal is per item, per-tap,
  auto re-masks after 15s or on blur/background. Copy is an explicit button
  (not "tap the row"), shows that the value was copied, and clears the
  clipboard after 30–60s. Row tap opens detail; it never copies.
- The generator never auto-saves and never logs: a generated password the
  user does not save is gone when the sheet closes, and the UI says so.
- The security report is computed on-device only: reuse (same password
  ciphertext comparison is impossible — compare hashes of the _decrypted_
  values in memory, never store a plaintext index), weakness (length/
  charset rules), and age (90/180 days). Breach checking stays out until
  decision D5.

## 10. Migration plan: no user loses data

This is the load-bearing section. Read it as a checklist with gates: each
step's exit criteria must be met before the next step starts, and the
rollback for each step is "the old app version keeps working", never "hope
the new code is right". The automatic job in §10.5 is the primary path;
§10.8 describes the user-initiated plaintext-CSV bridge that runs
alongside it.

### 10.1 Invariants (never violated, in any phase)

1. **Never delete, never rewrite in place.** Legacy documents are read,
   copied, and verified. They are marked (a non-payload field such as
   `migrationState` on the _user profile_, never a mutated legacy item)
   only after a verified v2 copy exists. Deletion happens once, in §10.7,
   after retention + user-visible confirmation.
2. **Only the originating device can migrate an item.** Decryption needs
   that device's RSA private key. No server, Cloud Function, or other device
   ever receives the private key or a decrypted value to do it.
3. **Every legacy document is accounted for.** At any checkpoint:
   `legacyTotal = migrated + quarantined + stillPending` (duplicate key
   text counts inside `migrated` — each legacy document is a separate
   item, §10.5).
   An unaccounted document blocks cutover. Counts are computed from metadata
   (doc IDs, `encrypted` flags, timestamps) — migration tooling never logs
   names or values.
4. **Old app versions keep reading legacy data** for the whole migration
   window. Firestore rules for `Items`/`UserSettings` do not change until
   cutover, and v2 writes never depend on legacy reads succeeding.
5. **Migration is resumable and idempotent.** A killed app, dead battery,
   or failed batch re-runs and converges; re-running it never duplicates an
   item (UUID + `migratedFrom` dedupe).
6. **No silent downgrades.** The S7 behaviour (invalid payload → treat as
   plaintext) is removed before migration starts; undecryptable items go to
   quarantine (§10.5), never into the vault as readable values.

### 10.2 Phase 0 — Inventory and safety net (read-only, before any change)

1. **Inventory (metadata only):** count, per user cohort, of legacy `Items`
   docs: total, `encrypted: true/false/missing`, missing `timestamp`, and
   duplicate names under one `userId`. Count anonymous vs signed-in owners
   and users with no `UserSettings`. No values are read by the inventory.
2. **Legacy archive (one-time, in Firebase, not a backup feature):** a
   one-off, reviewed script (run against prod only after an emulator dry
   run) copies every legacy `Items`/`UserSettings` document verbatim into
   a new, owner-only `legacyArchive/{archiveId}` collection in Firestore,
   with a manifest of counts + per-document hashes. The archive exists
   solely so the migration (§10.5) can be verified and, if needed,
   re-attempted; it is not a user-facing backup, restore, or snapshot
   system, access is restricted and logged, the script itself is committed
   to the repo and reviewed like prod code, and the archive is deleted at
   cutover (§10.7).
3. **Fixture corpus in the emulator:** seed documents reproducing every
   legacy shape found — RSA-2048 ciphertext, 512-bit test ciphertext,
   plaintext value with `encrypted: false`, missing `encrypted`, corrupt/
   truncated base64, duplicate names, missing timestamp, and an item whose
   value exceeds the RSA limit (already broken today: prove it fails
   loudly, not silently). All later phases prove themselves against this
   corpus first.
4. **Decisions + kill switch:** confirm §12 decisions; ship a
   Remote Config / `UserSettings` flag (`cryptoSchemaVersion`, `migrationState`)
   that can disable v2 writes and migration for all users without an app
   release. _Exit criteria:_ inventory + archive manifest signed off;
   corpus tests green; flag in place.

### 10.3 Phase 1 — Make Firebase re-sync restore work for the legacy format (before crypto)

Implement a real re-sync restore for v1 data — `restoreFromFirestore` —
with a new entry point in Profile (the old "Backup Restore" button did
nothing and has been removed): on a device that still holds its legacy key, it
re-downloads the user's legacy `Items` documents from Firestore, decrypts
them locally, and reports counts (N in Firebase, M decrypted, Q
undecryptable/quarantined), merging non-destructively into the local view
per §8.2. There are no snapshots to list and no replace/merge choice
against a backup: the Firestore copy is the source of truth. Prove it with
a Maestro drill: seed → clear the local cache → re-sync → counts and
values match; and corrupt one remote item → quarantine, rest still load.
Fix `backupLocalStorageToFirestore` or delete it: its encrypted branch
must not return decrypted items, and if the `_ali_` legacy keys are
confirmed empty for all cohorts it is removed with its tests updated, not
silently left. _Exit criteria:_ the re-sync drill passes in the emulator
and on a real device build; the dead Profile dropdown code is removed (the
cadence picker that discards its own result, and the `BackupCadence`
setting with it). This phase ships alone: users get a working re-sync
before anything cryptographic changes.

### 10.4 Phase 2 — Crypto v2 alongside legacy (dual-read, write-new)

1. Ship the new crypto module (§5.3) behind the kill switch, with KATs,
   tamper tests, and wrong-key tests that use real primitives (fixing S10).
   `Security.ts` is renamed in place to `LegacyCrypto.ts` (decrypt-only
   after this phase) — no call site other than the migration job may
   import it, enforced by dependency-cruiser.
2. On next unlock, new/returning users go through master-password setup
   (§5.5 recovery ceremony) and Vault Key provisioning. Existing signed-in
   users are prompted, not forced, and can keep using the legacy vault
   until they set up; new items they create after setup are v2-only.
3. Reads become dual: try v2 vault first; fall back to legacy `Items`
   with per-item fault isolation (fixing the `Promise.all` failure). Writes
   never touch legacy docs.
4. **Remove anonymous sign-in in this phase:** delete the "Continue
   anonymous" option and the `signInAnonymously` path from the login UI
   and auth flows, and remove the anonymous Maestro flow. No new anonymous
   accounts can be created from this build on. Existing anonymous users
   cannot set up a v2 vault until they link a Firebase login (§10.6).
   _Exit criteria:_ new-item round-trip + tamper rejection proven on
   device; legacy vault still fully readable in the same build; no
   anonymous sign-in path remains in the build; kill switch verified to
   stop v2 writes.

### 10.5 Phase 3 — The migration job (re-encrypt, verify, quarantine)

This is the primary migration path; the CSV bridge in §10.8 is a fallback
for cases this job cannot reach. Runs on the originating device, only
while unlocked, in resumable batches
with a progress screen the user can pause. For each legacy document:

1. Read the legacy doc. If `encrypted` is false/missing or the payload
   fails the base64/format check: treat as **legacy plaintext** — encrypt
   it directly under v2 (never attempt RSA decrypt on it; that is the S7
   trap). Record `migratedFrom` on the v2 item and `legacyKind: plaintext`
   in the accounting record only (never as a field that implies the v2
   item itself was ever plaintext).
2. If encrypted: RSA-decrypt with the device's legacy key. On success,
   encrypt under v2 with a fresh item key, write the v2 item, then
   **read it back and decrypt it** and compare with the legacy plaintext
   held in memory. Only on a match is the legacy doc marked migrated in
   the accounting record (not by editing the legacy doc).
3. On any decrypt/verify failure: write a quarantine record
   `{ legacyDocId, reason, at }` — no value, no name — keep the legacy doc
   untouched, and continue with the rest. Quarantined items appear in a
   "Needs attention" list with the options: retry on this device, or
   re-enter the value manually (creating a new v2 item). There is no export
   of legacy ciphertext. A quarantine count > 0 blocks that user's
   cutover, never the whole release.
4. Duplicate key text is **not** merged: identity is the UUID (§4.1), so
   each legacy document becomes its own v2 item even if another item
   carries the same key text. The accounting counts every legacy document
   separately, and the user may delete any unwanted duplicate afterwards
   like any other item — never silently drop one.
5. Oversized values that RSA could never have encrypted (S1) surface as
   quarantine reason `undecryptable-legacy-limit` with manual re-entry;
   do not pretend they can be recovered.

_Exit criteria per user:_ `migrated + quarantined + stillPending = legacyTotal` (pending must be 0 at cutover),
every migrated item verified by round-trip, quarantine list reviewed.
_Release gate:_ the job is proven against the §10.2 corpus plus a
staged rollout (internal → 1% → 10% → 100%) with per-cohort accounting
dashboards (counts only) and the kill switch armed.

### 10.6 Cohorts that need special handling

| Cohort                                                      | Handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-in, one device                                       | Standard job (§10.5). Set up master password + recovery key first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Signed-in, multiple devices                                 | Migrate on the device holding the key, then enrol other devices (§6/§11 Phase 4) so they receive the Vault Key envelope. Until enrolment, other devices show "waiting for your other device" — they must not generate a second vault.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Anonymous users (existing only; sign-in removed in Phase 2) | Anonymous sign-in is removed (§4.3 rule 4, §10.4). An existing anonymous user must link a Firebase login (Google/Apple/email/password) **before** migration; the app prompts them on every launch, explains that an anonymous vault dies with the device key and has no membership to migrate under, and offers the link flow first. They may export a plaintext CSV while still anonymous (§10.8), then link, then import after updating. Until linked, they cannot create a v2 vault and keep using the legacy vault in the old version only. If they never link, their legacy documents stay in the §10.2 archive until cutover and are then deleted with the legacy collection (§10.7) — that consequence must be stated plainly, with at least 30 days' notice in the app, and must never happen silently. |
| Key already lost (reinstall / cleared SecureStore)          | Cannot be migrated — the ciphertext is unrecoverable and the plan must say so. Offer: keep the ciphertext in the §10.2 archive until cutover, start a fresh vault, and show a one-time honest message instead of a fake restore. No Firebase re-sync can recover it. Do not let this cohort block others.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Users on old app versions                                   | They keep reading legacy docs throughout the window (§10.1.4). In-app update prompt appears once migration is available for them; force-upgrade only at cutover, with 30 days' notice in the app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Sharing / family use today                                  | None exists (no sharing) — no shared-migration path is needed. Sharing is a follow-up (§7) and is not built on top of migrated data in this plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 10.7 Phase 4 — Cutover and cleanup (only after the accounting closes)

1. When a user has zero pending items and has acknowledged (or the release
   has waited out) any quarantine, their reads flip to v2-only and legacy
   docs become invisible to the app (still present in Firestore).
2. After the global window closes and the accounting identity holds for
   every cohort: verify the §10.2 archive counts against the inventory,
   then delete the legacy docs from `Items` in batches with a per-batch
   count check, and delete the archive itself. `UserSettings.backup` is
   retired from contracts in this same release train, with a
   data-migration note in the release.
3. `LegacyCrypto` decrypt-only support stays for one further release as a
   safety net for stragglers, then is removed with `node-forge` if nothing
   else needs it. The Firebase re-sync restore, the v2 contracts, and no
   anonymous sign-in path are by then the only data/auth paths.
4. **Rollback at every step:** because legacy docs are never mutated and
   v2 docs are additive, rollback is "ship the previous build / flip the
   kill switch". The only irreversible step is §10.7.2 deletion, which is
   why it is last, counted, and archived first. A rollback runbook (flags,
   build numbers, archive IDs, who can flip them) is written in Phase 0
   and rehearsed once in the emulator.

### 10.8 CSV export/import migration path (decided — plaintext, user-managed)

Described last for readability; it ships first. The decisions behind this
section are settled: the new design is an update to this same app, the
export file is a **plaintext CSV with warnings**, and after import the file
is **left for the user to delete** — the app never deletes it
automatically. This section is written on exactly those terms.

The CSV path is a user-initiated bridge, not a replacement for the
automatic job in §10.5. Users who update in place on the originating
device are migrated by §10.5 without ever touching a file, and they must
never be required to export first. The CSV path exists for the cases the
automatic job cannot reach: a reinstall or new device after the file was
exported, a device where the automatic job quarantined items, and an
anonymous user who exports before linking (§10.6). If the CSV were the
only path, anyone who updated without exporting first would be stranded —
so §10.5 stays primary and §10.8 stays a fallback. Export also cannot
rescue a key that is already lost: it needs the same originating device
and legacy key as §10.5.

#### 10.8.1 CSV format (exact spec — no variations)

- Encoding UTF-8, line endings LF (CRLF accepted on import, BOM stripped),
  RFC 4180 quoting: fields containing a comma, quote, or newline are
  double-quoted, and a literal quote inside a field is doubled.
- Exactly one header row, exactly two columns, in this order:

  ```csv
  key,value
  "example key","example value, with a comma"
  ```

  The example values are illustrative only; no real secret may appear in
  code, tests, or docs. No extra columns, no UUID/version/algorithm
  columns, and no keys of any kind in the file — it holds only keys and
  values, in cleartext.

- Keys and values are preserved exactly as decrypted, including spaces
  inside quoted fields. Blank lines are skipped. A row is malformed and
  rejected if it does not parse as exactly two fields, or if its key or
  its value is empty (the legacy app never saved an empty key or value).
  Malformed rows are listed by line number in the import report (§10.8.4);
  they never silently alter neighbouring rows.
- The file carries no provenance: the import cannot tell who wrote it, when
  it was written, or whether it was edited. A hand-edited file is treated
  as the source of truth for its rows, so the warnings must tell the user
  not to edit it.

#### 10.8.2 Export (old build, before the update)

1. **Preconditions.** The originating device, signed in to Firebase, with
   its legacy RSA key present. Export is read-only: it decrypts legacy
   items in memory, writes the file, and touches nothing in Firestore.
2. **Entry point.** Profile → "Export items to CSV", offered proactively
   in the release before the new build ("Moving devices, or reinstalling?
   Export first") and kept in Settings. The export ships in Phase 1
   (§11), before the new build, or it cannot help anyone.
3. **Warning screen (mandatory, not dismissible fine print).** Before any
   decryption the user must see and explicitly confirm, in plain language:
   the file will contain every key and value in cleartext; anyone who can
   open the file can read every secret; the file stays on the device until
   the user deletes it, and the app will not delete it; do not email it,
   upload it to cloud storage, or share it; delete it from Files and from
   Trash/Recently Deleted after a successful import; operating-system and
   cloud backups may keep copies the app cannot remove. The confirm button
   is labelled to match ("Export plaintext CSV"), never just "Continue".
4. **Write.** Decrypt each legacy item in memory on the device and write
   the CSV to a location that survives an App Store / Play update and is
   readable by the new build and by the user in Files (spike: verify the
   exact directory / share-sheet copy on real iOS and Android builds
   before shipping; the export must not write to a cache directory the OS
   may purge). The user is shown the file name and location. Undecryptable
   items are excluded, counted, and named in the on-screen report only
   with the names already visible in the vault list — never in logs or
   Analytics.
5. **Report.** Counts only: N exported, Q excluded/undecryptable. No key,
   value, or ciphertext appears in logs, Analytics, crash reports, or the
   export code's error messages. The export never uploads the file or its
   contents anywhere.

#### 10.8.3 Transport: the user moves the file; the app never sends it

- **Same device (the expected case):** the file stays in Files/Documents
  across the app update and the new build picks it in §10.8.4.
- **New device:** the user moves the file themselves (for example AirDrop,
  USB, or the Files app). The app provides no email, cloud, or share
  sending for the CSV, and must not default the system share sheet to a
  destination. Warn that moving the file by email or cloud storage creates
  copies that persist after the device copy is deleted, and that those
  copies must be deleted too.
- The app must never upload the CSV or any plaintext item to Firebase, to
  any backend, or to Analytics/crash reporting — at export, in transport,
  or at import. Only v2 ciphertext documents are ever written to
  Firestore (§8).

#### 10.8.4 Import (new build)

1. **Preconditions and entry points.** Firebase login (no anonymous
   option) and a set-up, unlocked v2 vault (§5). Import is offered in
   onboarding when the v2 vault is empty and in Settings → "Import CSV".
   An anonymous user who exported before linking must link a Firebase
   login first (their UID is preserved by linking, §10.6); import into an
   unlinked or anonymous vault is not offered.
2. **Warning screen (again, mandatory).** The same plaintext warning as
   export, repeated at import: the file contains secrets in cleartext,
   import only on a trusted device, and delete the file afterwards. The
   file is picked with the document picker; the app reads it on-device
   only, in memory, and parses it with a strict RFC 4180 parser (§10.8.1).
3. **Pre-import report — before anything is written.** Rows read, rows
   valid, malformed line numbers, and rows that would be skipped as
   duplicates (exact key + value already present in the decrypted vault,
   compared in memory). The user confirms the report before any v2 write.
4. **Write and verify.** Each valid row gets a fresh UUID and a fresh item
   key, is encrypted under v2 (§5), and is written in batches. Imported
   items are marked `migratedFrom: "csv-export"` (not a legacy document
   ID — the CSV has none). Afterwards the app reads the new items back,
   decrypts them, and reports: imported N, skipped duplicates S, malformed
   M (by line). Any mismatch aborts with an error and the items already
   written stay (they are verified v2 items); the user can re-run the
   import, which skips them as duplicates.
5. **After import — the file is left alone.** The app never deletes the
   file, automatically or otherwise. It shows the file name and location
   again, repeats the delete instruction (Files, plus Trash/Recently
   Deleted, plus any email/cloud copies the user made), and may offer a
   button the user taps to delete the picked file — a user action, not an
   automatic one. Re-importing the same file is a no-op: every row is now
   a duplicate and is skipped, so an interrupted or repeated import cannot
   double the vault.
6. **Accounting.** A CSV import does not by itself close the §10.1
   accounting: the automatic job in §10.5 still runs, skips the
   CSV-imported rows as duplicates, migrates any remaining legacy
   documents, and only then can the accounting identity close. The profile
   records the migration method used (`automatic`, `csv`, or both) and the
   CSV import counts, as metadata only.

#### 10.8.5 Security: an explicit, bounded exception — stated, not hidden

The plaintext CSV is the **sole deliberate exception** to §4.3 rule 1
("only encrypted data") and to §5. Its bounds are:

- The exception covers one on-device file, created only by the §10.8.2
  export and consumed only by the §10.8.4 import. It never covers
  Firebase, a server, a log, Analytics, a crash report, or any general
  export feature. There is no plaintext export in the new design beyond
  this migration bridge.
- While the file exists it is plaintext at rest: readable by anyone with
  access to the device, the Files app, or a backup that includes it, and
  it may survive deletion in Trash/Recently Deleted or in cloud copies.
  Once import is offered, the app has no reliable way to know whether
  other copies remain — that is why the decision was to leave deletion to
  the user, and why the warnings must say the app cannot police copies.
- If the file is emailed, shared, uploaded, or lost, treat it as a
  compromise: delete every copy the user can reach and change the
  important secrets it contained. The app cannot know this happened, so
  the warning copy must say it before export, not after.
- Mitigations that do remain, and must not be dropped for convenience:
  in-memory decrypt/parse only, no plaintext in logs/Analytics/errors,
  no upload anywhere, import only after Firebase login + unlock, strict
  parsing with a pre-import report, mandatory warning screens, isolated
  export/import code under the review and test gates in §14, and no
  default share destination.

#### 10.8.6 Edge cases, retirement, and tests

| Case                                          | Behaviour                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key already lost before export                | CSV cannot help (§10.6). Export on a device without the key fails with a plain message, and the user is offered the §10.5/§10.6 paths, not a fake file. |
| Empty file / header only                      | Import reports 0 rows and writes nothing.                                                                                                               |
| File edited by hand                           | Treated as source of truth for its rows (§10.8.1); no provenance check exists and none is claimed.                                                      |
| Very large file                               | Parser and batched writes must handle at least 10,000 rows without crashing; progress is shown and the import is resumable via duplicate-skipping.      |
| Import interrupted (killed app, dead battery) | Re-running the import skips already-written rows; no duplicates.                                                                                        |
| CSV from another manager                      | Not accepted: only the §10.8.1 header and key–value shape are parsed, and only as this migration bridge. Other-manager import is not in V1.             |

**Retirement.** Export ships in Phase 1 and is removed at cutover (§10.7),
when no legacy documents remain to export. Import stays for one further
release for stragglers, then is removed with `LegacyCrypto`. The last
build carrying import must warn users to import — and delete their file —
before updating past it. Removal of the code does not delete files users
already exported; the final warning must say so.

**Tests (in addition to §14).** Parser unit tests over a fixture corpus:
quoted commas/quotes/newlines, CRLF, BOM, blank lines, malformed rows,
empty key/value, duplicate rows, 10,000-row file, header mismatch, and a
file with no header. Maestro drills: export → update → import parity
(counts and decrypted values match, legacy docs untouched by export);
malformed file (quarantine by line, rest import); re-import is a no-op;
and — as a negative check — the file still exists after import, proving
the app did not delete it. Extend the log grep gate to the CSV code:
no key, value, or file contents in logs, Analytics, or error messages.

## 11. Phased delivery plan (order matters)

Do not reorder the first three phases: a safety net, then crypto, then
migration. A UI rewrite on legacy crypto would bake in the flaws this plan
removes. Sharing and organising are deferred (§7, §4.2) and must not be
started as side work inside these phases. Sizes are relative
(S < M < L) for sequencing only — no dates are promised in this plan.

| Phase                             | Scope                                                                                                                                                                          | Size | Exit criteria (all must hold)                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Audit & safety net             | §10.2: inventory, legacy archive, fixture corpus, kill switch, decisions (§12), S11 credential check                                                                           | S    | Archive manifest signed off; corpus green; rollback runbook drafted                                                                   |
| 1. Restore that works             | §10.3: real `restoreFromFirestore` for v1, CSV plaintext export (§10.8), dead-code cleanup, Maestro re-sync drill                                                              | M    | Drills pass on emulator + real device; button does what it says; export warning shown and file location verified to survive an update |
| 2. Crypto v2 + unlock             | §5: crypto spike + module, master password, recovery key, biometrics, auto-lock, dual-read, anonymous removal, CSV import (§10.8), design tokens (§9.1)                        | L    | KATs/tamper tests green on device; legacy vault readable in same build; no anonymous path remains; kill switch proven                 |
| 3. Migration                      | §10.5–10.6: migration job, quarantine UI, staged rollout, accounting dashboard                                                                                                 | L    | Accounting identity holds per cohort; zero unaccounted docs at 100%                                                                   |
| 4. Multi-device + sync            | §6: device enrolment/approval, ciphertext cache, `onSnapshot`, offline queue, conflicts, search (§6.3), rules tests + App Check                                                | L    | Two-device E2E: create on A, appears on B offline, edit conflict surfaces, revoked device cannot obtain the rotated Vault Key         |
| 5. Vault features                 | §4.1/4.2: generator + health report only                                                                                                                                       | M    | Generator + health-report E2E; no sharing, organising, snapshot, or general export code added (CSV bridge only, §10.8)                |
| 6. UI completion + autofill spike | §9.2–9.3 screens, accessibility pass, native autofill feasibility spike (Credential Provider / Autofill)                                                                       | M    | All screens meet §9 states; autofill decision recorded (build vs defer)                                                               |
| 7. Cutover & cleanup              | §10.7: v2-only reads, archive + delete legacy, remove `LegacyCrypto`/`node-forge`, retire `BackupCadence`, retire CSV export (import outlives cutover by one release, §10.8.6) | S    | Archive + count checks pass; old builds warn/upgrade; no legacy import remains in prod code                                           |

```text
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 7
                          │            │             │
                          └─ design tokens ─► UI track (§9) ──► Phase 6 ──┘
```

Release discipline: one phase per release train where possible; every
release carries the kill switch, the accounting counts, and a note in the
release describing what was _not_ migrated yet. No phase ships on a Friday
or without the previous phase's drills re-run.

## 12. Open decisions — confirm before Phase 2

Already decided in this revision (not open): Firebase login only with the
anonymous option removed; key–value pairs only (§4.1); no organising
section; sharing deferred to a follow-up (§7); only encrypted data in
Firebase, with Firestore itself as the store and no separate backup
system (§8); and a plaintext-CSV migration export/import with warnings,
file left for the user to delete, alongside the automatic migration as
primary (§10.8). Do not re-open those as implementation-time choices.

| #   | Decision                                                          | Recommendation                                                                                                                                     | If the other choice wins                                                                                                                     |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Master password + recovery key, or device-keys-only + biometrics? | **Master password** (1Password model). It is the only design that makes multi-device + recovery work without trusting the server.                  | Device-only is simpler but recovery becomes "hope the device survives" — S8 stays. Do not pick it without accepting that in writing.         |
| D2  | Argon2id vs PBKDF2 fallback                                       | **Argon2id if the spike proves a maintained binding**; PBKDF2-HMAC-SHA256 (OWASP counts) otherwise, recorded as a downgrade.                       | Either way the KDF/parameters are versioned in the profile so they can be upgraded later without re-encrypting everything.                   |
| D3  | Sharing                                                           | **Deferred to a follow-up (decided, §7).** No sharing design, code, or rules in V1.                                                                | A follow-up must re-open this plan and design recipient key-wrapping, roles, rotation, and audit from scratch; nothing in V1 presupposes it. |
| D4  | Local cache engine                                                | Spike: **expo-sqlite vs MMKV**, ciphertext-only either way.                                                                                        | The sync/conflict design (§6.2) does not change; only the cache adapter does.                                                                |
| D5  | Breach checking (HIBP k-anonymity)                                | **Opt-in, Phase 5+ only.** Only the first 5 hash chars leave the device, never a password or hash.                                                 | If never wanted, the health report stays reuse/weak/age only. Default off either way.                                                        |
| D6  | Membership gating (FREE/PREMIUM exists but is unenforced)         | Decide whether multi-device is Premium. Code must read it from a single policy module, never hardcode it in screens.                               | Gating after multi-device ships means reworking device flows; decide in Phase 0.                                                             |
| D7  | Separate backup/snapshot storage                                  | **None (decided, §8).** Firestore encrypted documents are the store; no snapshot docs, Cloud Storage backup blobs, or retention policy are needed. | Not applicable — decided. Any future backup feature re-opens §8 and must justify itself against the Firebase-only direction.                 |

## 13. Risks and mitigations

| Risk                                                               | Mitigation in this plan                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Migration loses or corrupts items                                  | §10 invariants, archive-first, round-trip verification, quarantine, staged rollout, kill switch, drills. No step deletes first.                                                                                                                             |
| A device without the legacy key is treated as "migrated"           | Enrolment gating (§10.6): it waits, shows why, and never creates a second vault.                                                                                                                                                                            |
| Crypto library is unaudited / broken on one platform               | Spike gate with KATs on real devices (§5.3); no custom crypto; Stryker must cover the crypto module.                                                                                                                                                        |
| Users forget master password and lose recovery key                 | Plain-language ceremony + confirmation (§5.5); honest unrecoverability message instead of a fake reset.                                                                                                                                                     |
| Revoked device keeps a stale Vault Key envelope                    | Vault Key rotation on device revoke + re-wrap for remaining devices + rotation-pending UI. Residual "already copied" risk is disclosed in-product.                                                                                                          |
| User expects a snapshot/backup rollback that does not exist        | §8 states it plainly in the UI (trash is the only undo; account deletion is permanent) and the recovery-key ceremony is the only recovery path. No silent loss is ever promised away.                                                                       |
| Rules regression locks users out (or lets strangers in)            | Emulator rules tests on every PR (§6.4); legacy rules untouched until cutover; App Check as depth only.                                                                                                                                                     |
| Scope creep (sharing, organising, snapshots, passkeys, extensions) | §4.2 follow-up row and §7; any addition re-opens this plan and its threat review first.                                                                                                                                                                     |
| Plaintext CSV file leaks or is kept indefinitely                   | Mandatory warnings at export and import (§10.8.2/§10.8.4), no upload anywhere, no automatic share destination, retirement at cutover+1 (§10.8.6), and compromise guidance in §10.8.5. Residual risk is the user's file-management decision, stated as such. |     |
| Committed Firebase config files (S11)                              | Audit in Phase 0: confirm whether credentials are live; rotate if so, add to `.gitignore`, and handle history per repo policy. Never commit replacements.                                                                                                   |

## 14. Testing and assurance (extends, never replaces, the existing gates)

Keep the existing pipeline ([zero-slop-ai.md](./zero-slop-ai.md): strict
TypeScript, ESLint, Jest, Zod contracts, Stryker, dependency-cruiser,
Maestro) and add, per phase:

- **Crypto:** known-answer tests with published vectors for the AEAD, KDF,
  and key-exchange primitives; round-trip, tamper (flip one ciphertext
  byte → reject), wrong-key, wrong-AAD, nonce-uniqueness, and empty-input
  tests using **real** primitives — replace the identity mocks in
  [Security.test.ts](../../component/Core/__tests__/Security.test.ts).
  Stryker must include the new crypto module; a surviving mutant there
  blocks merge.
- **Contracts:** v2 Zod schemas + negative tests (missing `algorithm`,
  unknown field, wrong `schemaVersion`, legacy shape rejected by v2
  readers). Fuzz the Firebase re-sync/restore parsing with malformed
  Firestore documents.
- **Rules:** emulator tests for every rule (§6.4), including the legacy
  regression suite, run in CI.
- **Migration:** the §10.2 corpus as fixtures; property test that
  `migrated + quarantined + pending == legacyTotal` after
  every batch, including after a killed-and-restarted job.
- **Restore drills:** Maestro flows — seed corpus → clear local cache →
  re-sync from Firebase → count + decrypt parity check; corrupt one remote
  item → quarantine, rest still load; new-device enrolment + recovery-key
  unlock → re-sync on a fresh install. CSV drills are specified in
  §10.8.6 (export → update → import parity, malformed file, re-import
  no-op, file still present after import).
- **E2E (Maestro):** Firebase login with no anonymous option, link of an
  existing anonymous account to a Firebase login, onboarding + recovery
  ceremony, lock/unlock + auto-lock, two-device sync + conflict, device
  revoke, generator. Replace the anonymous-login flow; extend the other
  existing flows.
- **Security review:** an external or second-pair review of the crypto
  module, rules, device enrolment/rotation code, and CSV export/import
  code before Phase 4 ships,
  plus a dependency audit (`npm audit`, license check on every new crypto
  dep) and a secrets scan in CI (the S5/S11 grep gates in §5.4).
- **Release checklist:** kill switch armed, accounting dashboard checked,
  rollback runbook to hand, staged rollout percentages recorded, and the
  previous phase's drills re-run on the release candidate.

## 15. Proposed module map (for the implementation that follows this plan)

Keep the project conventions from [AGENTS.md](../../AGENTS.md): components
never call Firebase directly (Storage abstraction only), Zod validates at
every storage boundary, `StyleSheet.create`/shared tokens for styles,
functional components, typed navigation params in `DataModel.tsx`.
Add dependency-cruiser rules mirroring the new boundaries.

```text
component/Core/
  Crypto/            # NEW: AEAD, KDF, key wrapping, random (no UI/storage imports)
    CryptoV2.ts      # encryptItem / decryptItem / wrapKey / deriveMasterKey
    LegacyCrypto.ts  # RENAMED Security.ts, decrypt-only, migration job only
    KeyStore.ts      # device keys, wrapped-key envelopes, memory wiping
  Vault/             # NEW: key-value items only (no folders/tags/history)
    VaultStore.ts    # ciphertext cache + sync queue (via Storage layer)
  Sync/              # NEW: onSnapshot listeners, conflict resolution,
                     #   Firebase re-sync restore (restoreFromFirestore)
  Devices/           # NEW: enrolment, approval, revocation (own devices only)
  Migration/         # NEW: plaintext CSV export/import bridge only (§10.8),
                     #   isolated, removed at cutover+1; never a general export
  Storage.tsx        # EXTENDED: v2 collections; legacy functions untouched
                     #   until cutover, then removed in one reviewed PR
  Contracts.ts       # EXTENDED: v2 schemas alongside v1 (see §6.1)
  DataModel.tsx      # EXTENDED: VaultItem (key/value), Device, KeyEnvelope
                     #   types; no Share/Snapshot types in V1
component/
  Vault/  Generator/  Settings/  Lock/  Onboarding/  # NEW screens (§9.2)
```

## 16. Acceptance criteria — "done" means all of these

1. A new user can set up a vault, save a key–value item, lock the phone,
   unlock with biometrics, and read the item on a second device after
   approval — with no plaintext key or value visible in Firestore.
2. Every legacy document from the §10.2 inventory is accounted for
   (migrated or quarantined with a user-visible path; duplicates are kept
   as separate items, §10.5), and each migrated item passed round-trip
   verification.
3. Restore is proven, not asserted: the Maestro drills in §14 pass for
   Firebase re-sync after a cache clear and on a fresh device after
   enrolment + recovery-key unlock, with corrupt items quarantined and the
   rest loading.
4. Sharing, organising, snapshots, and general exports do not exist in
   V1: no sharing/organise UI, code, collections, or rules were added,
   and no anonymous sign-in path remains. Firebase login is the sole
   membership path, and the only data in Firebase is encrypted data
   (§4.3 rule 1) — the sole exception is the on-device CSV file in §10.8,
   never in Firebase.
5. No secret, key text, value, or ciphertext appears in logs, Analytics,
   or crash reports; the CI grep gates and Stryker run are green;
   Firestore rules tests cover owner/stranger/revoked device.
6. The UI meets §9: masked-by-default secrets, typed navigation, dark mode,
   loading/empty/error/offline states, and accessibility labels on every
   control — verified by the Maestro flows, not by inspection alone.
7. The kill switch and rollback runbook were rehearsed, and the legacy
   archive exists with a manifest whose counts match the inventory.
8. The CSV bridge is proven, not asserted: the §10.8.6 drills pass
   (export → update → import parity, malformed file handling, re-import
   no-op), warnings are shown at export and import, and the file still
   exists after import, proving the app did not delete it.

## Appendix A — Files cited

- [Security.ts](../../component/Core/Security.ts) — RSA-OAEP encryption, JS
  key generation, SecureStore PEM storage, plaintext logging.
- [Storage.tsx](../../component/Core/Storage.tsx) — Firestore access, name-derived
  doc IDs, plaintext search index, silent decrypt downgrade, dead backup
  function, non-atomic rename.
- [DataModel.tsx](../../component/Core/DataModel.tsx) — flat `AListItem`,
  unused `BackupCadence`/`MembershipType` enforcement.
- [Contracts.ts](../../component/Core/Contracts.ts) — v1 Zod schemas with no
  version/algorithm fields.
- [ProfileScreen.tsx](../../component/ProfileScreen.tsx) — commented-out restore,
  dead cadence picker, account deletion flow.
- [HomeScreen.tsx](../../component/HomeScreen.tsx) / [AddItemModal.tsx](../../component/AddItemModal.tsx)
  / [AListItemComponent.tsx](../../component/AListItemComponent.tsx) — list, edit,
  and secret-display UI.
- [App.tsx](../../App.tsx) — two-tab navigation, untyped params.
- [firestore.rules](../../firebase-emulator/firestore.rules) — current rules
  (ownership by `userId` field only).
- [app.json](../../app.json) — `configureAndroidBackup: true`.
- [Security.test.ts](../../component/Core/__tests__/Security.test.ts) —
  identity-mocked crypto tests.
- [AGENTS.md](../../AGENTS.md) — project conventions this plan preserves.
