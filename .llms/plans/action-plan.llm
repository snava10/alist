## Goal

Implement vault unlock with a master password plus biometrics, auto-lock, multi-device sync, and offline access in [alist](/Users/sergionava/github/alist), and migrate existing data to the new vault format. Rely solely on Firebase. Local storage is deprecated: it is used only as a read-only migration source, and only until the cutover step. The work is split into small steps, executed one at a time on your command. The previous attempt was reverted; the working tree is clean, so this plan starts from the current code.

## Success Criteria

- A signed-in user unlocks with a master password or biometrics; the key exists only in memory and is wiped on lock.
- The vault locks after 5 minutes of inactivity and immediately on background/inactive, clearing decrypted items.
- Items sync across devices through Firestore, with per-item quarantine instead of whole-vault failure.
- Offline reads and queued writes work through the Firestore SDK cache, verified on a device; no separate local store for secrets is built.
- Every legacy item is accounted for: `legacyTotal = migrated + quarantined + pending`, legacy originals untouched, migration re-runnable without duplicates.
- No list data is read from or written to AsyncStorage by app code after the final step, and no plaintext name, value, key, or ciphertext is logged in the touched paths.

## Approach

Follow the transformation plan in [.llms/plans/password-manager-transformation.md](/Users/sergionava/github/alist/.llms/plans/password-manager-transformation.md) and the guardrails in [.llms/skills/PASSWORD_MANAGER_SECURITY_SKILL.md](/Users/sergionava/github/alist/.llms/skills/PASSWORD_MANAGER_SECURITY_SKILL.md), but in library-first order: data model and contracts, then crypto, then storage, then UI, then migration, then deprecation. Each step leaves the tree green and reviewable on its own. Current facts grounding this plan, verified in the reverted tree: items are RSA-OAEP encrypted with 1024-bit `node-forge` keys in [Security.ts](/Users/sergionava/github/alist/component/Core/Security.ts), stored in the flat `Items` collection with content-derived document IDs and a plaintext prefix `searchIndex`, and read from AsyncStorage `_ali_` entries in [Storage.tsx](/Users/sergionava/github/alist/component/Core/Storage.tsx); there are no `@noble/*` or `expo-local-authentication` dependencies yet, `expo-crypto` is present, and the installed `@react-native-firebase/firestore` types expose `settings({ persistence })`.

## Key Decisions

- **Master password, derived key.** The master password derives the key that wraps per-item keys (decision D1 in the transformation plan). Device-key envelopes and a recovery key are explicitly deferred: losing the master password means the vault is unrecoverable, and a new device needs the master password. This is a deliberate simplification of plan §5.2/§5.5; confirm it before Step 5, or Step 5 must include the full key hierarchy instead.
- **KDF decided by spike in Step 3.** Argon2id only if a maintained, audited React Native binding is found; otherwise the recorded PBKDF2-HMAC-SHA256 fallback at OWASP iteration counts, with versioned parameters in the profile so it can be upgraded later (decision D2).
- **Flat collections.** New data lives in flat `VaultProfiles` and `VaultItems` collections, matching the existing flat `Items`/`UserSettings` pattern, rather than the `users/{uid}/items` subcollections in plan §6.1. Document IDs are random UUIDs, never derived from content.
- **Offline via the Firestore SDK only.** Step 7 requests the SDK persistent cache and reports whether it was accepted. If the on-device check fails, work stops and is reported; no SQLite/MMKV cache is built in this plan, per your instruction to address that later.
- **No tombstones in this plan.** Deletes are document deletes; multi-device delete sync relies on the live snapshot. Tombstones from plan §6.2 are deferred.
- **Anonymous sign-in stays.** Removing it is decided in the transformation plan but is out of this scope. Anonymous users cannot create a v2 vault; Step 10 reports their items as pending rather than migrating them.

## Steps

### Step 1 — Inventory and legacy fixture corpus (read-only)

Document the current shapes: RSA-encrypted and plaintext legacy documents, missing timestamps, oversized values, duplicates, `_ali_` AsyncStorage entries, SecureStore key aliases, and the anonymous flow. Add a legacy fixture corpus and tests that exercise the existing decrypt path with generated test keys only. No behaviour changes.

Validation: `npm test`.

### Step 2 — Vault data model and contracts

Add `VaultProfile`, `KdfParams`, `VaultItemDocument`, `VaultItem`, quarantine, and migration-report types to [DataModel.tsx](/Users/sergionava/github/alist/component/Core/DataModel.tsx), and strict Zod contracts in [Contracts.ts](/Users/sergionava/github/alist/component/Core/Contracts.ts) that reject documents missing `algorithm` or `schemaVersion` and unknown future versions. No callers yet.

Validation: `npm run test:contracts`, `npm run type-check`.

### Step 3 — Vault crypto primitives

Add one crypto module: XChaCha20-Poly1305 envelope encryption, fresh random per-item keys and nonces from `expo-crypto`, AAD bound to item ID plus version, and the KDF spike decision recorded in the module. Add `@noble/ciphers`/`@noble/hashes` only with a short audit/maintenance review note. Tests use real primitives: published known-answer vectors, round-trip, single-byte tamper, wrong key, wrong AAD, nonce uniqueness, empty input. No callers yet.

Validation: `npm test`, `npm run lint`.

### Step 4 — Firestore rules for the new collections

Add `VaultItems` and `VaultProfiles` rules (owner-only, schema/algorithm checks on write) to [firestore.rules](/Users/sergionava/github/alist/firebase-emulator/firestore.rules), leaving legacy `Items` rules untouched. Add a minimal emulator rules test harness and tests for owner, stranger, and malformed writes plus a legacy regression case.

