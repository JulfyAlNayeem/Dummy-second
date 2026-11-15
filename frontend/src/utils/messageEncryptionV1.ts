import CryptoJS from "crypto-js";
import {
  addConfiguredCorruption,
  generateCorruptionKey,
  removeConfiguredCorruption,
  removeCorruption,
} from "./corruptionUtils";

// Cache to store derived keys by conversationId
const keyCache = {};
const v1AesKeyCache = new Map<string, Promise<CryptoKey>>();
const V1_MESSAGE_PREFIX = "V1E2:";
const V1_PBKDF2_ITERATIONS = 600000;
const V1_SETTINGS_EXPORT_FORMAT = "dummy-second-v1-settings";

export interface V1SenderSettings {
  configId: string;
  key1: string;
  key2: string;
  positions: number[];
  keyLength: number;
  corruptionKeys: string[];
}

function getV1SettingsStorageKey(conversationId: string, senderId: string): string {
  return `v1e2_settings_${conversationId}_${senderId}`;
}

function parseV1SenderSettings(stored: string | null): V1SenderSettings | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (
      typeof parsed.configId !== "string" ||
      parsed.configId.length < 16 ||
      typeof parsed.key1 !== "string" ||
      parsed.key1.length < 16 ||
      typeof parsed.key2 !== "string" ||
      parsed.key2.length < 16 ||
      parsed.key1 === parsed.key2 ||
      !Array.isArray(parsed.positions) ||
      parsed.positions.length < 1 ||
      parsed.positions.length > 100 ||
      parsed.positions.some(
        (position: number) => !Number.isSafeInteger(position) || position < 1
      ) ||
      !Number.isInteger(parsed.keyLength) ||
      parsed.keyLength < 1 ||
      parsed.keyLength > 64 ||
      !Array.isArray(parsed.corruptionKeys) ||
      parsed.corruptionKeys.length !== parsed.positions.length ||
      parsed.corruptionKeys.some(
        (key: string) =>
          typeof key !== "string" || key.length !== parsed.keyLength
      )
    ) {
      return null;
    }

    const positions = [...parsed.positions].sort((a: number, b: number) => a - b);
    if (
      new Set(positions).size !== positions.length ||
      positions.some((position: number, index: number) => position !== parsed.positions[index])
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getV1SettingsHistoryStorageKey(
  conversationId: string,
  senderId: string
): string {
  return `v1e2_settings_history_${conversationId}_${senderId}`;
}

function sameV1Settings(
  first: V1SenderSettings,
  second: V1SenderSettings
): boolean {
  return (
    first.configId === second.configId &&
    first.key1 === second.key1 &&
    first.key2 === second.key2 &&
    first.keyLength === second.keyLength &&
    first.positions.length === second.positions.length &&
    first.positions.every((position, index) => position === second.positions[index])
  );
}

export function getV1SenderSettings(
  conversationId: string,
  senderId: string
): V1SenderSettings | null {
  if (!conversationId || !senderId) return null;
  return parseV1SenderSettings(
    localStorage.getItem(getV1SettingsStorageKey(conversationId, senderId))
  );
}

export function getV1SenderSettingsVersions(
  conversationId: string,
  senderId: string
): V1SenderSettings[] {
  if (!conversationId || !senderId) return [];
  const active = getV1SenderSettings(conversationId, senderId);
  const historyRaw = localStorage.getItem(
    getV1SettingsHistoryStorageKey(conversationId, senderId)
  );
  let history: V1SenderSettings[] = [];
  if (historyRaw) {
    try {
      const parsed = JSON.parse(historyRaw);
      if (Array.isArray(parsed)) {
        history = parsed
          .map((settings) => parseV1SenderSettings(JSON.stringify(settings)))
          .filter(Boolean);
      }
    } catch {
      history = [];
    }
  }
  const versions = active ? [active, ...history] : history;
  return versions.filter(
    (settings, index) =>
      versions.findIndex((candidate) => sameV1Settings(candidate, settings)) === index
  );
}

export function saveV1SenderSettings(
  conversationId: string,
  senderId: string,
  settings: Omit<V1SenderSettings, "corruptionKeys" | "configId"> & {
    configId?: string;
  }
): string {
  assertConversationId(conversationId);
  if (!senderId) throw new Error("A sender ID is required for V1 settings");
  if (
    typeof settings.key1 !== "string" ||
    settings.key1.length < 16 ||
    typeof settings.key2 !== "string" ||
    settings.key2.length < 16 ||
    settings.key1 === settings.key2
  ) {
    throw new Error("Enter two different secrets, each at least 16 characters long");
  }
  if (
    !Array.isArray(settings.positions) ||
    settings.positions.length < 1 ||
    settings.positions.length > 100 ||
    settings.positions.some(
      (position) => !Number.isSafeInteger(position) || position < 1
    )
  ) {
    throw new Error("Enter between 1 and 100 unique positive corruption positions");
  }
  const positions = [...new Set(settings.positions)].sort((a, b) => a - b);
  if (
    positions.length !== settings.positions.length ||
    !Number.isInteger(settings.keyLength) ||
    settings.keyLength < 1 ||
    settings.keyLength > 64
  ) {
    throw new Error("Corruption positions must be unique and key length must be 1-64");
  }

  const storageKey = getV1SettingsStorageKey(conversationId, senderId);
  const previous = getV1SenderSettings(conversationId, senderId);
  const previousVersions = getV1SenderSettingsVersions(conversationId, senderId);
  const sameConfiguration =
    previous &&
    previous.key1 === settings.key1 &&
    previous.key2 === settings.key2 &&
    previous.keyLength === settings.keyLength &&
    previous.positions.length === positions.length &&
    previous.positions.every((position, index) => position === positions[index]);
  const configId =
    settings.configId?.trim() ||
    (sameConfiguration ? previous.configId : generateV1ConfigId());
  if (configId.length < 16) {
    throw new Error("A valid configuration ID is required");
  }
  const corruptionKeys =
    previous &&
    previous.positions.length === positions.length &&
    previous.keyLength === settings.keyLength &&
    previous.positions.every((position, index) => position === positions[index])
      ? previous.corruptionKeys
      : positions.map(() => generateCorruptionKey(settings.keyLength));

  const nextSettings = { ...settings, configId, positions, corruptionKeys };
  const conflictingVersion = previousVersions.find(
    (version) => version.configId === configId && !sameV1Settings(version, nextSettings)
  );
  if (conflictingVersion) {
    throw new Error("This configuration ID is already assigned to different settings");
  }
  const nextVersions = previous
    ? [
        ...(!sameV1Settings(previous, nextSettings) ? [previous] : []),
        ...previousVersions,
      ]
    : previousVersions;
  const uniqueHistory = nextVersions
    .filter((version, index, versions) =>
      versions.findIndex((candidate) => sameV1Settings(candidate, version)) === index
    )
    .slice(0, 100);

  localStorage.setItem(
    getV1SettingsHistoryStorageKey(conversationId, senderId),
    JSON.stringify(uniqueHistory)
  );
  localStorage.setItem(
    storageKey,
    JSON.stringify(nextSettings)
  );
  const cachePrefix = `${conversationId}:${senderId}:`;
  for (const cacheKey of v1AesKeyCache.keys()) {
    if (cacheKey.startsWith(cachePrefix)) v1AesKeyCache.delete(cacheKey);
  }
  return configId;
}

export function generateV1ConfigId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateV1Secret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function exportV1SettingsBundle(
  conversationId: string,
  senderId: string
): string {
  const settings = getV1SenderSettings(conversationId, senderId);
  if (!settings) {
    throw new Error("Save valid sender settings before exporting");
  }

  return JSON.stringify(
    {
      format: V1_SETTINGS_EXPORT_FORMAT,
      version: 1,
      conversationId,
      senderId,
      configId: settings.configId,
      settings: {
        key1: settings.key1,
        key2: settings.key2,
        positions: settings.positions,
        keyLength: settings.keyLength,
      },
    },
    null,
    2
  );
}

export function importV1SettingsBundle(
  bundleText: string,
  expectedConversationId: string
): { senderId: string; settings: V1SenderSettings } {
  if (bundleText.length > 65536) {
    throw new Error("V1 settings file is too large");
  }

  let bundle: any;
  try {
    bundle = JSON.parse(bundleText);
  } catch {
    throw new Error("Selected file is not valid V1 settings JSON");
  }
  if (
    bundle?.format !== V1_SETTINGS_EXPORT_FORMAT ||
    bundle.version !== 1 ||
    bundle.conversationId !== expectedConversationId
  ) {
    throw new Error("Settings file is invalid or belongs to another conversation");
  }
  if (
    typeof bundle.senderId !== "string" ||
    !bundle.senderId.trim() ||
    bundle.senderId.length > 256 ||
    typeof bundle.configId !== "string" ||
    bundle.configId.length < 16
  ) {
    throw new Error("Settings file is missing a valid sender or configuration ID");
  }

  saveV1SenderSettings(expectedConversationId, bundle.senderId, {
    configId: bundle.configId,
    key1: bundle.settings?.key1,
    key2: bundle.settings?.key2,
    positions: bundle.settings?.positions,
    keyLength: bundle.settings?.keyLength,
  });
  const settings = getV1SenderSettings(expectedConversationId, bundle.senderId);
  if (!settings) {
    throw new Error("Imported settings could not be loaded");
  }
  return { senderId: bundle.senderId, settings };
}

async function getV1AesKey(
  conversationId: string,
  senderId: string,
  layer: "inner" | "outer",
  secret: string
): Promise<CryptoKey> {
  const cacheKey = `${conversationId}:${senderId}:${layer}:${secret}`;
  const cached = v1AesKeyCache.get(cacheKey);
  if (cached) return cached;

  const keyPromise = (async () => {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Secure V1 encryption is unavailable in this browser");
    }
    const material = await crypto.subtle.importKey(
      "raw",
      toOwnedArrayBuffer(new TextEncoder().encode(secret)),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: toOwnedArrayBuffer(
          new TextEncoder().encode(`V1E2:${conversationId}:${senderId}:${layer}`)
        ),
        iterations: V1_PBKDF2_ITERATIONS,
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  })();
  v1AesKeyCache.set(cacheKey, keyPromise);
  try {
    return await keyPromise;
  } catch (error) {
    v1AesKeyCache.delete(cacheKey);
    throw error;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function encryptV1Layer(
  plaintext: string,
  key: CryptoKey,
  additionalData: string
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toOwnedArrayBuffer(iv),
      additionalData: toOwnedArrayBuffer(new TextEncoder().encode(additionalData)),
      tagLength: 128,
    },
    key,
    toOwnedArrayBuffer(new TextEncoder().encode(plaintext))
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

async function decryptV1Layer(
  payload: { iv: string; ciphertext: string },
  key: CryptoKey,
  additionalData: string
): Promise<string> {
  if (
    !payload ||
    typeof payload.iv !== "string" ||
    typeof payload.ciphertext !== "string"
  ) {
    throw new Error("Invalid V1 encrypted payload");
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toOwnedArrayBuffer(base64ToBytes(payload.iv)),
      additionalData: toOwnedArrayBuffer(new TextEncoder().encode(additionalData)),
      tagLength: 128,
    },
    key,
    toOwnedArrayBuffer(base64ToBytes(payload.ciphertext))
  );
  return new TextDecoder().decode(plaintext);
}

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
    toOwnedArrayBuffer(getAesKeyBytes(conversationId)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toOwnedArrayBuffer(iv),
      additionalData: toOwnedArrayBuffer(getFileAdditionalData(conversationId)),
      tagLength: 128,
    },
    key,
    toOwnedArrayBuffer(plaintext)
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
    toOwnedArrayBuffer(getAesKeyBytes(conversationId)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toOwnedArrayBuffer(iv),
      additionalData: toOwnedArrayBuffer(getFileAdditionalData(conversationId)),
      tagLength: 128,
    },
    key,
    toOwnedArrayBuffer(payload.slice(16))
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

function decryptLegacyMessage(cipher: any, conversationId: any): any {
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

export async function encryptMessage(
  msg: string,
  conversationId: string,
  senderId: string
): Promise<string> {
  assertConversationId(conversationId);
  if (typeof msg !== "string") {
    throw new Error("Cannot encrypt an invalid V1 message");
  }
  if (!senderId) {
    throw new Error("A sender ID is required for V1 encryption");
  }

  const settings = getV1SenderSettings(conversationId, senderId);
  if (!settings) {
    throw new Error(`V1 secrets are not configured for sender ${senderId}`);
  }

  const innerKey = await getV1AesKey(
    conversationId,
    senderId,
    "inner",
    settings.key1
  );
  const outerKey = await getV1AesKey(
    conversationId,
    senderId,
    "outer",
    settings.key2
  );
  const innerPayload = await encryptV1Layer(
    msg,
    innerKey,
    `V1E2:inner:${conversationId}:${senderId}:${settings.configId}`
  );
  const corruptedInnerPayload = addConfiguredCorruption(
    JSON.stringify({ version: 2, ...innerPayload }),
    settings.positions,
    settings.keyLength,
    settings.corruptionKeys
  );
  const outerPayload = await encryptV1Layer(
    corruptedInnerPayload,
    outerKey,
    `V1E2:outer:${conversationId}:${senderId}:${settings.configId}`
  );

  return `${V1_MESSAGE_PREFIX}${JSON.stringify({
    configId: settings.configId,
    ...outerPayload,
  })}`;
}

export async function decryptMessage(
  cipher: string,
  conversationId: string,
  senderId?: string
): Promise<string> {
  assertConversationId(conversationId);

  if (cipher.startsWith(V1_MESSAGE_PREFIX)) {
    if (!senderId) {
      throw new Error("A sender ID is required to decrypt this V1 message");
    }
    const envelope = JSON.parse(cipher.slice(V1_MESSAGE_PREFIX.length));
    if (typeof envelope.configId !== "string") {
      throw new Error("V1 message is missing its configuration ID");
    }
    const settings = getV1SenderSettingsVersions(conversationId, senderId).find(
      (version) => version.configId === envelope.configId
    );
    if (!settings) {
      throw new Error(`V1 secrets are not configured for sender ${senderId}`);
    }

    const outerKey = await getV1AesKey(
      conversationId,
      senderId,
      "outer",
      settings.key2
    );
    const corruptedInnerPayload = await decryptV1Layer(
      envelope,
      outerKey,
      `V1E2:outer:${conversationId}:${senderId}:${settings.configId}`
    );
    const cleanInnerPayload = removeConfiguredCorruption(
      corruptedInnerPayload,
      settings.positions,
      settings.keyLength
    );
    const innerPayload = JSON.parse(cleanInnerPayload);
    if (innerPayload.version !== 2) {
      throw new Error("Unsupported V1 message version");
    }
    const innerKey = await getV1AesKey(
      conversationId,
      senderId,
      "inner",
      settings.key1
    );
    return decryptV1Layer(
      innerPayload,
      innerKey,
      `V1E2:inner:${conversationId}:${senderId}:${settings.configId}`
    );
  }

  return decryptLegacyMessage(cipher, conversationId);
}