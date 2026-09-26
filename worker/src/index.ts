interface Env {
  DB: D1Database;
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  AUTH_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ALLOWED_ORIGINS: string;
  ADMIN_EMAIL: string;
  BOOTSTRAP_SECRET: string;
  SESSION_SECRET: string;
  API_PROXY_SECRET: string;
}
type User = { email: string; admin: boolean };
type Feature = { key: string; label: string; description: string; enabled: boolean };

const featureKeys = new Set(['device_check', 'repair_records', 'firmware_check']);
const encoder = new TextEncoder();

function json(value: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra },
  });
}
function cleanEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : '';
}
function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(',').map(value => value.trim()).filter(Boolean));
}
function originResponse(request: Request, env: Env): Response | null {
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS' && (!origin || !allowedOrigins(env).has(origin))) {
    return json({ error: 'This request origin is not allowed.' }, 403);
  }
  if (request.method === 'OPTIONS') {
    if (!origin || !allowedOrigins(env).has(origin)) return json({ error: 'This website is not allowed to use the service.' }, 403);
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600', 'Vary': 'Origin',
    } });
  }
  return null;
}
function addCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function unbase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}
async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
async function createSession(email: string, env: Env): Promise<string> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Session secret is not configured securely');
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(encoder.encode(JSON.stringify({ sub: email, role: 'admin', iat: now, exp: now + 12 * 60 * 60, jti: crypto.randomUUID() })));
  const unsigned = `${head}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET, ['sign']), encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}
async function authenticate(request: Request, env: Env): Promise<User | null> {
  const value = request.headers.get('Authorization') || '';
  const [scheme, token] = value.split(' ', 2);
  if (scheme !== 'Bearer' || !token || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
  try {
    const [head, body, signature, extra] = token.split('.');
    if (!head || !body || !signature || extra) return null;
    const header = JSON.parse(new TextDecoder().decode(unbase64url(head))) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET, ['verify']), unbase64url(signature), encoder.encode(`${head}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(unbase64url(body))) as { sub?: unknown; role?: unknown; exp?: unknown };
    const email = cleanEmail(payload.sub);
    if (!email || payload.role !== 'admin' || typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    const row = await env.DB.prepare('SELECT email FROM users WHERE email = ? AND role = \'admin\'').bind(email).first();
    return row ? { email, admin: true } : null;
  } catch { return null; }
}
async function equalSecret(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(left)), crypto.subtle.digest('SHA-256', encoder.encode(right))]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function proxyAllowed(request: Request, env: Env): Promise<boolean> {
  const value = request.headers.get('X-Malikz-Proxy-Key') || '';
  if (value.length < 32 || !env.API_PROXY_SECRET || env.API_PROXY_SECRET.length < 32) return false;
  return equalSecret(value, env.API_PROXY_SECRET);
}
async function limit(request: Request, env: Env, identityOverride?: string, auth = false): Promise<boolean> {
  const binding = auth ? env.AUTH_RATE_LIMITER : env.RATE_LIMITER;
  const identity = identityOverride || request.headers.get('X-Rate-Limit-Key') || 'unknown-identity';
  const source = request.headers.get('CF-Connecting-IP') || 'unknown-source';
  try {
    const identityLimit = await binding.limit({ key: `identity:${identity.slice(0, 170)}` });
    const sourceLimit = await binding.limit({ key: `source:${source.slice(0, 170)}` });
    return identityLimit.success && sourceLimit.success;
  }
  catch { return false; }
}
async function featureList(env: Env): Promise<Feature[]> {
  const rows = await env.DB.prepare('SELECT key, label, description, enabled FROM feature_flags ORDER BY key').all<Omit<Feature, 'enabled'> & { enabled: number }>();
  return rows.results.map(row => ({ ...row, enabled: row.enabled === 1 }));
}
async function featureEnabled(env: Env, key: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT enabled FROM feature_flags WHERE key = ?').bind(key).first<{ enabled: number }>();
  return row?.enabled === 1;
}
async function bodyJson(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().startsWith('application/json')) return null;
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 12_000) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder().decode(joined));
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}
function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length && clean.length <= max ? clean : null;
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'ok' });
  if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
  const origin = originResponse(request, env);
  if (origin) return origin;
  if (!(await proxyAllowed(request, env))) return json({ error: 'This service only accepts requests from the website.' }, 403);
  if (url.pathname === '/api/auth/status' && request.method === 'GET') {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").first<{ count: number }>();
    return json({ initialized: (count?.count || 0) > 0 });
  }
  if (url.pathname === '/api/auth/bootstrap' && request.method === 'POST') {
    const body = await bodyJson(request);
    const email = cleanEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    const bootstrapSecret = typeof body?.bootstrapSecret === 'string' ? body.bootstrapSecret : '';
    if (!(await limit(request, env, `bootstrap:${email || 'unknown'}`, true))) return json({ error: 'Too many setup attempts. Wait a minute and try again.' }, 429);
    if (!email || email !== cleanEmail(env.ADMIN_EMAIL) || password.length < 14 || password.length > 256 || !env.BOOTSTRAP_SECRET || env.BOOTSTRAP_SECRET.length < 32 || !(await equalSecret(bootstrapSecret, env.BOOTSTRAP_SECRET))) {
      return json({ error: 'The owner details or one-time setup code are not valid.' }, 403);
    }
    const current = await env.DB.prepare("SELECT email FROM users WHERE role = 'admin' LIMIT 1").first();
    if (current) return json({ error: 'The owner account has already been set up. Sign in instead.' }, 409);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashPassword(password, salt);
    const created = await env.DB.prepare("INSERT INTO users (email, role, salt, password_hash) SELECT ?, 'admin', ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')")
      .bind(email, base64url(salt), passwordHash).run();
    if (!created.meta.changes) return json({ error: 'The owner account has already been set up. Sign in instead.' }, 409);
    return json({ sessionToken: await createSession(email, env), session: { email, isAdmin: true }, features: await featureList(env) }, 201);
  }
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await bodyJson(request);
    const email = cleanEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!(await limit(request, env, `login:${email || 'unknown'}`, true))) return json({ error: 'Too many sign-in attempts. Wait a minute and try again.' }, 429);
    const row = await env.DB.prepare("SELECT email, salt, password_hash FROM users WHERE email = ? AND role = 'admin'").bind(email).first<{ email: string; salt: string; password_hash: string }>();
    const dummySalt = new Uint8Array(16);
    const candidate = await hashPassword(password.slice(0, 256), row ? unbase64url(row.salt) : dummySalt);
    if (!row || password.length > 256 || !(await equalSecret(candidate, row.password_hash))) return json({ error: 'Email or password is not correct.' }, 401);
    return json({ sessionToken: await createSession(email, env), session: { email, isAdmin: true }, features: await featureList(env) });
  }
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Sign in through the approved workspace to continue.' }, 401);

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return json({ ok: true });

  if (url.pathname === '/api/session' && request.method === 'GET') {
    return json({ session: { email: user.email, isAdmin: user.admin }, features: await featureList(env) });
  }

  if (url.pathname === '/api/records') {
    if (!(await featureEnabled(env, 'repair_records'))) return json({ error: 'Repair records are turned off by the site owner.' }, 404);
    if (request.method === 'GET') {
      const results = await env.DB.prepare('SELECT id, device, issue, work, outcome, created_at AS createdAt FROM repair_records WHERE owner_email = ? ORDER BY created_at DESC LIMIT 100').bind(user.email).all();
      return json({ records: results.results });
    }
    if (request.method === 'POST') {
      if (!(await limit(request, env))) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);
      const body = await bodyJson(request);
      if (!body) return json({ error: 'Send the repair note as a JSON form.' }, 400);
      const device = boundedText(body.device, 120), issue = boundedText(body.issue, 2000), work = boundedText(body.work, 4000);
      const outcome = body.outcome;
      if (!device || device.length < 2 || !issue || issue.length < 4 || !work || work.length < 4 || !['open', 'in_progress', 'completed'].includes(String(outcome))) {
        return json({ error: 'Check the device, reported problem, work notes, and status fields.' }, 400);
      }
      const id = crypto.randomUUID();
      const created = await env.DB.prepare('INSERT INTO repair_records (id, owner_email, device, issue, work, outcome) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, device, issue, work, outcome, created_at AS createdAt')
        .bind(id, user.email, device, issue, work, outcome).first();
      return json({ record: created }, 201);
    }
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (url.pathname === '/api/admin/features') {
    if (!user.admin) return json({ error: 'Admin access is required for website settings.' }, 403);
    if (request.method === 'GET') return json({ features: await featureList(env) });
    if (request.method === 'PUT') {
      const body = await bodyJson(request);
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!featureKeys.has(key) || typeof body?.enabled !== 'boolean') return json({ error: 'Choose a listed feature and turn it on or off.' }, 400);
      await env.DB.prepare('UPDATE feature_flags SET enabled = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\'), updated_by = ? WHERE key = ?')
        .bind(body.enabled ? 1 : 0, user.email, key).run();
      await env.DB.prepare('INSERT INTO admin_audit (id, actor_email, action, target) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), user.email, body.enabled ? 'feature_enabled' : 'feature_disabled', key).run();
      const feature = (await featureList(env)).find(item => item.key === key);
      return feature ? json({ feature }) : json({ error: 'Feature not found.' }, 404);
    }
    return json({ error: 'Method not allowed.' }, 405);
  }
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return addCors(await route(request, env), request, env); }
    catch (error) {
      // Do not return SQL, token, or platform errors to the browser.
      console.error('API request failed', error instanceof Error ? error.name : 'unknown');
      return addCors(json({ error: 'The service could not complete that request. Try again in a moment.' }, 500), request, env);
    }
  },
};
