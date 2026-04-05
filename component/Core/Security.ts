import * as forge from 'node-forge';
import * as SecureStore from 'expo-secure-store';

const RSA_KEY_SIZE = 2048;
const PRIVATE_KEY_ALIAS = 'agus_list_rsa_private_key';
const PUBLIC_KEY_ALIAS = 'agus_list_rsa_public_key';

export interface KeyPair {
  public: string;
  private: string;
}

export async function encrypt(value: string): Promise<string> {
  try {
    const keyPair = await getRSAKeys();
    if (!keyPair) {
      throw 'Failed to get RSA keys';
    }
    const publicKey = forge.pki.publicKeyFromPem(keyPair.public);
    const encrypted = publicKey.encrypt(forge.util.encodeUtf8(value), 'RSA-OAEP');
    return forge.util.encode64(encrypted);
  } catch (e) {
    console.error('Failed to encrypt value', e);
    throw 'Failed to encrypt value';
  }
}

export async function decrypt(hash: string): Promise<string> {
  try {
    const keyPair = await getRSAKeys();
    if (!keyPair) {
      throw 'Failed to get RSA keys';
    }
    const privateKey = forge.pki.privateKeyFromPem(keyPair.private);
    const decoded = forge.util.decode64(hash);
    const decrypted = privateKey.decrypt(decoded, 'RSA-OAEP');
    return forge.util.decodeUtf8(decrypted);
  } catch (e) {
    console.error('Failed to decrypt value ', e);
    throw 'Failed to decrypt value';
  }
}

export async function getRSAKeys(): Promise<KeyPair | null> {
  const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY_ALIAS);
  const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_ALIAS);

  if (publicKey && privateKey) {
    return {
      public: publicKey,
      private: privateKey,
    };
  }

  try {
    return await generateAndStoreKeys();
  } catch (e) {
    console.error(`Failed to generate and store RSA keys ${e}`);
    throw 'Failed to generate and store RSA keys';
  }
}

async function generateAndStoreKeys(): Promise<KeyPair> {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: RSA_KEY_SIZE });
  const publicPem = forge.pki.publicKeyToPem(keypair.publicKey);
  const privatePem = forge.pki.privateKeyToPem(keypair.privateKey);

  await SecureStore.setItemAsync(PRIVATE_KEY_ALIAS, privatePem);
  await SecureStore.setItemAsync(PUBLIC_KEY_ALIAS, publicPem);

  return { public: publicPem, private: privatePem };
}
