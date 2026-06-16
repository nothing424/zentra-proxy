# Zentra Proxy — Deploy ke Vercel

## Isi Folder
```
zentra-proxy/
├── api/
│   └── anime.js      ← Serverless function (scraper)
├── js/
│   └── stream.js     ← Copy ke zentra/js/stream.js
├── package.json
├── vercel.json
└── README.md
```

---

## Cara Deploy (5 menit)

### 1. Install Vercel CLI (kalau belum)
```bash
npm install -g vercel
```

### 2. Deploy
```bash
cd zentra-proxy
vercel
```
Ikuti instruksi:
- Set up and deploy? → Y
- Which scope? → pilih akun kamu
- Link to existing project? → N
- Project name → zentra-proxy
- Directory → ./
- Override settings? → N

### 3. Selesai
Vercel akan kasih URL seperti:
```
https://zentra-proxy.vercel.app
```

---

## Cara Connect ke Zentra App

### Step 1 — Copy file stream.js
Salin `js/stream.js` ke folder `zentra/js/stream.js`

### Step 2 — Edit PROXY_URL
Buka `zentra/js/stream.js`, ganti baris pertama:
```js
const PROXY_URL = 'https://GANTI-PROXY-URL.vercel.app';
```
Jadi URL Vercel kamu:
```js
const PROXY_URL = 'https://zentra-proxy.vercel.app';
```

### Step 3 — Tambah script di index.html
Di `zentra/index.html`, sebelum `</body>`:
```html
<script src="js/stream.js"></script>
```

### Step 4 — Edit loadStreamEmbed di app.js
Cari fungsi `loadStreamEmbed` di `zentra/js/app.js`, ganti isinya jadi:
```js
async function loadStreamEmbed(animeId, ep, anime) {
  await loadStreamFromProxy(animeId, ep, anime);
}
```

---

## Endpoint API

| Endpoint | Parameter | Fungsi |
|----------|-----------|--------|
| `/api/anime?action=latest` | `page` | Anime terbaru |
| `/api/anime?action=search` | `q` | Cari anime |
| `/api/anime?action=detail` | `slug` | Detail anime |
| `/api/anime?action=episode` | `slug` | Data episode + stream |
| `/api/anime?action=stream` | `url` | Resolve video URL |
| `/api/anime?action=ongoing` | — | Anime ongoing |
| `/api/anime?action=completed` | `page` | Anime completed |

---

## Contoh Response

### Search
```
GET /api/anime?action=search&q=naruto
{
  "ok": true,
  "data": {
    "results": [
      { "title": "Naruto", "slug": "naruto-sub-indo", "img": "...", "url": "..." }
    ]
  }
}
```

### Episode
```
GET /api/anime?action=episode&slug=naruto-episode-1-sub-indo
{
  "ok": true,
  "data": {
    "title": "Naruto Episode 1",
    "iframes": ["https://..."],
    "mirrors": [...],
    "downloads": { "720p": [...] }
  }
}
```

---

## Catatan
- Cache 10 menit per request
- Provider: OtakuDesu (utama)
- Kalau OtakuDesu down, fallback ke link eksternal
- Free tier Vercel cukup untuk pemakaian normal
