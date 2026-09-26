import type { VercelRequest, VercelResponse } from '@vercel/node';

const cookieName = '__Host-malikz_session';
const allowedRoutes = new Set([
  '/api/auth/status', '/api/auth/bootstrap', '/api/auth/login', '/api/auth/logout',
  '/api/session', '/api/records', '/api/admin/features',
]);

function cookieValue(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) return rest.join('=');
  }
  return undefined;
}
function writeError(response: VercelResponse, status: number, message: string) {
  response.status(status).json({ error: message });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const routedPath = request.query.path;
  const normalizedRoute = Array.isArray(routedPath) ? routedPath.join('/') : routedPath;
  const path = typeof normalizedRoute === 'string' && normalizedRoute.trim()
    ? '/api/' + normalizedRoute.replace(/^\/+/, '')
    : (request.url || '').split('?')[0];
  if (!allowedRoutes.has(path)) return writeError(response, 404, 'This service path is not available.');
  if (!['GET', 'POST', 'PUT'].includes(request.method || '')) return writeError(response, 405, 'This request method is not available.');

  const upstream = process.env.MALIKZ_API_URL?.replace(/\/$/, '');
  const proxySecret = process.env.MALIKZ_PROXY_SECRET;
  const siteOrigin = process.env.MALIKZ_SITE_ORIGIN;
  if (!upstream || !proxySecret || proxySecret.length < 32 || !siteOrigin) return writeError(response, 503, 'The private service is not connected yet.');
  let serviceUrl: URL;
  try {
    serviceUrl = new URL(upstream);
    if (serviceUrl.protocol !== 'https:' || !serviceUrl.hostname.startsWith('malikz-tool-api.') || !serviceUrl.hostname.endsWith('.workers.dev')) throw new Error('invalid upstream');
  } catch { return writeError(response, 503, 'The private service address is not configured correctly.'); }

  const isMutation = ['POST', 'PUT'].includes(request.method || '');
  const origin = request.headers.origin;
  let expectedOrigin: string;
  try { expectedOrigin = new URL(siteOrigin).origin; } catch { return writeError(response, 503, 'The website address is not configured correctly.'); }
  if (isMutation && origin !== expectedOrigin) return writeError(response, 403, 'This website is not allowed to change your workspace.');

  const sessionToken = cookieValue(request.headers.cookie);
  const input = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
  if (isMutation && new TextEncoder().encode(input).byteLength > 12_000) return writeError(response, 413, 'That form is too large.');
  const submittedEmail = request.body && typeof request.body === 'object' && 'email' in request.body ? String(request.body.email).toLowerCase().slice(0, 254) : '';
  const headers = new Headers({ 'X-Malikz-Proxy-Key': proxySecret, 'X-Rate-Limit-Key': submittedEmail || 'workspace-user' });
  if (isMutation) headers.set('Content-Type', 'application/json');
  if (origin) headers.set('Origin', origin);
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);

  let result: Response;
  try {
    result = await fetch(new URL(path + (request.url?.includes('?') ? `?${request.url.split('?').slice(1).join('?')}` : ''), serviceUrl), {
      method: request.method,
      headers,
      body: isMutation ? input : undefined,
      signal: AbortSignal.timeout(12_000),
      redirect: 'manual',
    });
  } catch {
    return writeError(response, 502, 'The Cloudflare service is not responding. Please try again shortly.');
  }

  const contentType = result.headers.get('content-type') || '';
  const raw = await result.text();
  let payload: Record<string, unknown> = {};
  if (contentType.includes('application/json')) {
    try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return writeError(response, 502, 'The service returned an unreadable response.'); }
  } else if (!result.ok) return writeError(response, result.status, 'The service could not complete that request.');
  if (!result.ok) return response.status(result.status).json({ error: typeof payload.error === 'string' ? payload.error : 'The request could not be completed.' });

  if ((path === '/api/auth/login' || path === '/api/auth/bootstrap') && typeof payload.sessionToken === 'string') {
    const token = payload.sessionToken;
    delete payload.sessionToken;
    response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax`);
  }
  if (path === '/api/auth/logout') response.setHeader('Set-Cookie', `${cookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
  return response.status(result.status).json(payload);
}
