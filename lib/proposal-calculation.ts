export type DiscountLimits = { equipment: number; monthly: number };

export function parseBrazilianAmount(value: string): number | null {
  const raw = value.trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : (raw.match(/\./g)?.length ?? 0) > 1 || /\.\d{3}$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw;
  if (!normalized || !/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function calculateProposalTotals(equipmentGross: number, equipmentDiscount: number, monthlyGross: number, monthlyDiscount: number) {
  return {
    equipmentDiscountAmount: Math.round(equipmentGross * equipmentDiscount) / 100,
    equipmentFinal: Math.round(equipmentGross * (1 - equipmentDiscount / 100) * 100) / 100,
    monthlyDiscountAmount: Math.round(monthlyGross * monthlyDiscount) / 100,
    monthlyFinal: Math.round(monthlyGross * (1 - monthlyDiscount / 100) * 100) / 100,
  };
}

export function discountLimitsExceeded(equipmentDiscount: number, monthlyDiscount: number, limits: DiscountLimits) {
  return !Number.isFinite(equipmentDiscount) || !Number.isFinite(monthlyDiscount)
    || equipmentDiscount < 0 || monthlyDiscount < 0
    || equipmentDiscount > limits.equipment || monthlyDiscount > limits.monthly;
}
