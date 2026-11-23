// Números do painel. Só responde com o cookie de sessão do painel.
const { redis, today, isAdmin } = require('./_lib');
const pairs = (arr) => { const o = []; for (let i = 0; i < (arr || []).length; i += 2) o.push({ k: arr[i], v: Number(arr[i + 1]) }); return o; };
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdmin(req)) return res.status(401).json({ error: 'login necessário' });
  try {
    const days = Array.from({ length: 14 }, (_, i) => today(13 - i));
    const cmds = [
      ['GET', 'c:visits'], ['SCARD', 'c:uniq'], ['GET', 'c:orders'], ['GET', 'c:revenue'],
      ['ZREVRANGE', 'c:cities', 0, 14, 'WITHSCORES'], ['ZREVRANGE', 'c:cities:uniq', 0, 14, 'WITHSCORES'],
      ['ZREVRANGE', 'c:searches', 0, 19, 'WITHSCORES'], ['ZREVRANGE', 'c:products', 0, 19, 'WITHSCORES'],
      ['ZREVRANGE', 'c:refs', 0, 9, 'WITHSCORES'], ['LRANGE', 'c:recent', 0, 29],
    ];
    for (const d of days) cmds.push(['GET', 'c:visits:' + d], ['SCARD', 'c:uniq:' + d], ['GET', 'c:orders:' + d], ['GET', 'c:searches:n:' + d]);
    const r = await redis(cmds);
    const series = days.map((d, i) => ({ d, visits: Number(r[10 + i * 4]) || 0, uniq: Number(r[11 + i * 4]) || 0, orders: Number(r[12 + i * 4]) || 0, searches: Number(r[13 + i * 4]) || 0 }));
    return res.status(200).json({
      totals: { visits: Number(r[0]) || 0, uniq: Number(r[1]) || 0, orders: Number(r[2]) || 0, revenue: Number(r[3]) || 0 },
      cities: pairs(r[4]), citiesUniq: pairs(r[5]), searches: pairs(r[6]), products: pairs(r[7]), refs: pairs(r[8]),
      recent: (r[9] || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean),
      series, generatedAt: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message === 'banco_nao_configurado' ? 'O banco de dados ainda não foi conectado ao projeto na Vercel.' : 'Falha ao ler os dados.' });
  }
};
