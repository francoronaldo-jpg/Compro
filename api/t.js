// Recebe eventos anônimos do app: visita, busca, compra simulada e tempo de navegação.
// Não recebe nem guarda nome, endereço, e-mail, IP ou dados de cadastro.
const { redis, today, cityOf, clean, body } = require('./_lib');

const EVERY_N_USERS = 100; // cupom para cada 100º visitante único

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'use POST' });
  try {
    const b = await body(req);
    const e = clean(b.e, 10);
    const vid = clean(b.vid, 40).replace(/[^A-Za-z0-9]/g, '');
    if (!vid || !['visit', 'search', 'purchase', 'time'].includes(e)) return res.status(400).json({ error: 'evento inválido' });
    const day = today();
    const city = cityOf(req);
    const now = Date.now();
    const out = {};

    if (e === 'visit') {
      const [isNew] = await redis([['SADD', 'c:uniq', vid]]);
      const cmds = [
        ['INCR', 'c:visits'], ['INCR', 'c:visits:' + day], ['EXPIRE', 'c:visits:' + day, 3456000],
        ['SADD', 'c:uniq:' + day, vid], ['EXPIRE', 'c:uniq:' + day, 3456000],
        ['ZINCRBY', 'c:cities', 1, city],
        ['LPUSH', 'c:recent', JSON.stringify({ t: now, e: 'visita', city })], ['LTRIM', 'c:recent', 0, 59],
      ];
      if (isNew) {
        cmds.push(['ZINCRBY', 'c:cities:uniq', 1, city]);
        const ref = clean(b.ref, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (ref) cmds.push(['INCR', 'c:ref:' + ref], ['ZINCRBY', 'c:refs', 1, ref]);
      }
      cmds.push(['SCARD', 'c:uniq']);
      const r = await redis(cmds);
      const n = r[r.length - 1];
      if (isNew && n && n % EVERY_N_USERS === 0) {
        const code = 'VISITANTE' + n + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        out.coupon = { code, pct: 30, label: '30% por ser o visitante nº ' + n };
        out.n = n;
        await redis([['LPUSH', 'c:recent', JSON.stringify({ t: now, e: 'cupom ' + n + 'º visitante', city })], ['LTRIM', 'c:recent', 0, 59]]);
      }
    } else if (e === 'time') {
      // tempo de navegação: segundos ativos com a página aberta (sem identificar ninguém)
      const sec = Math.round(Math.max(0, Math.min(1800, Number(b.s) || 0)));
      if (sec > 0) {
        const cmds = [['INCRBY', 'c:time:sum', sec], ['INCRBY', 'c:time:sum:' + day, sec], ['EXPIRE', 'c:time:sum:' + day, 3456000]];
        if (b.first) cmds.push(['INCR', 'c:time:n'], ['INCR', 'c:time:n:' + day], ['EXPIRE', 'c:time:n:' + day, 3456000]);
        await redis(cmds);
      }
    } else if (e === 'search') {
      const q = clean(b.q, 40).toLowerCase();
      if (q) await redis([
        ['ZINCRBY', 'c:searches', 1, q], ['INCR', 'c:searches:n:' + day], ['EXPIRE', 'c:searches:n:' + day, 3456000],
        ['LPUSH', 'c:recent', JSON.stringify({ t: now, e: 'busca', city, q })], ['LTRIM', 'c:recent', 0, 59],
      ]);
    } else if (e === 'purchase') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      const total = Math.max(0, Math.min(1e6, Number(b.total) || 0));
      const cmds = [
        ['INCR', 'c:orders'], ['INCR', 'c:orders:' + day], ['EXPIRE', 'c:orders:' + day, 3456000],
        ['INCRBYFLOAT', 'c:revenue', total.toFixed(2)],
        ['LPUSH', 'c:recent', JSON.stringify({ t: now, e: 'compra', city, v: total, n: items.length })], ['LTRIM', 'c:recent', 0, 59],
      ];
      for (const it of items) {
        const name = clean(it && it.n, 80);
        const q = Math.max(1, Math.min(99, Number(it && it.q) || 1));
        if (name) cmds.push(['ZINCRBY', 'c:products', q, name]);
      }
      await redis(cmds);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  } catch (err) {
    return res.status(200).json({ ok: false });
  }
};
