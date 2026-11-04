export const ALLOWED_EMAIL_DOMAINS = ['gmail.com'] as const;

export function normalizeCorporateEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedEmail(value: string) {
  const email = normalizeCorporateEmail(value);
  return /^[^\s@]+@gmail\.com$/.test(email);
}

export const allowedEmailMessage = 'Entre com uma conta Google pessoal terminada em @gmail.com.';
