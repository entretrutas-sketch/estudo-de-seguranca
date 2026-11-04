export const ALLOWED_EMAIL_DOMAINS = ['verisure.com.br'] as const;

export function normalizeCorporateEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedEmail(value: string) {
  const email = normalizeCorporateEmail(value);
  return /^[^\s@]+@verisure\.com\.br$/.test(email);
}

export const allowedEmailMessage = 'Use seu e-mail corporativo terminado em @verisure.com.br.';
