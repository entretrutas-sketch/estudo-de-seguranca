import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { EQUIPMENT, getKit, type KitName, type SavedStudy } from '@/lib/app-context';
import { buildProposalHtml, type ProposalLine } from '@/lib/proposal-document';

const images = {
  kit: require('../assets/equipment/00-kit-verisure.webp'),
  camera: require('../assets/equipment/01-camera-seguranca.webp'),
  internal: require('../assets/equipment/02-videodetector-interno.webp'),
  external: require('../assets/equipment/03-videodetector-externo.webp'),
  sign: require('../assets/equipment/04-placa-inibicao.webp'),
  sensor: require('../assets/equipment/05-sensor-abertura-presense.webp'),
  panel: require('../assets/equipment/06-painel-controle.webp'),
  hub: require('../assets/equipment/07-unidade-central.webp'),
  keys: require('../assets/equipment/08-chaves-inteligentes.webp'),
  remote: require('../assets/equipment/09-controle-remoto.webp'),
  panic: require('../assets/equipment/10-botao-panico.webp'),
  app: require('../assets/equipment/11-my-verisure.webp'),
  logo: require('../assets/verisure-logo.png'),
} as const;

const keysByFilename: Record<string, keyof typeof images> = {
  '07-unidade-central.webp': 'hub', '06-painel-controle.webp': 'panel', '02-videodetector-interno.webp': 'internal',
  '05-sensor-abertura-presense.webp': 'sensor', '08-chaves-inteligentes.webp': 'keys', '09-controle-remoto.webp': 'remote',
  '10-botao-panico.webp': 'panic', '04-placa-inibicao.webp': 'sign', '11-my-verisure.webp': 'app',
};

export function proposalLinesFor(study: SavedStudy): ProposalLine[] {
  if (study.customItems?.length) return study.customItems.map((line) => ({ ...line, image: keysByFilename[line.image] ?? line.image }));
  if (!['KIT PROTECTION', 'BT4', 'BT6', 'BT8'].includes(study.kit)) return [];
  const extraSensors = getKit(study.kit as KitName).extraSensors;
  return EQUIPMENT.map((item) => ({
    name: item.name,
    quantity: item.quantity + (item.name === 'Sensor de abertura PreSense™' ? extraSensors : 0),
    description: item.description,
    kind: item.kind,
    place: item.place,
    image: keysByFilename[item.image] ?? 'sensor',
  }));
}

export function proposalImageModule(key: string) {
  return images[key as keyof typeof images] ?? images.sensor;
}

async function assetData(key: keyof typeof images) {
  const asset = Asset.fromModule(images[key]);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') return uri;
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${key === 'logo' ? 'image/png' : 'image/webp'};base64,${base64}`;
}

export async function prepareProposalDocument(study: SavedStudy) {
  const entries = await Promise.all(Object.keys(images).map(async (key) => [key, await assetData(key as keyof typeof images)] as const));
  const assets = Object.fromEntries(entries) as Record<string, string>;
  const lines = proposalLinesFor(study).map((line) => ({ ...line, image: line.image ? assets[line.image] ?? assets.sensor : '' }));
  const html = buildProposalHtml(study, lines, assets, assets.logo);
  return { lines, html };
}
