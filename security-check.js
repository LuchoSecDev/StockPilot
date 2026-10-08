#!/usr/bin/env node
/**
 * security-check.js
 * ------------------------------------------------------------------
 * Verificador rápido de configuración de seguridad para apps
 * React + Vite (frontend) + Node/Express (backend), desplegadas en
 * Render/Neon o similar.
 *
 * NO es un escáner de vulnerabilidades (no reemplaza ZAP/Burp/sqlmap).
 * Solo revisa configuración expuesta en runtime:
 *   1. Headers de seguridad HTTP
 *   2. Flags de cookies de sesión
 *   3. Secretos filtrados en el bundle JS público (VITE_ mal usado, etc.)
 *   4. Configuración de CORS
 *   5. (Opcional, desactivado por defecto) Prueba suave de rate limiting
 *
 * Uso:
 *   node security-check.js https://tuapp.onrender.com
 *   node security-check.js https://tuapp.onrender.com --ratelimit=/api/login --attempts=15
 *
 * Requiere Node.js 18+ (usa fetch nativo). No necesita npm install.
 * ------------------------------------------------------------------
 * Úsalo SOLO contra aplicaciones de tu propiedad o con autorización
 * explícita. La prueba de rate limiting hace peticiones repetidas
 * reales contra el endpoint indicado: úsala con --attempts bajo.
 * ------------------------------------------------------------------
 */

const args = process.argv.slice(2);
const baseUrlArg = args.find(a => !a.startsWith('--'));
const rateLimitPath = (args.find(a => a.startsWith('--ratelimit=')) || '').split('=')[1];
const attempts = parseInt((args.find(a => a.startsWith('--attempts=')) || '').split('=')[1] || '10', 10);

if (!baseUrlArg) {
  console.error('Uso: node security-check.js <URL_BASE> [--ratelimit=/api/login] [--attempts=10]');
  process.exit(1);
}

const BASE_URL = baseUrlArg.replace(/\/$/, '');

// ---------- utilidades de salida ----------
const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', BOLD = '\x1b[1m';
const ok   = (msg) => console.log(`${GREEN}  [OK]${RESET}   ${msg}`);
const warn = (msg) => console.log(`${YELLOW}  [WARN]${RESET} ${msg}`);
const fail = (msg) => console.log(`${RED}  [FALLA]${RESET} ${msg}`);
const info = (msg) => console.log(`${CYAN}  [INFO]${RESET} ${msg}`);
const section = (title) => console.log(`\n${BOLD}== ${title} ==${RESET}`);

const summary = { ok: 0, warn: 0, fail: 0 };
const track = (level) => { summary[level]++; };
const rOk = (m) => { ok(m); track('ok'); };
const rWarn = (m) => { warn(m); track('warn'); };
const rFail = (m) => { fail(m); track('fail'); };

// Enmascara un posible secreto para no imprimirlo completo en consola/logs
function mask(secret) {
  if (secret.length <= 10) return '*'.repeat(secret.length);
  return secret.slice(0, 6) + '...' + secret.slice(-4) + `  (${secret.length} caracteres)`;
}

// ---------- 1. Headers de seguridad ----------
async function checkHeaders(url) {
  section('1. Headers de seguridad HTTP');
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    rFail(`No se pudo conectar a ${url}: ${e.message}`);
    return null;
  }

  const h = res.headers;
  const checks = [
    { name: 'Strict-Transport-Security', key: 'strict-transport-security', why: 'fuerza HTTPS en visitas futuras (protege contra downgrade a HTTP)' },
    { name: 'X-Content-Type-Options', key: 'x-content-type-options', expect: 'nosniff', why: 'evita que el navegador "adivine" tipos MIME' },
    { name: 'X-Frame-Options', key: 'x-frame-options', why: 'protege contra clickjacking (o usa CSP frame-ancestors)' },
    { name: 'Content-Security-Policy', key: 'content-security-policy', why: 'limita de dónde se puede cargar/ejecutar script' },
    { name: 'Referrer-Policy', key: 'referrer-policy', why: 'controla qué se filtra en el header Referer' },
    { name: 'Permissions-Policy', key: 'permissions-policy', why: 'restringe APIs del navegador (cámara, geolocalización, etc.)' },
  ];

  for (const c of checks) {
    const val = h.get(c.key);
    if (!val) {
      rWarn(`Falta "${c.name}" — ${c.why}`);
    } else if (c.expect && !val.toLowerCase().includes(c.expect)) {
      rWarn(`"${c.name}" presente pero con valor inesperado: "${val}"`);
    } else {
      rOk(`"${c.name}": ${val}`);
    }
  }

  const poweredBy = h.get('x-powered-by');
  if (poweredBy) {
    rWarn(`El header "X-Powered-By: ${poweredBy}" revela tecnología del backend — desactívalo con app.disable('x-powered-by') en Express (Helmet lo hace por ti).`);
  } else {
    rOk('"X-Powered-By" no está presente (bien, no filtra stack).');
  }

  return res;
}

