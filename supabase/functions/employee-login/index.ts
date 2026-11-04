const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = request.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) return json({ error: 'Auth service unavailable' }, 503);
    const body = await request.json();
    const employeeNumber = String(body?.employeeNumber ?? '').trim().toUpperCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!/^[A-Z0-9.-]{3,30}$/.test(employeeNumber) || password.length < 1 || password.length > 256) return json({ state: 'invalid' });

    const profileResponse = await fetch(`${url}/rest/v1/profiles?employee_number=eq.${encodeURIComponent(employeeNumber)}&select=email,access_status&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!profileResponse.ok) return json({ error: 'Auth service unavailable' }, 503);
    const profiles = await profileResponse.json();
    const profile = profiles[0];
    if (!profile?.email) return json({ state: 'invalid' });
    if (profile.access_status === 'pending') return json({ state: 'pending' });
    if (profile.access_status !== 'approved') return json({ state: 'rejected' });

    const tokenResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email, password }),
    });
    if (!tokenResponse.ok) return json({ state: 'invalid' });
    const tokens = await tokenResponse.json();
    if (!tokens?.access_token || !tokens?.refresh_token) return json({ state: 'invalid' });
    return json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
});
