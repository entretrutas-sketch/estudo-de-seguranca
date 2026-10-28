export const CORPORATE_EMAIL_DOMAIN = 'verisure.com.br';

export function normalizeCorporateEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isCorporateEmail(value: string) {
  const email = normalizeCorporateEmail(value);
  return /^[^\s@]+@verisure\.com\.br$/.test(email);
}

export const corporateEmailMessage = 'Use seu e-mail corporativo no formato nome@verisure.com.br.';