// ---------- 2. Cookies de sesión ----------
function checkCookies(res) {
  section('2. Cookies de sesión');
  if (!res) return;
  // getSetCookie() está disponible en Node 18.14+/20+; fallback a headers.get
  let cookies = [];
  if (typeof res.headers.getSetCookie === 'function') {
    cookies = res.headers.getSetCookie();
  } else {
    const single = res.headers.get('set-cookie');
    if (single) cookies = [single];
  }

  if (cookies.length === 0) {
    info('No se recibió ninguna cookie en la petición inicial (normal si la sesión se crea solo tras login).');
    return;
  }

  for (const c of cookies) {
    const name = c.split('=')[0];
    const lower = c.toLowerCase();
    info(`Cookie encontrada: ${name}`);
    if (!lower.includes('httponly')) rFail(`  → falta "HttpOnly" en "${name}" (accesible desde JS, riesgo si hay XSS)`);
    else rOk(`  → "HttpOnly" presente`);
    if (!lower.includes('secure')) rFail(`  → falta "Secure" en "${name}" (podría viajar por HTTP)`);
    else rOk(`  → "Secure" presente`);
    if (!lower.includes('samesite')) rWarn(`  → falta "SameSite" en "${name}" (riesgo de CSRF)`);
    else rOk(`  → "SameSite" presente (${(lower.match(/samesite=(\w+)/) || [])[1] || '?'})`);
  }
}

