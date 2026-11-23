// Login do painel: compara com a senha guardada na variável ADMIN_PASSWORD da Vercel.
const { redis, sameText, makeSession, body } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'cp_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'use POST' });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'A senha do painel ainda não foi configurada na Vercel (ADMIN_PASSWORD).' });
  const ipKey = 'c:loginfail:' + String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
  let fails = 0;
  try { [fails] = await redis([['GET', ipKey]]); } catch {}
  if (Number(fails) >= 10) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
  const b = await body(req);
  if (!sameText(b.password || '', process.env.ADMIN_PASSWORD)) {
    try { await redis([['INCR', ipKey], ['EXPIRE', ipKey, 900]]); } catch {}
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  res.setHeader('Set-Cookie', 'cp_admin=' + makeSession() + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800');
  return res.status(200).json({ ok: true });
};
