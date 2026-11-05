const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const defaultKey = (variable: string) => {
  const raw = Deno.env.get(variable);
  if (!raw) return undefined;
  try { const keys = JSON.parse(raw); return typeof keys?.default === 'string' ? keys.default : undefined; }
  catch { return undefined; }
};
const digest = async (secret: string, scope: string, value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${scope}:${value}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ state: 'invalid' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const legacyServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const serviceKey = legacyServiceKey ?? defaultKey('SUPABASE_SECRET_KEYS');
    const anonKey = request.headers.get('apikey') ?? defaultKey('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) {
      console.error('employee-login unavailable: required environment is missing');
      return json({ error: 'Auth service unavailable' }, 503);
    }

    const body = await request.json();
    const employeeNumber = String(body?.employeeNumber ?? '').trim().toUpperCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!/^[A-Z0-9.-]{3,30}$/.test(employeeNumber) || password.length < 1 || password.length > 256) return json({ state: 'invalid' });

    const clientIp = request.headers.get('cf-connecting-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';
    const bucketKeys = await Promise.all([
      digest(serviceKey, 'employee-login-ip', clientIp),
      digest(serviceKey, 'employee-login-matricula', employeeNumber),
    ]);
    const rateChecks = await Promise.all(bucketKeys.map(async (bucketKey) => {
      const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
      if (legacyServiceKey) headers.Authorization = `Bearer ${legacyServiceKey}`;
      const response = await fetch(`${url}/rest/v1/rpc/consume_employee_login_attempt`, {
        method: 'POST', headers, body: JSON.stringify({ p_bucket_key: bucketKey }),
      });
      if (!response.ok) return false;
      return (await response.json()) === true;
    }));
    if (rateChecks.some((allowed) => !allowed)) return json({ state: 'invalid' });

    const profileResponse = await fetch(`${url}/rest/v1/profiles?employee_number=eq.${encodeURIComponent(employeeNumber)}&select=email,access_status&limit=1`, {
      headers: legacyServiceKey
        ? { apikey: legacyServiceKey, Authorization: `Bearer ${legacyServiceKey}` }
        : { apikey: serviceKey },
    });
    if (!profileResponse.ok) {
      console.error('employee-login profile lookup unavailable', profileResponse.status);
      return json({ error: 'Auth service unavailable' }, 503);
    }
    const profiles = await profileResponse.json();
    const profile = profiles[0];
    // Keep all credential/access failures indistinguishable to avoid matrícula enumeration.
    if (!profile?.email || profile.access_status !== 'approved') return json({ state: 'invalid' });

    const tokenResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email, password }),
    });
    if (!tokenResponse.ok) return json({ state: 'invalid' });
    const tokens = await tokenResponse.json();
    if (!tokens?.access_token || !tokens?.refresh_token) return json({ state: 'invalid' });
    return json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  } catch {
    return json({ error: 'Auth service unavailable' }, 503);
  }
});
