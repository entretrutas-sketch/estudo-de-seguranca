import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const chunkSize = 1500;
const maxChunks = 16;
const databaseName = 'verisure-study-drafts';
const storeName = 'encrypted-drafts';
const getNamespace = (scope: string) => `study-draft:${scope}`;

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Armazenamento local seguro indisponível neste navegador.'));
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'));
  });
}

async function getWebKey(database: IDBDatabase) {
  const read = database.transaction(storeName, 'readonly').objectStore(storeName).get('encryption-key');
  const stored = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    read.onsuccess = () => resolve(read.result as CryptoKey | undefined);
    read.onerror = () => reject(read.error);
  });
  if (stored) return stored;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const write = database.transaction(storeName, 'readwrite');
  write.objectStore(storeName).put(key, 'encryption-key');
  await new Promise<void>((resolve, reject) => { write.oncomplete = () => resolve(); write.onerror = () => reject(write.error); });
  return key;
}

async function readWebDraft(scope: string) {
  const database = await openDraftDatabase();
  try {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(getNamespace(scope));
    const encrypted = await new Promise<{ iv: Uint8Array; data: ArrayBuffer } | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as { iv: Uint8Array; data: ArrayBuffer } | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!encrypted) return null;
    const key = await getWebKey(database);
    const iv = encrypted.iv.buffer.slice(encrypted.iv.byteOffset, encrypted.iv.byteOffset + encrypted.iv.byteLength) as ArrayBuffer;
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted.data);
    return new TextDecoder().decode(clear);
  } finally { database.close(); }
}

async function writeWebDraft(scope: string, value: string) {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador não oferece criptografia local necessária para guardar o rascunho.');
  const database = await openDraftDatabase();
  try {
    const key = await getWebKey(database);
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const iv = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer;
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put({ iv: ivBytes, data }, getNamespace(scope));
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    void navigator.storage?.persist?.().catch(() => undefined);
  } finally { database.close(); }
}

export async function readSecureDraft(scope: string) {
  if (Platform.OS === 'web') return readWebDraft(scope);
  const namespace = getNamespace(scope);
  const count = Number(await SecureStore.getItemAsync(`${namespace}:count`)) || 0;
  if (count > maxChunks) return null;
  const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${namespace}:${index}`)));
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

export async function writeSecureDraft(scope: string, value: string) {
  if (Platform.OS === 'web') { await writeWebDraft(scope, value); return true; }
  const namespace = getNamespace(scope);
  const chunks = value.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g')) ?? [];
  if (chunks.length > maxChunks) throw new Error('Rascunho excede o limite seguro local. Salve a versão sincronizada no servidor.');
  const oldCount = Number(await SecureStore.getItemAsync(`${namespace}:count`)) || 0;
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${namespace}:${index}`, chunk)));
  for (let index = chunks.length; index < Math.min(oldCount, maxChunks); index++) await SecureStore.deleteItemAsync(`${namespace}:${index}`);
  await SecureStore.setItemAsync(`${namespace}:count`, String(chunks.length));
  return true;
}

export async function deleteSecureDraft(scope: string) {
  if (Platform.OS === 'web') {
    const database = await openDraftDatabase();
    try {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(getNamespace(scope));
      await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    } finally { database.close(); }
    return;
  }
  const namespace = getNamespace(scope);
  const count = Number(await SecureStore.getItemAsync(`${namespace}:count`)) || 0;
  await Promise.all(Array.from({ length: Math.min(count, maxChunks) }, (_, index) => SecureStore.deleteItemAsync(`${namespace}:${index}`)));
  await SecureStore.deleteItemAsync(`${namespace}:count`);
}