// ---------- 3. Secretos filtrados en el bundle JS ----------
const SECRET_PATTERNS = [
  { name: 'OpenAI API key', regex: /sk-(proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: 'Resend API key', regex: /re_[A-Za-z0-9_]{20,}/g },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Postgres connection string', regex: /postgres(ql)?:\/\/[^\s"'`]+/g },
  { name: 'Redis connection string', regex: /redis:\/\/[^\s"'`]+/g },
  { name: 'JWT secret (variable sospechosa)', regex: /(SESSION_SECRET|JWT_SECRET)\s*[:=]\s*["'`][^"'`]{8,}["'`]/gi },
  { name: 'Posible clave privada', regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
];

async function checkBundle(baseUrl) {
  section('3. Búsqueda de secretos en el bundle público (frontend)');
  let html;
  try {
    const res = await fetch(baseUrl);
    html = await res.text();
  } catch (e) {
    rFail(`No se pudo descargar ${baseUrl}: ${e.message}`);
    return;
  }

  // Extrae URLs de scripts (Vite genera /assets/*.js) y hojas de estilo
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  const linkHrefs = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)].map(m => m[1]);

  const assetUrls = [...new Set([...scriptSrcs, ...linkHrefs])].map(src => {
    try { return new URL(src, baseUrl + '/').href; } catch { return null; }
  }).filter(Boolean);

  if (assetUrls.length === 0) {
    rWarn('No se encontraron <script src="..."> en el HTML principal (¿SPA con carga dinámica? revisa manualmente en DevTools → Sources).');
    return;
  }

  info(`Analizando ${assetUrls.length} archivo(s) estático(s)...`);

  let found = 0;
  for (const url of assetUrls) {
    let text;
    try {
      const r = await fetch(url);
      text = await r.text();
    } catch {
      continue;
    }
    for (const pattern of SECRET_PATTERNS) {
      const matches = text.match(pattern.regex);
      if (matches) {
        for (const m of [...new Set(matches)]) {
          rFail(`Posible ${pattern.name} expuesta en ${url}\n           → ${mask(m)}`);
          found++;
        }
      }
    }
  }

  if (found === 0) {
    rOk('No se detectaron patrones de secretos conocidos en los archivos públicos analizados.');
    info('Esto no garantiza ausencia total de fugas — revisa también manualmente variables VITE_* en tu .env.');
  }
}

// ---------- 4. CORS ----------
async function checkCORS(baseUrl) {
  section('4. Configuración de CORS');
  const fakeOrigin = 'https://dominio-que-no-deberia-funcionar.example.com';
  try {
    const res = await fetch(baseUrl, { headers: { Origin: fakeOrigin } });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const allowCreds = res.headers.get('access-control-allow-credentials');

    if (!allowOrigin) {
      rOk('No se refleja Access-Control-Allow-Origin para un origen arbitrario (endpoint raíz al menos no es abierto).');
      info('Nota: prueba también contra tus endpoints de API reales (/api/...), no solo la raíz.');
      return;
    }
    if (allowOrigin === '*' && allowCreds === 'true') {
      rFail('CORS crítico: Access-Control-Allow-Origin "*" combinado con Allow-Credentials "true" — esto es inválido por spec pero si tu proxy/CDN lo permite, expone datos de sesión a cualquier sitio.');
    } else if (allowOrigin === fakeOrigin) {
      rFail(`CORS refleja CUALQUIER origen (respondió con "${fakeOrigin}") — cualquier sitio externo puede leer la respuesta si además hay credentials.`);
    } else if (allowOrigin === '*') {
      rWarn('Access-Control-Allow-Origin es "*" (abierto a cualquier origen). Aceptable solo si el endpoint es público y no maneja sesión/cookies.');
    } else {
      rOk(`Access-Control-Allow-Origin restringido a: ${allowOrigin}`);
    }
  } catch (e) {
    rWarn(`No se pudo verificar CORS: ${e.message}`);
  }
}

// ---------- 5. (Opcional) Prueba suave de rate limiting ----------
async function checkRateLimit(baseUrl, path, maxAttempts) {
  section(`5. Prueba de rate limiting en ${path}`);
  warn(`Se enviarán hasta ${maxAttempts} peticiones reales a ${baseUrl}${path}. Asegúrate de tener autorización y de que no sea una acción costosa (ej. no apuntes esto al endpoint de IA).`);

  let blockedAt = null;
  for (let i = 1; i <= maxAttempts; i++) {
    let res;
    try {
      res = await fetch(baseUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } catch (e) {
      info(`Intento ${i}: error de red (${e.message})`);
      continue;
    }
    if (res.status === 429) {
      blockedAt = i;
      break;
    }
    await new Promise(r => setTimeout(r, 150)); // pequeña pausa, no martillar el servidor
  }

  if (blockedAt) {
    rOk(`Rate limiting activo: bloqueado (HTTP 429) tras ${blockedAt} intento(s).`);
  } else {
    rWarn(`No se recibió HTTP 429 tras ${maxAttempts} intentos. Puede que el límite sea más alto, o que no haya rate limiting en esta ruta — verifica manualmente.`);
  }
}

// ---------- main ----------
(async () => {
  console.log(`${BOLD}Verificación de seguridad de configuración — ${BASE_URL}${RESET}`);
  console.log('(Solo config/runtime — no reemplaza un pentest ni un escaneo OWASP ZAP/Burp completo)\n');

  const res = await checkHeaders(BASE_URL);
  checkCookies(res);
  await checkBundle(BASE_URL);
  await checkCORS(BASE_URL);

  if (rateLimitPath) {
    await checkRateLimit(BASE_URL, rateLimitPath, attempts);
  } else {
    section('5. Prueba de rate limiting');
    info('Omitida (usa --ratelimit=/ruta/a/probar --attempts=10 para activarla).');
  }

  section('Resumen');
  console.log(`  ${GREEN}OK: ${summary.ok}${RESET}   ${YELLOW}Advertencias: ${summary.warn}${RESET}   ${RED}Fallas: ${summary.fail}${RESET}\n`);
})();
