// Quantos amigos chegaram por um link de indicação (para dar cupom a quem indicou).
const { redis, clean } = require('./_lib');
module.exports = async (req, res) => {
  const code = clean(req.query && req.query.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  res.setHeader('Cache-Control', 'no-store');
  if (!code) return res.status(400).json({ count: 0 });
  try { const [n] = await redis([['GET', 'c:ref:' + code]]); return res.status(200).json({ count: Number(n) || 0 }); }
  catch { return res.status(200).json({ count: 0 }); }
};
