// Fotos reais para produtos que a busca não encontrou no catálogo.
// Procura em bancos de imagens abertos (Openverse e Wikimedia Commons) e guarda o resultado por 30 dias.
// Não recebe nem guarda dados de quem buscou.
const { redis, clean } = require('./_lib');

const UA = 'ShopCompro/1.0 (loja de compras simuladas)';
const BAD = /logo|brand|marca|trademark|icon|ícone|diagram|map|mapa|chart|svg/i;

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  return r.json();
}

// imagem principal do artigo da Wikipédia (ótima para objetos: "alicate", "violino"...)
async function wikipedia(lang, term) {
  try {
    const t = term.charAt(0).toUpperCase() + term.slice(1);
    const d = await getJson('https://' + lang + '.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&titles=' + encodeURIComponent(t));
    const pages = Object.values((d && d.query && d.query.pages) || {});
    return pages.map((p) => p.thumbnail && p.thumbnail.source).filter((u) => u && !/\.svg/i.test(u) && !BAD.test(u));
  } catch { return []; }
}

async function openverse(term) {
  try {
    const d = await getJson('https://api.openverse.org/v1/images/?page_size=16&mature=false&category=photograph&q=' + encodeURIComponent(term));
    return ((d && d.results) || [])
      .filter((x) => x && !BAD.test(x.title || '') && (x.thumbnail || x.url))
      .map((x) => x.thumbnail || x.url);
  } catch { return []; }
}

async function commons(term) {
  try {
    const d = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime&iiurlwidth=480&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + term));
    const pages = Object.values((d && d.query && d.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    return pages
      .filter((p) => !BAD.test(p.title || '') && p.imageinfo && p.imageinfo[0] && /jpeg|png|webp/.test(p.imageinfo[0].mime || ''))
      .map((p) => p.imageinfo[0].thumburl || p.imageinfo[0].url);
  } catch { return []; }
}

module.exports = async (req, res) => {
  const q = clean(req.query.q, 40).toLowerCase();
  const en = clean(req.query.en, 60).toLowerCase();
  if (q.length < 2) return res.status(400).json({ pics: [] });
  const key = 'c:foto:' + q;
  try {
    const [c] = await redis([['GET', key]]);
    if (c && req.query.debug !== '1') { res.setHeader('Cache-Control', 'public, max-age=86400'); return res.status(200).json({ pics: JSON.parse(c) }); }
  } catch {}
  const terms = [...new Set([en, q].filter(Boolean))];
  const debug = req.query.debug === '1' ? {} : null;
  const runs = await Promise.all([
    wikipedia('pt', q), en && en !== q ? wikipedia('en', en) : Promise.resolve([]),
    ...terms.map((t) => openverse(t)), ...terms.map((t) => commons(t)),
  ]);
  if (debug) { debug.wikiPt = runs[0].length; debug.wikiEn = runs[1].length; debug.openverse = runs.slice(2, 2 + terms.length).map((x) => x.length); debug.commons = runs.slice(2 + terms.length).map((x) => x.length); }
  let pics = [].concat(...runs);
  pics = [...new Set(pics)].slice(0, 8);
  if (pics.length) { try { await redis([['SET', key, JSON.stringify(pics), 'EX', 2592000]]); } catch {} }
  res.setHeader('Cache-Control', pics.length ? 'public, max-age=86400' : 'no-store');
  return res.status(200).json(debug ? { pics, debug } : { pics });
};
