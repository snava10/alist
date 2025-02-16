import { KeyPair, RSA } from "react-native-rsa-native";
import * as SecureStore from "expo-secure-store";

const RSA_KEY_SIZE = 2048;
const PRIVATE_KEY_ALIAS = "agus_list_rsa_private_key";
const PUBLIC_KEY_ALIAS = "agus_list_rsa_public_key";

export async function encrypt(value: string): Promise<string> {
  return getRSAKeys()
    .then((keyPair) => {
      if (!keyPair) {
        throw "Failed to get RSA keys";
      }
      return RSA.encrypt(value, keyPair.public);
    })
    .catch((e) => {
      console.error("Failed to encrypt value", e);
      throw "Failed to encrypt value";
    });
}

export async function decrypt(hash: string): Promise<string> {
  return getRSAKeys()
    .then((keyPair) => {
      if (!keyPair) {
        throw "Failed to get RSA keys";
      }
      return RSA.decrypt(hash, keyPair.private);
    })
    .catch((e) => {
      console.error("Failed to decrypt value ", e);
      throw "Failed to decrypt value";
    });
}

export async function getRSAKeys(): Promise<KeyPair | null> {
  const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY_ALIAS);
  const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_ALIAS);

  if (publicKey && privateKey) {
    console.debug("RSA keys found in secure store");
    return {
      public: publicKey || "",
      private: privateKey || "",
    };
  }

  return generateAndStoreKeys()
    .then(async (keyPair) => {
      return keyPair;
    })
    .catch((e) => {
      console.error(`Failed to generate and store RSA keys ${e}`);
      throw "Failed to generate and store RSA keys";
    });
}

async function generateAndStoreKeys(): Promise<KeyPair> {
  return RSA.generateKeys(RSA_KEY_SIZE).then(async (keys) => {
    await SecureStore.setItemAsync(PRIVATE_KEY_ALIAS, keys.private);
    await SecureStore.setItemAsync(PUBLIC_KEY_ALIAS, keys.public);
    return keys;
  });
}
