import { hashPassword, verifyPassword, createToken, verifyToken, getBearerToken } from './auth.js';

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'JSON inválido' }, 400);
  }
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return json({ error: 'usuario inválido' }, 400);
  if (password.length < 6) return json({ error: 'contraseña demasiado corta' }, 400);

  const existing = await env.USERS.get(`user:${username}`);
  if (existing) return json({ error: 'exists' }, 409);

  const passwordHash = await hashPassword(password);
  await env.USERS.put(`user:${username}`, JSON.stringify({ passwordHash, createdAt: new Date().toISOString() }));

  const token = await createToken(username, env.JWT_SECRET);
  return json({ token });
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'JSON inválido' }, 400);
  }
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  const raw = await env.USERS.get(`user:${username}`);
  if (!raw) return json({ error: 'credenciales inválidas' }, 401);
  const user = JSON.parse(raw);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return json({ error: 'credenciales inválidas' }, 401);

  const token = await createToken(username, env.JWT_SECRET);
  return json({ token });
}

async function authenticate(request, env) {
  const token = getBearerToken(request);
  return verifyToken(token, env.JWT_SECRET);
}

async function handleGetData(request, env) {
  const username = await authenticate(request, env);
  if (!username) return json({ error: 'no autorizado' }, 401);
  const raw = await env.APPDATA.get(`data:${username}`);
  return json({ data: raw ? JSON.parse(raw) : null });
}

async function handlePutData(request, env) {
  const username = await authenticate(request, env);
  if (!username) return json({ error: 'no autorizado' }, 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (!body || typeof body.data !== 'object') return json({ error: 'falta "data"' }, 400);
  await env.APPDATA.put(`data:${username}`, JSON.stringify(body.data));
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/register' && request.method === 'POST') return handleRegister(request, env);
    if (path === '/api/login' && request.method === 'POST') return handleLogin(request, env);
    if (path === '/api/data' && request.method === 'GET') return handleGetData(request, env);
    if (path === '/api/data' && request.method === 'PUT') return handlePutData(request, env);
    if (path.startsWith('/api/')) return json({ error: 'no encontrado' }, 404);

    // Cualquier otra ruta: servir el archivo estático correspondiente
    // (index.html, css, imágenes...) desde la carpeta public/.
    return env.ASSETS.fetch(request);
  },
};
