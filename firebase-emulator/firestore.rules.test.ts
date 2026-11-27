/**
 * Firestore rules tests (Step 4). Run only via `npm run test:rules`,
 * which starts the Firestore emulator through `firebase emulators:exec`
 * from firebase-emulator/; the emulator loads firestore.rules from
 * firebase.json, and these tests exercise exactly those rules. They
 * must not run under the main Jest config. Fixtures use generated
 * test values only — no real keys, passwords, or item content.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'alist-397309';
const ITEM_ID = '123e4567-e89b-42d3-a456-426614174000';
const BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function emulatorHostAndPort(): { host: string; port: number } {
  const fromEnv = process.env.FIRESTORE_EMULATOR_HOST;
  if (fromEnv) {
    const [host, port] = fromEnv.split(':');
    if (host && port) {
      return { host, port: Number(port) };
    }
  }
  return { host: '127.0.0.1', port: 8080 };
}

function validVaultItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ITEM_ID,
    userId: 'alice',
    ciphertext: BASE64,
    nonce: NONCE,
    wrappedItemKey: BASE64,
    wrappedKeyNonce: NONCE,
    algorithm: 'xchacha20-poly1305',
    schemaVersion: 2,
    version: 1,
    createdAt: 1712438400000,
    updatedAt: 1712438400000,
    ...overrides,
  };
}

function validVaultProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: 'alice',
    schemaVersion: 1,
    kdf: {
      kdf: 'pbkdf2-hmac-sha256',
      salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
      iterations: 600_000,
      dkLen: 32,
      version: 1,
    },
    verifier: BASE64,
    biometricEnabled: false,
    ...overrides,
  };
}

describe('Firestore rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Upload the rules file contents explicitly: the running emulator
    // may have started before this file was edited, and these tests must
    // exercise exactly the rules in firestore.rules.
    const rules = readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { ...emulatorHostAndPort(), rules },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  async function seed(collection: string, id: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), collection, id), data);
    });
  }

  describe('VaultItems', () => {
    it('allows the owner to create a valid vault item', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(setDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), validVaultItem()));
    });

    it('denies unauthenticated creates', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(unauthed.firestore(), 'VaultItems', ITEM_ID), validVaultItem()));
    });

    it('denies creating an item owned by another user', async () => {
      const bob = testEnv.authenticatedContext('bob');
      await assertFails(setDoc(doc(bob.firestore(), 'VaultItems', ITEM_ID), validVaultItem()));
    });

    it('denies a vault item missing algorithm', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const { algorithm: _algorithm, ...noAlgorithm } = validVaultItem();
      await assertFails(setDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), noAlgorithm));
    });

    it('denies a vault item missing schemaVersion', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const { schemaVersion: _schemaVersion, ...noVersion } = validVaultItem();
      await assertFails(setDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), noVersion));
    });

    it('denies an unknown future schema version', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), validVaultItem({ schemaVersion: 3 }))
      );
    });

    it('denies a different algorithm', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultItems', ITEM_ID),
          validVaultItem({ algorithm: 'aes-256-gcm' })
        )
      );
    });

    it('denies a vault item carrying a plaintext name field', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), validVaultItem({ name: 'secret' }))
      );
    });

    it('denies a document whose data id differs from its path id', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultItems', ITEM_ID),
          validVaultItem({ id: '223e4567-e89b-42d3-a456-426614174000' })
        )
      );
    });

    it('denies a non-UUID document id', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(doc(alice.firestore(), 'VaultItems', 'alice_secret'), validVaultItem())
      );
    });

    it('allows the owner to read and denies a stranger', async () => {
      await seed('VaultItems', ITEM_ID, validVaultItem());
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(getDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID)));
      await assertFails(getDoc(doc(bob.firestore(), 'VaultItems', ITEM_ID)));
    });

    it('allows the owner to update with a valid shape and denies a stranger', async () => {
      await seed('VaultItems', ITEM_ID, validVaultItem());
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(
        updateDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), { version: 2, updatedAt: 2 })
      );
      await assertFails(
        updateDoc(doc(bob.firestore(), 'VaultItems', ITEM_ID), { version: 3, updatedAt: 3 })
      );
    });

    it('denies an update to an invalid shape', async () => {
      await seed('VaultItems', ITEM_ID, validVaultItem());
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        updateDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID), { algorithm: 'aes-256-gcm' })
      );
    });

    it('allows the owner to delete and denies a stranger', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await seed('VaultItems', ITEM_ID, validVaultItem());
      await assertFails(deleteDoc(doc(bob.firestore(), 'VaultItems', ITEM_ID)));
      await assertSucceeds(deleteDoc(doc(alice.firestore(), 'VaultItems', ITEM_ID)));
    });
  });

  describe('VaultProfiles', () => {
    it('allows the owner to create a valid profile and denies others', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      const unauthed = testEnv.unauthenticatedContext();
      await assertSucceeds(
        setDoc(doc(alice.firestore(), 'VaultProfiles', 'alice'), validVaultProfile())
      );
      await assertFails(
        setDoc(doc(bob.firestore(), 'VaultProfiles', 'alice'), validVaultProfile())
      );
      await assertFails(
        setDoc(doc(unauthed.firestore(), 'VaultProfiles', 'alice'), validVaultProfile())
      );
    });

    it('denies a profile with an unknown KDF', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultProfiles', 'alice'),
          validVaultProfile({
            kdf: {
              kdf: 'argon2id',
              salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
              iterations: 3,
              dkLen: 32,
              version: 1,
            },
          })
        )
      );
    });

    it('denies biometric unlock claimed without wrapped key fields', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultProfiles', 'alice'),
          validVaultProfile({ biometricEnabled: true })
        )
      );
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultProfiles', 'alice'),
          validVaultProfile({ biometricEnabled: true, biometricWrappedKey: BASE64 })
        )
      );
    });

    it('denies a wrapped vault key without its nonce', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        setDoc(
          doc(alice.firestore(), 'VaultProfiles', 'alice'),
          validVaultProfile({ wrappedVaultKey: BASE64 })
        )
      );
    });

    it('allows the owner to read and denies a stranger', async () => {
      await seed('VaultProfiles', 'alice', validVaultProfile());
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(getDoc(doc(alice.firestore(), 'VaultProfiles', 'alice')));
      await assertFails(getDoc(doc(bob.firestore(), 'VaultProfiles', 'alice')));
    });

    it('allows the owner to update and denies a stranger', async () => {
      await seed('VaultProfiles', 'alice', validVaultProfile());
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(
        updateDoc(doc(alice.firestore(), 'VaultProfiles', 'alice'), { verifier: NONCE })
      );
      await assertFails(
        updateDoc(doc(bob.firestore(), 'VaultProfiles', 'alice'), { verifier: NONCE })
      );
    });
  });

  describe('legacy regression', () => {
    it('keeps legacy Items rules: owner-only by document userId', async () => {
      await seed('Items', 'alice_secret', {
        name: 'secret',
        value: 'YmFzZTY0ZW5jb2RlZA==',
        timestamp: 1712438400000,
        userId: 'alice',
        encrypted: true,
      });
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(getDoc(doc(alice.firestore(), 'Items', 'alice_secret')));
      await assertFails(getDoc(doc(bob.firestore(), 'Items', 'alice_secret')));
      await assertSucceeds(
        setDoc(doc(alice.firestore(), 'Items', 'alice_new'), {
          name: 'new',
          value: 'YmFzZTY0ZW5jb2RlZA==',
          timestamp: 1,
          userId: 'alice',
        })
      );
      await assertFails(
        setDoc(doc(bob.firestore(), 'Items', 'alice_other'), {
          name: 'other',
          value: 'YmFzZTY0ZW5jb2RlZA==',
          timestamp: 1,
          userId: 'alice',
        })
      );
    });

    it('keeps legacy UserSettings rules: owner-only by document id', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');
      await assertSucceeds(
        setDoc(doc(alice.firestore(), 'UserSettings', 'alice'), {
          userId: 'alice',
          backup: 'DAILY',
          membership: 'FREE',
        })
      );
      await assertSucceeds(getDoc(doc(alice.firestore(), 'UserSettings', 'alice')));
      await assertFails(getDoc(doc(bob.firestore(), 'UserSettings', 'alice')));
    });
  });
});
