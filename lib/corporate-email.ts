export const ALLOWED_EMAIL_DOMAINS = ['verisure.com.br', 'gmail.com'] as const;

export function normalizeCorporateEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedEmail(value: string) {
  const email = normalizeCorporateEmail(value);
  return /^[^\s@]+@(?:verisure\.com\.br|gmail\.com)$/.test(email);
}

export const allowedEmailMessage = 'Use uma conta @verisure.com.br ou @gmail.com para validar o aplicativo.';
