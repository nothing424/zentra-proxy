// =============================================
// ZENTRA PROXY — api/anime.js
// Deploy ke Vercel sebagai serverless function
// Endpoint: /api/anime
// =============================================

const axios   = require('axios');
const cheerio = require('cheerio');

// ── CONFIG ────────────────────────────────────
const BASE   = 'https://otakudesu.cloud';
const BACKUP = 'https://otakudesu.lol';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
  'Referer': BASE,
  'DNT': '1',
};

// In-memory cache (reset setiap cold start Vercel)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 menit

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { data, time: Date.now() }); return data; }

// ── HTTP FETCH ────────────────────────────────
async function fetchHTML(path, base = BASE) {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
  return cheerio.load(res.data);
}

// ── HANDLERS ──────────────────────────────────

// GET /api/anime?action=latest&page=1
async function getLatest(page = 1) {
  const key = `latest_${page}`;
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML(`/?page=${page}`);
  const results = [];

  $('.venz ul li').each((_, el) => {
    const $el  = $(el);
    const title = $el.find('.thumb a').attr('title') || $el.find('h2').text().trim();
    const url   = $el.find('.thumb a').attr('href') || '';
    const img   = $el.find('.thumb img').attr('src') || $el.find('.thumb img').attr('data-src') || '';
    const ep    = $el.find('.epz').text().trim() || $el.find('.epztipe').text().trim();
    const slug  = url.replace(/\/+$/, '').split('/').pop();
    if (title && slug) results.push({ title, slug, img, episode: ep, url });
  });

  // fallback selector
  if (!results.length) {
    $('.venz2 ul li, .episodelist ul li').each((_, el) => {
      const $el  = $(el);
      const title = $el.find('a').attr('title') || $el.find('h2').text().trim();
      const url   = $el.find('a').attr('href') || '';
      const img   = $el.find('img').attr('src') || '';
      const slug  = url.replace(/\/+$/, '').split('/').pop();
      if (title && slug) results.push({ title, slug, img, url });
    });
  }

  return setCache(key, { results, page });
}

// GET /api/anime?action=search&q=naruto
async function searchAnime(q) {
  const key = `search_${q}`;
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML(`/?s=${encodeURIComponent(q)}&post_type=anime`);
  const results = [];

  $('.chivsrc ul li, .venz ul li').each((_, el) => {
    const $el  = $(el);
    const title = $el.find('h2').text().trim() || $el.find('a').attr('title');
    const url   = $el.find('a').attr('href') || '';
    const img   = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const genre = $el.find('.set').text().trim();
    const score = $el.find('.epz').text().trim();
    const slug  = url.replace(/\/+$/, '').split('/').pop();
    if (title && slug) results.push({ title, slug, img, genre, score, url });
  });

  return setCache(key, { results, query: q });
}

// GET /api/anime?action=detail&slug=naruto-sub-indo
async function getDetail(slug) {
  const key = `detail_${slug}`;
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML(`/anime/${slug}/`);

  const title    = $('.infozingle b:contains("Judul")').parent().text().replace('Judul:', '').trim()
                || $('h1.entry-title').text().trim();
  const japTitle = $('.infozingle b:contains("Japanese")').parent().text().replace('Japanese:', '').trim();
  const synopsis = $('.sinopc').text().trim() || $('.desc').text().trim();
  const img      = $('.fotoanime img').attr('src') || $('.infoanime img').attr('src') || '';
  const score    = $('.infozingle b:contains("Skor")').parent().text().replace('Skor:', '').trim();
  const status   = $('.infozingle b:contains("Status")').parent().text().replace('Status:', '').trim();
  const studio   = $('.infozingle b:contains("Studio")').parent().text().replace('Studio:', '').trim();
  const episodes = $('.infozingle b:contains("Episode")').parent().text().replace('Episode:', '').trim();
  const type     = $('.infozingle b:contains("Tipe")').parent().text().replace('Tipe:', '').trim();
  const aired    = $('.infozingle b:contains("Tanggal")').parent().text().replace('Tanggal Rilis:', '').trim();

  const genres = [];
  $('.infozingle b:contains("Genre")').parent().find('a').each((_, el) => {
    genres.push($(el).text().trim());
  });

  // Episode list
  const epList = [];
  $('.episodelist ul li, #venkonten ul li').each((_, el) => {
    const $el = $(el);
    const epUrl   = $el.find('a').attr('href') || '';
    const epTitle = $el.find('a').text().trim();
    const epSlug  = epUrl.replace(/\/+$/, '').split('/').pop();
    const epNum   = epTitle.match(/Episode\s*(\d+)/i)?.[1];
    if (epSlug) epList.push({ slug: epSlug, title: epTitle, episode: epNum ? parseInt(epNum) : null, url: epUrl });
  });
  epList.reverse();

  return setCache(key, { title, japTitle, synopsis, img, score, status, studio, episodes, type, aired, genres, epList: epList.slice(0, 500), slug });
}

