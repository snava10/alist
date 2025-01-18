import * as crypto from "crypto";

// Encryption key and initialization vector (IV) must be consistent for decryption
const algorithm = "aes-256-cbc"; // Encryption algorithm
const secretKey: string = process.env.AGUS_LIST_SECRET_KEY;
const iv = crypto.randomBytes(16); // 16 bytes IV

export function encrypt(value: string): string {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Include the IV with the encrypted string for later decryption
  return `${iv.toString("hex")}:${encrypted}`;
}

// Decrypt function
export function decrypt(hash: string): string {
  const [ivHex, encrypted] = hash.split(":");

  if (!ivHex || !encrypted) {
    throw new Error("Invalid hash format");
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey),
    Buffer.from(ivHex, "hex")
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
