---
name: password-manager-security
description: Guardrails for implementing crypto, storage, sync, device enrolment, Firebase re-sync restore, and secret-handling UI in the alist password manager. Zero-knowledge rules, migration invariants, and review checklist for AI-assisted work.
version: 1.0.0
license: MIT
---

## When this skill applies

Load this skill before writing, reviewing, or changing **any** code that
touches: `component/Core/Security.ts` (or its successor), `Storage.tsx`,
`Contracts.ts`, Firestore rules, device enrolment, Firebase re-sync /
restore, the lock screen, biometrics, clipboard handling, or any screen
that displays a secret. Sharing, organising, snapshots, and general
exports are out of scope in V1 (plan §7, §4.2, §8) — do not build them.
The sole exception is the plaintext-CSV migration bridge in plan §10.8,
under exactly the conditions stated there. It also applies to tests for those
areas. The full rationale and phased plan live in
[password-manager-transformation.md](../plans/password-manager-transformation.md);
this skill is the enforceable summary. If the two disagree, stop and flag
it — do not silently pick one.

## The model in one paragraph

Firebase Auth proves **identity** and is the only membership path — the
anonymous option is removed. A separate master password, stretched with a
KDF, unlocks the **vault**. The server (Firestore) holds only encrypted
data: ciphertext, wrapped keys, public device keys, and the non-content
metadata listed in the plan (§6). There is no separate backup system;
Firestore is the store. Items are key–value pairs only (§4.1). The sole
plaintext-at-rest copy permitted anywhere is the user-managed CSV
migration file in plan §10.8 — never in Firebase, never logged or
uploaded, and never deleted automatically by the app. A Vault Key
wraps per-item keys; device keys and the recovery key wrap the Vault Key.
Losing both the master password and the recovery key means the vault is
unrecoverable — by design, and the UI must say so.

## MUST

- Encrypt every secret with an AEAD cipher (XChaCha20-Poly1305, per the
  plan §5.3) under a random per-item key, with a random nonce and AAD bound
  to the item ID + version. Never reuse a nonce under the same key.
- Derive keys only with the approved KDF (Argon2id, or the recorded PBKDF2
  fallback), a per-account salt, and versioned parameters stored in the
  user profile. Never derive a key from a raw password hash or `Math.random`.
- Use `expo-crypto.getRandomValues` (CSPRNG) for all keys, nonces, salts,
  and recovery keys. Never `Math.random`, `Date.now()`, or a counter.
- Validate at every storage boundary with the Zod contracts in
  `Contracts.ts` (`.strict()`). Reject documents missing `algorithm` or
  `schemaVersion`, and unknown future versions — never guess-decrypt them.
- Keep the layering in [AGENTS.md](../../AGENTS.md): UI never calls
  Firebase, AsyncStorage, or crypto directly. UI → Storage/Vault layer →
  Firestore/crypto. Add or update dependency-cruiser rules for new modules.
- Fail closed: a decrypt/auth-tag failure quarantines that one item, shows
  an error, and leaves the rest of the vault readable. Never downgrade to
  plaintext, never hide the whole vault, never log the payload.
- Wipe the Master Key, Vault Keys, and decrypted values from memory on
  lock, sign-out, and unmount of secret screens. Mask secrets by default;
  reveal per-field with auto re-mask; copy explicitly and auto-clear the
  clipboard after 30–60 seconds.
- Wipe or rotate on device revoke: revoking a device deletes its
  envelopes and starts Vault Key rotation, re-wrapped for the remaining
  devices. Surface "rotation pending" until it completes.
- Prove restore: every re-sync/restore change ships with a count report
  (Firestore count vs decrypted count), a non-destructive merge, and a
  decrypt check for every item — and a Maestro drill that exercises it.
  There are no snapshots: restore is re-sync from Firebase (plan §8).
- Handle the CSV bridge exactly as plan §10.8 specifies: strict RFC 4180
  parsing in memory only, mandatory warning screens at export and import,
  pre-import report before any write, duplicate-skipping, verification by
  read-back decrypt, no upload anywhere, and never delete the file
  automatically — a user-tapped delete button is the only deletion the
  app may offer.

## NEVER

- Never encrypt new data with RSA, `node-forge`, or any home-grown cipher,
  KDF, padding, or "encode then call it encryption" (base64 is not
  encryption). RSA/`node-forge` are legacy-decrypt only, in one clearly
  named module, imported only by the migration job.
- Never store, log, or send in Analytics/crash reports: a master password,
  recovery key, vault/item key, plaintext key or value, or ciphertext
  blob. No `console.log` in `component/Core/` crypto/storage paths. Event
  names and counts only — and never an item key.
- Never store a key, value, tag, or search prefix in cleartext in
  Firestore, a document ID, a cache, or a filename — except the single
  §10.8 CSV file, created only by the migration export, user-managed, and
  never in Firebase or a cache. Never build a plaintext `searchIndex`.
  Search client-side after unlock (or the approved blind index, with its
  leakage documented).
