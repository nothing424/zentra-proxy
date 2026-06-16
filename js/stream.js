// =============================================
// ZENTRA — Stream Service
// Tambahkan file ini ke zentra/js/stream.js
// Lalu panggil dari app.js
// =============================================

// Ganti ini dengan URL Vercel proxy kamu setelah deploy
// Contoh: https://zentra-proxy.vercel.app
const PROXY_URL = 'https://GANTI-PROXY-URL.vercel.app';

// ── API CALLS ─────────────────────────────────

async function proxyGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${PROXY_URL}/api/anime?${qs}`);
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Unknown error');
  return json.data;
}

// Cari anime berdasarkan judul
async function streamSearch(title) {
  return proxyGet('search', { q: title });
}

// Get episode list dari slug OtakuDesu
async function streamDetail(slug) {
  return proxyGet('detail', { slug });
}

// Get stream URL dari slug episode
async function streamEpisode(slug) {
  return proxyGet('episode', { slug });
}

// Resolve actual video URL
async function streamResolve(url) {
  return proxyGet('stream', { url });
}

// ── LOAD STREAM KE PLAYER ─────────────────────

async function loadStreamFromProxy(animeId, ep, anime) {
  const iframe   = document.getElementById('stream-iframe');
  const statusEl = document.getElementById('stream-status');
  const loading  = document.getElementById('stream-loading');

  const title = anime?.title_english || anime?.title || '';

  // Update status UI
  if (statusEl) statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div class="spinner" style="width:14px;height:14px;border-width:2px"></div>
      <span style="font-weight:600">Mencari "${title}"...</span>
    </div>`;

  try {
    // Step 1: Cari anime di OtakuDesu
    const searchResult = await streamSearch(title);
    if (!searchResult?.results?.length) throw new Error('Anime tidak ditemukan di provider.');

    const found = searchResult.results[0];
    if (statusEl) statusEl.innerHTML = `<div style="font-size:0.8rem;color:var(--muted)">Ditemukan: ${found.title}</div>`;

    // Step 2: Ambil detail + episode list
    const detail = await streamDetail(found.slug);
    if (!detail?.epList?.length) throw new Error('Daftar episode tidak tersedia.');

    // Step 3: Cari episode yang diminta
    const epData = detail.epList.find(e => e.episode === ep) || detail.epList[ep - 1];
    if (!epData) throw new Error(`Episode ${ep} tidak ditemukan.`);

    // Step 4: Ambil stream URL
    const epDetail = await streamEpisode(epData.slug);

    // Step 5: Gunakan iframe atau resolve langsung
    if (epDetail.iframes?.length) {
      // Ada iframe embed langsung
      if (loading) loading.style.display = 'none';
      iframe.src = epDetail.iframes[0];
      updateStreamStatus(statusEl, title, ep, found.slug, epDetail);
      return;
    }

    if (epDetail.mirrors?.length) {
      // Ada mirror link, coba resolve yang pertama
      if (epDetail.mirrors[0].dataId) {
        const resolved = await streamResolve(epDetail.mirrors[0].dataId);
        if (resolved?.sources?.length) {
          loadDirectVideo(resolved.sources[0].src, resolved.sources[0].type);
          if (loading) loading.style.display = 'none';
          updateStreamStatus(statusEl, title, ep, found.slug, epDetail);
          return;
        }
      }
    }

    // Fallback: tampilkan link langsung
    throw new Error('Stream tidak bisa di-embed, gunakan link eksternal.');

  } catch (e) {
    console.warn('[Stream]', e.message);
    if (loading) loading.style.display = 'none';
    showStreamLinks(statusEl, title, ep);
  }
}

function loadDirectVideo(src, type) {
  // Ganti iframe dengan video element
  const wrap = document.getElementById('stream-iframe')?.parentElement;
  if (!wrap) return;

  const existing = document.getElementById('stream-iframe');
  if (existing) existing.remove();

  const video = document.createElement('video');
  video.id = 'stream-video';
  video.controls = true;
  video.autoplay = true;
  video.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;background:#000';

  if (type === 'hls' && Hls?.isSupported()) {
    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);
  } else {
    video.src = src;
  }

  wrap.appendChild(video);
}

function updateStreamStatus(statusEl, title, ep, slug, epDetail) {
  if (!statusEl) return;
  const otakuUrl = `https://otakudesu.cloud/episode/${epDetail.slug || slug}/`;
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--success);flex-shrink:0"></div>
      <span style="color:var(--success);font-weight:600">Stream aktif</span>
    </div>
    <div style="font-size:0.78rem;color:var(--muted);margin-bottom:10px">${title} · Ep ${ep}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${epDetail.prevSlug ? `<button class="glass-btn" style="font-size:0.75rem;padding:6px 12px" onclick="navigate('watch',{id:${animeId},ep:${ep-1}})">← Ep ${ep-1}</button>` : ''}
      ${epDetail.nextSlug ? `<button class="btn-primary" style="font-size:0.75rem;padding:6px 12px" onclick="navigate('watch',{id:${animeId},ep:${ep+1}})">Ep ${ep+1} →</button>` : ''}
      <a href="${otakuUrl}" target="_blank" class="glass-btn" style="font-size:0.75rem;padding:6px 12px">Buka OtakuDesu</a>
    </div>`;
}

function showStreamLinks(statusEl, title, ep) {
  if (!statusEl) return;
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--warning)"></div>
      <span style="color:var(--warning);font-weight:600">Tonton via situs eksternal</span>
    </div>
    <div style="font-size:0.78rem;color:var(--muted);margin-bottom:12px">Browser memblokir embed langsung. Pilih situs di bawah:</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <a href="https://otakudesu.cloud/?s=${encodeURIComponent(title)}" target="_blank"
         style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(79,140,255,0.1);border:1px solid rgba(79,140,255,0.2);border-radius:10px;font-size:0.85rem;font-weight:600;color:var(--primary)">
        <span>OtakuDesu · Ep ${ep}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
      <a href="https://aniwatch.to/search?keyword=${encodeURIComponent(title)}" target="_blank"
         style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(124,92,255,0.1);border:1px solid rgba(124,92,255,0.2);border-radius:10px;font-size:0.85rem;font-weight:600;color:var(--secondary)">
        <span>AniWatch · Ep ${ep}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
      <a href="https://samehadaku.email/?s=${encodeURIComponent(title)}" target="_blank"
         style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:10px;font-size:0.85rem;font-weight:600;color:var(--success)">
        <span>Samehadaku · Ep ${ep}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>`;
}
