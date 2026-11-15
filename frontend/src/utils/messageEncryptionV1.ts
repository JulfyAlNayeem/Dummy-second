import CryptoJS from "crypto-js";
import { addCorruption, removeCorruption } from "./corruptionUtils";

// Cache to store derived keys by conversationId
const keyCache = {};

function getDerivedKey(conversationId: string): string {
  const cachedKey = keyCache[conversationId];
  if (cachedKey) return cachedKey;

  const keyMaterial = getEncryptionKey(conversationId);
  const derivedKey = CryptoJS.PBKDF2(keyMaterial, conversationId, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();
  keyCache[conversationId] = derivedKey;
  return derivedKey;
}

function assertConversationId(conversationId: string): void {
  if (!conversationId || conversationId === "new") {
    throw new Error("Cannot encrypt a V1 message without a conversation ID");
  }
}

function getAesKeyBytes(conversationId: string): Uint8Array {
  const derivedKey = getDerivedKey(conversationId);
  const keyBytes = new Uint8Array(derivedKey.length / 2);
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(derivedKey.slice(i * 2, i * 2 + 2), 16);
  }
  return keyBytes;
}

function getFileAdditionalData(conversationId: string): Uint8Array {
  return new TextEncoder().encode(`V1FILE:1:${conversationId}`);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encryptFile(file: File, conversationId: string): Promise<File> {
  assertConversationId(conversationId);
  if (!(file instanceof File)) {
    throw new Error("Cannot encrypt an invalid V1 attachment");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("V1 attachments cannot exceed 10 MB");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure file encryption is unavailable in this browser");
  }

  const metadata = new TextEncoder().encode(
    JSON.stringify({
      filename: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    })
  );
  if (metadata.length > 1536) {
    throw new Error("V1 attachment metadata is too large to encrypt");
  }
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const plaintext = new Uint8Array(4 + metadata.length + fileBytes.length);
  new DataView(plaintext.buffer).setUint32(0, metadata.length);
  plaintext.set(metadata, 4);
  plaintext.set(fileBytes, 4 + metadata.length);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    getAesKeyBytes(conversationId),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: getFileAdditionalData(conversationId),
      tagLength: 128,
    },
    key,
    plaintext
  );

  const payload = new Uint8Array(16 + encrypted.byteLength);
  payload.set([0x56, 0x31, 0x46, 0x31]);
  payload.set(iv, 4);
  payload.set(new Uint8Array(encrypted), 16);

  return new File([payload], `V1ENC_${toHex(crypto.getRandomValues(new Uint8Array(16)))}.bin`, {
    type: "application/octet-stream",
    lastModified: file.lastModified,
  });
}

export async function encryptFiles(
  files: File[],
  conversationId: string
): Promise<File[]> {
  const encryptedFiles: File[] = [];
  for (const file of files) {
    encryptedFiles.push(await encryptFile(file, conversationId));
  }
  return encryptedFiles;
}

export async function decryptFile(
  encryptedFile: ArrayBuffer | Uint8Array,
  conversationId: string
): Promise<{ data: Uint8Array; filename: string; type: string; size: number }> {
  assertConversationId(conversationId);
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure file decryption is unavailable in this browser");
  }

  const payload =
    encryptedFile instanceof Uint8Array
      ? encryptedFile
      : new Uint8Array(encryptedFile);
  if (
    payload.length < 32 ||
    payload[0] !== 0x56 ||
    payload[1] !== 0x31 ||
    payload[2] !== 0x46 ||
    payload[3] !== 0x31
  ) {
    throw new Error("Invalid V1 encrypted file");
  }

  const iv = payload.slice(4, 16);
  const key = await crypto.subtle.importKey(
    "raw",
    getAesKeyBytes(conversationId),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: getFileAdditionalData(conversationId),
      tagLength: 128,
    },
    key,
    payload.slice(16)
  );

  const plaintext = new Uint8Array(plaintextBuffer);
  if (plaintext.length < 4) {
    throw new Error("Invalid V1 encrypted file metadata");
  }
  const metadataLength = new DataView(
    plaintext.buffer,
    plaintext.byteOffset,
    plaintext.byteLength
  ).getUint32(0);
  if (metadataLength > plaintext.length - 4) {
    throw new Error("Invalid V1 encrypted file metadata");
  }

  const metadata = JSON.parse(
    new TextDecoder().decode(plaintext.slice(4, 4 + metadataLength))
  );
  const data = plaintext.slice(4 + metadataLength);
  if (
    typeof metadata.filename !== "string" ||
    typeof metadata.type !== "string" ||
    metadata.size !== data.length
  ) {
    throw new Error("Invalid V1 encrypted file metadata");
  }

  return {
    data,
    filename: metadata.filename,
    type: metadata.type,
    size: metadata.size,
  };
}

// Helper function to get or create the encryption key
function getEncryptionKey(conversationId: any): any {
  const storedKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith(`${conversationId}_`)
  );
  const defaultKey = `${conversationId}_${conversationId}`;
  const customKey = storedKeys.find((key) => key !== defaultKey);

  if (customKey) {
    return localStorage.getItem(customKey);
  }

  if (storedKeys.includes(defaultKey)) {
    return localStorage.getItem(defaultKey);
  }

  // Create and store default key if no keys exist
  localStorage.setItem(defaultKey, conversationId);
  return conversationId;
}

export function encryptMessage(msg: any, conversationId: any): any {
  assertConversationId(conversationId);
  const derivedKey = getDerivedKey(conversationId);
  const encrypted = CryptoJS.AES.encrypt(msg, derivedKey).toString();
  return addCorruption(encrypted, conversationId);
}

export function decryptMessage(cipher: any, conversationId: any): any {
  if (!conversationId) {
    // No key → treat it as plain text
    return cipher;
  }

  const derivedKey = getDerivedKey(conversationId);

  // First, try assuming it's corrupted
  const clean = removeCorruption(cipher, conversationId);
  try {
    const bytes = CryptoJS.AES.decrypt(clean, derivedKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) {
      console.log('✅ V1 Decryption SUCCESS');
      return decrypted;
    }
  } catch (err) {
    // Ignore and try next
    console.log('⚠️ V1 Decryption failed (with corruption removal)');
  }

  // If failed, try assuming no corruption
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, derivedKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) {
      console.log('✅ V1 Decryption SUCCESS (no corruption)');
      return decrypted;
    }
  } catch (err) {
    // Ignore
    console.log('⚠️ V1 Decryption failed (without corruption removal)');
  }

  // If both failed, throw error instead of returning cipher
  console.error('❌ V1 Decryption FAILED - Wrong key!');
  throw new Error('[V1 Decryption Failed - Wrong Key]');
}