import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProposalHtml, buildWhatsAppMessage } from '../lib/proposal-document.ts';

const study = {
  id: 'study-12345678',
  client: { name: 'Cliente de Teste', phone: '', locationName: 'Unidade Centro', street: 'Rua Real', addressNumber: '10', complement: '', neighborhood: '', city: 'São Paulo', state: 'SP', postalCode: '', propertyType: 'Comercial' },
  kit: 'BT4',
  accessCounts: { doors: 2, windows: 3, externalAccess: 1 },
  finalEquipment: 1799.4,
  finalMonthly: 359.1,
  equipmentOriginal: 2999,
  monthlyOriginal: 399,
  equipmentDiscount: 40,
  monthlyDiscount: 10,
  createdAt: '2026-10-27T12:00:00.000Z',
  issuedAt: '2026-10-27T12:30:00.000Z',
  proposalVersion: '20261027-123000',
  synced: true,
  specialist: { name: 'Especialista Real', email: 'especialista@empresa.com', phone: '', avatarUrl: '' },
  evaluation: { accessCounts: { doors: 2, windows: 3, externalAccess: 1 }, garage: '', interiorAreas: '', notes: '', photoConsent: false, photoUris: [] },
};
const lines = [{ name: 'Sensor de abertura PreSense™', quantity: 4, description: 'Detecta abertura em um ponto compatível.', kind: 'Físico', place: 'Portas e janelas avaliadas', image: 'data:image/webp;base64,aA==' }];
const assets = { kit: 'data:image/webp;base64,aA==' };

test('builds a three-page commercial proposal with real study and catalog values', () => {
  const html = buildProposalHtml(study, lines, assets, 'data:image/png;base64,bA==');
  assert.equal((html.match(/class="page"/g) ?? []).length, 3);
  assert.match(html, /Cliente de Teste/);
  assert.match(html, /Rua Real, 10, São Paulo, SP/);
  assert.match(html, /R\$\s?2\.999,00/);
  assert.match(html, /R\$\s?1\.799,40/);
  assert.match(html, /4 × Sensor de abertura PreSense™/);
  assert.match(html, /assinatura/i);
  assert.doesNotMatch(html, /undefined|null|valor a cadastrar/i);
});

test('WhatsApp message includes final totals and omits discount percentages and unit prices', () => {
  const message = buildWhatsAppMessage(study, lines);
  assert.match(message, /Olá, Cliente de Teste/);
  assert.match(message, /Investimento final dos equipamentos/);
  assert.match(message, /Mensalidade: R\$/);
  assert.match(message, /Especialista Real/);
  assert.doesNotMatch(message, /40%|10%|R\$\s?2\.999|undefined|null|valor a cadastrar/i);
});

test('supports a custom composition and consolidated manual equipment total', () => {
  const customStudy = { ...study, kit: 'Composição personalizada', equipmentOriginal: 5000, finalEquipment: 4250, equipmentDiscount: 15, monthlyOriginal: 450, finalMonthly: 427.5, monthlyDiscount: 5 };
  const customLines = [
    { name: 'Sensor especial', quantity: 2, description: 'Proteção de acesso técnico.', kind: 'Personalizado', place: 'Portão lateral', image: 'data:image/webp;base64,aA==' },
    { name: 'Câmera adicional', quantity: 1, description: 'Monitoramento visual.', kind: 'Físico', place: 'Garagem', image: 'data:image/webp;base64,aA==' },
  ];
  const html = buildProposalHtml(customStudy, customLines, assets, 'data:image/png;base64,bA==');
  assert.equal((html.match(/class="page"/g) ?? []).length, 3);
  assert.match(html, /Composição personalizada/);
  assert.match(html, /R\$\s?5\.000,00/);
  assert.match(html, /R\$\s?4\.250,00/);
  assert.match(html, /2 × Sensor especial/);
  const message = buildWhatsAppMessage(customStudy, customLines);
  assert.match(message, /Investimento final dos equipamentos: R\$\s?4\.250,00/);
  assert.doesNotMatch(message, /15%|5%|R\$\s?5\.000|valor a cadastrar/i);
});
