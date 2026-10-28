export function validateDiscounts(equipmentDiscount: number, monthlyDiscount: number, limits: { equipment: number; monthly: number }) {
  return Number.isFinite(equipmentDiscount) && Number.isFinite(monthlyDiscount)
    && equipmentDiscount >= 0 && equipmentDiscount <= limits.equipment
    && monthlyDiscount >= 0 && monthlyDiscount <= limits.monthly;
}

export function applyDiscount(amount: number, discount: number) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Invalid commercial amount or discount.');
  return Math.round((amount * (1 - discount / 100) + Number.EPSILON) * 100) / 100;
}