// GET /api/anime?action=episode&slug=naruto-episode-1-sub-indo
async function getEpisode(slug) {
  const key = `ep_${slug}`;
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML(`/episode/${slug}/`);

  const title    = $('h1.entry-title').text().trim() || $('title').text().trim();
  const prevUrl  = $('.nextprev a:contains("Sebelumnya"), .nextprev a:contains("Prev")').attr('href') || '';
  const nextUrl  = $('.nextprev a:contains("Selanjutnya"), .nextprev a:contains("Next")').attr('href') || '';
  const prevSlug = prevUrl.replace(/\/+$/, '').split('/').pop();
  const nextSlug = nextUrl.replace(/\/+$/, '').split('/').pop();

  // Ambil semua mirror links
  const mirrors = [];
  $('.mirrorstream ul li, .mirrorstream li').each((_, el) => {
    const $el    = $(el);
    const label  = $el.find('a').text().trim() || $el.text().trim();
    const dataId = $el.find('a').attr('data-content') || $el.find('a').attr('onclick') || '';
    if (label) mirrors.push({ label, dataId });
  });

  // Download links per quality
  const downloads = {};
  $('.download ul li, .dlbod ul li').each((_, el) => {
    const $el    = $(el);
    const qual   = $el.find('strong').text().trim() || $el.find('b').text().trim();
    const links  = [];
    $el.find('a').each((_, a) => {
      const host = $(a).text().trim();
      const href = $(a).attr('href') || '';
      if (href && host) links.push({ host, href });
    });
    if (qual && links.length) downloads[qual] = links;
  });

  // Try to get direct video embed URL
  // OtakuDesu uses iframe embed dari berbagai host
  const iframes = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && src.includes('http')) iframes.push(src);
  });

  return setCache(key, { title, slug, prevSlug, nextSlug, mirrors, downloads, iframes });
}

// GET /api/anime?action=stream&url=https://...
// Proxy untuk resolve stream URL dari host eksternal
async function resolveStream(url) {
  if (!url) throw new Error('URL required');
  const key = `stream_${url}`;
  const cached = getCache(key);
  if (cached) return cached;

  const res = await axios.get(url, {
    headers: { ...HEADERS, Referer: BASE },
    timeout: 10000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(res.data);

  // Cari direct video source
  const sources = [];

  // <source> tags
  $('source').each((_, el) => {
    const src = $(el).attr('src');
    const type = $(el).attr('type') || '';
    if (src) sources.push({ src, type, quality: $(el).attr('label') || 'auto' });
  });

  // file: "..." pattern (JWPlayer, Plyr)
  const fileMatches = res.data.match(/(?:file|src)\s*:\s*["']([^"']+\.(?:mp4|m3u8|mkv)[^"']*)/gi) || [];
  fileMatches.forEach(m => {
    const src = m.match(/["']([^"']+)["']/)?.[1];
    if (src) sources.push({ src, type: src.includes('m3u8') ? 'hls' : 'mp4', quality: 'auto' });
  });

  // sources: [...] array pattern
  const sourcesMatch = res.data.match(/sources\s*:\s*\[([\s\S]*?)\]/);
  if (sourcesMatch) {
    const inner = sourcesMatch[1];
    const srcs = inner.match(/["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/g) || [];
    srcs.forEach(s => {
      const src = s.replace(/["']/g, '');
      sources.push({ src, type: src.includes('m3u8') ? 'hls' : 'mp4', quality: 'auto' });
    });
  }

  // iframe nested
  const iframes = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) iframes.push(src);
  });

  return setCache(key, { sources: [...new Map(sources.map(s => [s.src, s])).values()], iframes });
}

// GET /api/anime?action=ongoing
async function getOngoing() {
  const key = 'ongoing';
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML('/ongoing-anime/');
  const results = [];

  $('.venz ul li, .koleksikata ul li').each((_, el) => {
    const $el  = $(el);
    const title = $el.find('.thumb a').attr('title') || $el.find('h2').text().trim();
    const url   = $el.find('a').attr('href') || '';
    const img   = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const ep    = $el.find('.epz, .epztipe').text().trim();
    const slug  = url.replace(/\/+$/, '').split('/').pop();
    if (title && slug) results.push({ title, slug, img, episode: ep, url, status: 'ongoing' });
  });

  return setCache(key, results);
}

// GET /api/anime?action=completed
async function getCompleted(page = 1) {
  const key = `completed_${page}`;
  const cached = getCache(key);
  if (cached) return cached;

  const $ = await fetchHTML(`/complete-anime/page/${page}/`);
  const results = [];

  $('.venz ul li, .koleksikata ul li').each((_, el) => {
    const $el  = $(el);
    const title = $el.find('.thumb a').attr('title') || $el.find('h2').text().trim();
    const url   = $el.find('a').attr('href') || '';
    const img   = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const slug  = url.replace(/\/+$/, '').split('/').pop();
    if (title && slug) results.push({ title, slug, img, url, status: 'completed' });
  });

  return setCache(key, { results, page });
}

// ── MAIN HANDLER ──────────────────────────────
module.exports = async (req, res) => {
  // CORS headers — izinkan dari domain Zentra kamu
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { action, q, slug, url, page = 1 } = req.query;

  try {
    let data;
    switch (action) {
      case 'latest':    data = await getLatest(parseInt(page)); break;
      case 'search':    data = await searchAnime(q || ''); break;
      case 'detail':    data = await getDetail(slug); break;
      case 'episode':   data = await getEpisode(slug); break;
      case 'stream':    data = await resolveStream(url); break;
      case 'ongoing':   data = await getOngoing(); break;
      case 'completed': data = await getCompleted(parseInt(page)); break;
      default:
        res.status(400).json({ error: 'Action tidak valid. Gunakan: latest, search, detail, episode, stream, ongoing, completed' });
        return;
    }
    res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error(`[Zentra Proxy] ${action} error:`, e.message);
    // Coba fallback ke domain backup
    if (e.code === 'ECONNREFUSED' || e.response?.status === 403) {
      try {
        // Retry dengan base URL backup
        const origBase = BASE;
        res.status(503).json({ ok: false, error: 'Provider tidak tersedia saat ini.', message: e.message });
      } catch {}
    } else {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
};
