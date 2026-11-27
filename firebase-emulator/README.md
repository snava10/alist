# Firebase Emulator Suite setup

This folder configures the Firebase Local Emulator Suite for local
development, following the
[Firebase install and configure guide](https://firebase.google.com/docs/emulator-suite/install_and_configure).
Prerequisites from that guide: Node.js 16 or higher, JDK 11 or higher,
and Firebase CLI 8.14.0 or higher (`firebase --version`).

## Configuration

`firebase.json` uses the default emulator ports (Auth 9099, Cloud
Firestore 8080, Realtime Database 9000, Cloud Storage 9199, Emulator UI
4000), enables the Emulator UI, and sets `singleProjectMode: true` with
one project ID (`alist-397309`, declared identically in the root and in
this folder's `.firebaserc`). Security Rules come from the `firestore`
and `storage` keys in `firebase.json`. The Realtime Database emulator has
no rules file configured; the app does not use Realtime Database.

The real project ID is kept intentionally: switching to a demo project
would break the app's Firebase configuration. Emulator data never touches
production.

## Starting the emulators

```bash
npm run firebase-emulator
```

This runs `firebase emulators:start --import ./seed` from this folder, so
every start loads the same baseline data. Firestore is not seeded and
starts empty on each start, because the seed directory contains Auth data
only. The start script deliberately does not use `--export-on-exit`: the
guide notes the export path defaults to the import directory when both
flags are used, which would overwrite the deterministic baseline with
whatever happened during a session.

## Firestore rules tests

```bash
npm run test:rules
```

Requires a running Firestore emulator (`npm run firebase-emulator`
in another terminal; the user's already-running emulator works too).
The tests upload the contents of `firestore.rules` to that emulator
before running, so they exercise exactly the file in this folder, and
run `firestore.rules.test.ts` against it with
`@firebase/rules-unit-testing`. The rules tests use a separate Jest
config and do not run under `npm test`. Legacy `Items`/`UserSettings`
rules are covered by regression cases in the same file and must stay
unchanged until cutover. Note the tests clear Firestore data in the
running emulator between cases.

## Default test user (emulator only)

The seed creates one user, usable with the email and password sign-in form
in the app. These credentials are fake, work only against the local
emulator, and must never be used for a production account:

- Email: `test@alist.local`
- Password: `TestUser123!`
- Display name: Test User

Type them in manually; the app does not prefill them. The seed files store
only the password hash and salt — never edit `accounts.json` by hand to
insert a plaintext password. To change the test user's password, create
the user again and regenerate the seed as described below.

Email/password sign-in works against the Auth emulator with no console
change. For production use, the Email/Password provider must also be
enabled in the Firebase console.

## Regenerating the seed

The seed is a baseline data set produced with `emulators:export`, as
described in the guide. To regenerate it:

1. Start the emulators with the command above.
2. Create the test user (Emulator UI Auth tab, or the Identity Toolkit
   sign-up API against `http://127.0.0.1:9099`).
3. While the emulators are running, export Auth data only:

   ```bash
   cd firebase-emulator
   firebase emulators:export /tmp/alist-seed-staging --only auth --force
   ```

4. Copy only `auth_export/` and `firebase-export-metadata.json` from the
   export into `firebase-emulator/seed/`, replacing what is there. If the
   running emulator contains other users, keep only the test user in
   `seed/auth_export/accounts.json` — never commit other users' accounts
   into the baseline.
5. Verify the seed by starting a fresh emulator with `--import` and
   signing in as the test user before committing the change. Do not run
   the export when multiple emulator instances for the same project are
   running: hub discovery is ambiguous in that case.
