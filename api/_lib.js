// Funções compartilhadas pelas rotas da API (arquivos com "_" não viram rota na Vercel).
const crypto = require('crypto');

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Envia vários comandos ao Redis (Upstash) numa só chamada HTTP.
async function redis(cmds) {
  if (!R_URL || !R_TOKEN) throw new Error('banco_nao_configurado');
  const r = await fetch(R_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + R_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis_' + r.status);
  const out = await r.json();
  return out.map((x) => (x && 'result' in x ? x.result : null));
}

// Data de hoje no fuso de São Paulo, no formato AAAA-MM-DD.
function today(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

// Cidade aproximada a partir dos cabeçalhos de geolocalização da Vercel (sem guardar IP).
function cityOf(req) {
  const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  const city = dec(req.headers['x-vercel-ip-city']);
  const uf = dec(req.headers['x-vercel-ip-country-region']);
  const country = dec(req.headers['x-vercel-ip-country']);
  if (!city && !country) return 'Desconhecida';
  return [city || '?', uf, country && country !== 'BR' ? country : ''].filter(Boolean).join(' · ');
}

const clean = (v, n = 60) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

// Sessão do painel: cookie assinado com HMAC, sem guardar senha no navegador.
function secret() { return (process.env.SESSION_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || ''); }
function sign(exp) { return crypto.createHmac('sha256', secret()).update('painel:' + exp).digest('hex'); }
function makeSession(days = 7) { const exp = Date.now() + days * 86400000; return exp + '.' + sign(exp); }
function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)cp_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function sameText(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = { redis, today, cityOf, clean, makeSession, isAdmin, sameText, body };
