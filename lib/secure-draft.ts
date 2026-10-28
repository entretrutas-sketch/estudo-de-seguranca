import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const chunkSize = 1500;
const maxChunks = 16;
const getNamespace = (scope: string) => `study-draft:${scope}`;

export async function readSecureDraft(scope: string) {
  if (Platform.OS === 'web') return null;
  const namespace = getNamespace(scope);
  const count = Number(await SecureStore.getItemAsync(`${namespace}:count`)) || 0;
  if (count > maxChunks) return null;
  const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${namespace}:${index}`)));
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

export async function writeSecureDraft(scope: string, value: string) {
  if (Platform.OS === 'web') return false;
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
  if (Platform.OS === 'web') return;
  const namespace = getNamespace(scope);
  const count = Number(await SecureStore.getItemAsync(`${namespace}:count`)) || 0;
  await Promise.all(Array.from({ length: Math.min(count, maxChunks) }, (_, index) => SecureStore.deleteItemAsync(`${namespace}:${index}`)));
  await SecureStore.deleteItemAsync(`${namespace}:count`);
}