Validation: the new rules test command defined in this step, run against the Firebase emulator.

### Step 5 — Vault profile storage and master-password unlock (library only)

Add profile read/write through [Storage.tsx](/Users/sergionava/github/alist/component/Core/Storage.tsx) and a password-unlock function: versioned KDF parameters and a verifier in the profile, derived key held in memory only, wrong password fails closed with the key wiped. No UI. Tests use a fake profile store.

Validation: `npm test`, `npm run type-check`.

### Step 6 — Encrypted vault item storage (library only)

Add encrypted item save/read through the storage layer: UUID document IDs, version increment on edit, per-item fault isolation with quarantine records, and a restore count report (Firestore total versus decrypted total). No UI callers yet; legacy read/write paths are untouched.

Validation: `npm test` with the Firestore mock, `npm run test:contracts`.

### Step 7 — Live sync, offline cache, and HomeScreen switch

Replace the one-shot list read in [HomeScreen.tsx](/Users/sergionava/github/alist/component/HomeScreen.tsx) with an `onSnapshot` subscription merged last-writer-wins by `(version, updatedAt)`, enable the Firestore persistent cache through `settings({ persistence: true })` before other Firestore use, expose whether it was accepted, and switch search to client-side filtering over decrypted items. New items stop writing `searchIndex`. This step has a manual gate: on a device, with airplane mode on, the list must load from cache, a write must queue, and it must sync on reconnect. If that fails, stop and report; do not build another cache.

Validation: `npm test`, plus the manual on-device offline check.

### Step 8 — Lock screen, vault provider, and auto-lock

Add a vault provider holding the key in memory only, a lock screen with the master-password form and the unrecoverability warning, and gating in [App.tsx](/Users/sergionava/github/alist/App.tsx) so locked state shows no items. Auto-lock after 5 minutes of inactivity (configurable 1/5/15 in a later profile setting within this step if trivial, otherwise 5 minutes fixed) and immediately on background/inactive; locking wipes the key and clears decrypted state. The migration job does not run yet.

Validation: `npm test`, including background and timer auto-lock tests and a lock-screen fallback test.

### Step 9 — Biometrics

Add biometric enable/disable in [ProfileScreen.tsx](/Users/sergionava/github/alist/component/ProfileScreen.tsx): a SecureStore-held wrapping key plus a wrapped copy of the vault key in the profile, biometric prompt on unlock, and fallback to the master-password form on any failure. Biometrics never store the master password. Document the residual risk that hardware backing of the wrapping key is unproven on the device. Add the `expo-local-authentication` plugin permission to [app.json](/Users/sergionava/github/alist/app.json).

Validation: `npm test` with mocked biometric and SecureStore adapters, `npm run type-check`.

### Step 10 — Migration job

Extract legacy RSA decryption from [Security.ts](/Users/sergionava/github/alist/component/Core/Security.ts) into a clearly named decrypt-only module imported only by the migration job. The job runs only while unlocked, only on the originating device, reads legacy Firestore documents and read-only `_ali_` AsyncStorage entries, encrypts plaintext legacy values directly without RSA, verifies every migrated write by read-back decrypt, quarantines undecryptable items by ID only, and is idempotent via `migratedFrom` dedupe. Add a counts-only migration report in the UI. The fixture corpus from Step 1 must pass, including duplicates, corrupt base64, missing timestamps, and a kill/restart re-run with no duplicates.

Validation: `npm test`, including the accounting identity test.

### Step 11 — Deprecation, logging cleanup, and final gates

Remove app-data AsyncStorage use from [Storage.tsx](/Users/sergionava/github/alist/component/Core/Storage.tsx) (the backup/clear helpers and their callers), remove legacy save/decrypt paths and `searchIndex` writes, delete the old `Security.ts` encrypt path (keeping only the decrypt-only legacy module), and remove plaintext logging of items, keys, or ciphertext from the touched paths. The migration module remains as the only AsyncStorage reader until a later cutover release. Add dependency-cruiser rules enforcing the layering (no crypto/biometrics/storage imports from screens, legacy crypto only from migration). Legacy Firestore documents are never deleted or rewritten by this step.

Validation: `npm run format`, `npm run type-check`, `npm run lint`, `npm test`, `npm run test:contracts`, `npm run deps:check`, and `npm run test:mutate` on the touched crypto/storage modules.

## Validation Plan

Each step runs only its stated commands and stops on failure. Steps 4 and 7 have gates that unit tests cannot prove (emulator rules, on-device offline cache); those gates are manual and must be reported as observed evidence, not assumed. The highest-risk validation is Step 7's on-device offline check, followed by Step 10's accounting identity over the fixture corpus.

## Risks / Open Questions

- Forgotten master password plus no recovery key means permanent vault loss; the UI must say so, and this is accepted only if the Key Decision above is confirmed before Step 5.
- If the KDF spike (Step 3) or offline check (Step 7) fails, the affected step stops for a decision instead of silently downgrading.
- A device without the legacy RSA key quarantines its encrypted legacy items; that blocks that user's cutover, never the release.
- Rules regressions can lock users out or let strangers in; Step 4's emulator tests and untouched legacy rules mitigate this.
- Open questions: confirm the derived-key simplification (default: proceed as planned); confirm the 5-minute auto-lock default (default: yes); confirm flat collections (default: yes). No other open questions: sharing, organising, snapshots, breach checking, and membership gating are non-goals in this plan.

## Execution Protocol

Say `go` to run Step 1 only, or name a step (for example, "step 4") to run that one step. After each step I will report the files changed and the validation evidence, leave the changes uncommitted for your review, and stop. No later step starts without your command, and no step is committed or published without you asking. Reverting a step means discarding only that step's uncommitted changes.