- Never implement sharing with other people (invites, roles, members),
  organising (folders, tags, favourites), snapshots, or general exports
  in V1. The only export permitted is the §10.8 CSV migration bridge, and
  only under its stated conditions. Device enrolment covers the user's
  own devices only. If asked to add any of the rest, point at plan
  §7/§4.2/§8 and wait for a re-planned follow-up — do not half-build them.
- Never write a "forgot master password" email reset, a server-side key
  copy, a support backdoor, or a debug bypass that decrypts without the
  master password / recovery key / authorised device key.
- Never delete or rewrite a legacy document in place during migration.
  Never run a migration step that cannot be re-run idempotently, and never
  ship a migration step without the accounting identity
  (`legacyTotal = migrated + quarantined + pending`; duplicates count
  inside `migrated` as separate items).
- Never weaken a check to make a test pass: if a tamper/wrong-key test
  fails, the crypto or the test's assumption is wrong — investigate, do not
  mock the primitive, skip the assertion, or downgrade the cipher.
- Never commit `google-services.json` / `GoogleService-Info.plist` with
  real credentials, and never paste a key, token, or recovery key into a
  test fixture, comment, or plan. Fixtures use generated test keys only.
- Never add a new dependency for crypto, storage, or biometrics without a
  short review note: audit status, maintenance, React Native support, and
  why the approved primitive cannot be used instead.

## Migration invariants (from plan §10 — non-negotiable)

1. Archive first, migrate second, delete last — and only after the counts
   close.
2. Only the originating device decrypts legacy items. No key or plaintext
   ever goes to a server, function, or other device to "help".
3. Undecryptable items go to quarantine with `{ legacyDocId, reason, at }`
   — no value, no name — and block that user's cutover, never the release.
4. Old app versions keep reading legacy data for the whole window. Rules
   for legacy collections do not change until cutover.
5. A migration batch must be resumable and idempotent: UUID +
   `migratedFrom` dedupe, verify by read-back decrypt before marking
   migrated.

## Tests required with any change in scope

- **Crypto:** published known-answer vectors for the AEAD/KDF/key-exchange
  primitives; round-trip, single-byte tamper → reject, wrong key → reject,
  wrong AAD → reject, nonce uniqueness, empty input. Use real primitives —
  identity-mocked crypto tests are a defect, not coverage.
- **Contracts:** positive + negative Zod cases, including malformed,
  legacy-shaped, and future-version documents.
- **Rules:** emulator tests for owner / stranger / revoked device and
  for malformed writes, including the legacy regression suite.
- **Migration/restore:** the legacy fixture corpus (RSA-2048, 512-bit test,
  plaintext, corrupt base64, duplicates, missing timestamp, oversized
  value) and the accounting property test after every batch, including
  after a kill/restart. Duplicates are separate items, never merged.
  For the CSV bridge, the fixture corpus and drills in plan §10.8.6,
  including the check that the file still exists after import.
- **E2E (Maestro):** Firebase login with no anonymous option, unlock/lock,
  Firebase re-sync restore after a cache clear, two-device sync/conflict,
  device revoke, generator. Replace the anonymous-login flow.
- **Gates:** `npm run type-check`, `npm run lint`, `npm test`,
  `npm run test:contracts`, `npm run deps:check`, and Stryker on the touched
  crypto/storage modules. A surviving mutant in crypto blocks merge.

## Review checklist (paste into the PR / change description)

- [ ] No secret, key text, value, or ciphertext in logs, Analytics,
      errors, or test output.
- [ ] No new plaintext field in any Firestore document, doc ID, cache, or
      Analytics event. Only ciphertext, wrapped keys, public device keys,
      and non-content metadata are stored in Firebase.
- [ ] Every new Firestore collection has rules + emulator tests; legacy
      rules untouched unless the plan's cutover phase says otherwise.
- [ ] Every decrypt failure path quarantines one item and is covered by a
      test that uses real crypto.
- [ ] Rotation/revocation, if touched, re-wraps keys for the remaining
      devices and is covered by an end-to-end flow.
- [ ] No sharing, organising, snapshot, or general export code added in
      V1; CSV code only per plan §10.8, warnings present at export and
      import, file never auto-deleted, no plaintext in logs; no anonymous
      sign-in path remains; items are key–value pairs only.
- [ ] Migration accounting identity holds on the fixture corpus; rollback
      is "previous build / kill switch" with no data step to undo.
- [ ] `npm run format` was run; no unrelated files changed.

## If you are unsure

Stop before writing crypto, device enrolment, or migration code. State the exact
ambiguity (algorithm, key-rotation scope, rule shape, cohort handling),
what the plan says, and the two options with their security trade-off —
then wait for a decision. A guessed crypto design that "works" is worse
than no design: it ships a vault nobody can audit and some users cannot
recover.
