import { RSA } from "react-native-rsa-native";
import { AGUS_LIST_PRIVATE_RSA_KEY, AGUS_LIST_PUBLIC_RSA_KEY } from "@env";

const privateKey: string = AGUS_LIST_PRIVATE_RSA_KEY;
const publicKey: string = AGUS_LIST_PUBLIC_RSA_KEY;

export async function encrypt(value: string): Promise<string> {
  const res = await RSA.encrypt(value, publicKey);
  return res;
}

// Decrypt function
export async function decrypt(hash: string): Promise<string> {
  const res = await RSA.decrypt(hash, privateKey);
  return res;
}
