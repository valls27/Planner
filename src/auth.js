// Utilidades de autenticación: hash de contraseñas y tokens de sesión
// firmados. Solo usa la Web Crypto API nativa, sin librerías externas.

const enc = new TextEncoder();

function toB64Url(bytes) {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---- Hash de contraseñas (PBKDF2-SHA256) ----
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const iterations = 100000;
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${iterations}$${toB64Url(salt)}$${toB64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromB64Url(parts[2]);
  const expected = parts[3];
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toB64Url(new Uint8Array(bits)) === expected;
}

// ---- Tokens de sesión firmados (estilo JWT simplificado, HMAC-SHA256) ----
async function getHmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const SESSION_DAYS = 30;

export async function createToken(username, secret) {
  const payload = { u: username, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
  const payloadB64 = toB64Url(enc.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigB64 = toB64Url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, fromB64Url(sigB64), enc.encode(payloadB64));
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(payloadB64)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload.u;
  } catch (e) {
    return null;
  }
}

export function getBearerToken(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}
