const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

const PORT = 3401;
const ROOT = __dirname;

// ── Shopify config ──────────────────────────────────────────────
const SHOP          = 'umei3d.myshopify.com';
const CLIENT_ID     = 'f934837523d771e03b37bc1fe3110b3d';
const CLIENT_SECRET = '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';
const SCOPES        = 'read_orders';
const REDIRECT_URI  = 'http://localhost:3401/shopify/callback';
const TOKEN_FILE    = path.join(__dirname, '.shopify-token');

// ── Google Sheets config ─────────────────────────────────────────
const SHEET_ID   = '1i8rkT2_mUVRpH4Dy_l-jpZNrQYMLUcv4fvi2FPa3o8c';
const SHEET_NAME      = 'Shopify Report';
const SHEET_NAME_META = 'meta ads report';
const COL_WEEK      = 19; // column T  — Shopify week label
const COL_ORDERS    = 30; // column AE — weekly orders
const COL_REVENUE   = 31; // column AF — weekly revenue
const COL_META_WEEK = 35; // column AJ — Meta week label
const COL_META_CONV = 37; // column AL — website purchases

const mime = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function getToken() {
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim(); }
  catch { return null; }
}

function fetchSheetData(sheetName) {
  return new Promise((resolve, reject) => {
    const sheetEnc = encodeURIComponent(sheetName);
    const url = `/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetEnc}`;
    const req = https.request({ hostname: 'docs.google.com', path: url }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          // Google wraps response in /*O_o*/google.visualization.Query.setResponse(...)
          const json = JSON.parse(d.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, ''));
          const rows = json.table.rows;
          // Find last Shopify week row (skip Grand Total / summary rows)
          let weekLabel = null, orders = null, revenue = null;
          for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const w = row.c && row.c[COL_WEEK] && row.c[COL_WEEK].v;
            const o = row.c && row.c[COL_ORDERS] && row.c[COL_ORDERS].v;
            if (w && o !== null && o !== undefined) {
              const label = String(w).toLowerCase();
              if (label.includes('grand') || label.includes('total') || label.includes('subtotal')) continue;
              weekLabel = String(w);
              orders = o;
              revenue = row.c[COL_REVENUE] ? row.c[COL_REVENUE].v : null;
              break;
            }
          }
          resolve({ week: weekLabel, orders, revenue, lastUpdated: new Date().toISOString(), _rows: rows });
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function shopifyRequest(token, apiPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SHOP,
      path: apiPath,
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function shopifyPost(path_, body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body);
    const req = https.request({
      hostname: SHOP, path: path_, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(b); req.end();
  });
}

async function getTodayOrders(token) {
  const start = new Date(); start.setHours(0,0,0,0);
  const data = await shopifyRequest(token,
    `/admin/api/2024-01/orders.json?status=any&created_at_min=${start.toISOString()}&fields=id,total_price,fulfillment_status`
  );
  const orders = data.orders || [];
  const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
  const pending = orders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'partial').length;
  return { orders: orders.length, revenue: '$' + revenue.toFixed(2), pending, lastUpdated: new Date().toISOString() };
}

http.createServer(async (req, res) => {
  const parsed   = urlModule.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── Google Sheets data ──
  if (pathname === '/api/sheets') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    try {
      const [shopify, meta] = await Promise.all([
        fetchSheetData(SHEET_NAME),
        fetchSheetData(SHEET_NAME_META)
      ]);
      // Find Meta week (col AJ=35) and purchases (col AL=37) from meta sheet rows
      let metaWeek = null, metaConv = null;
      const metaRows = meta._rows || [];
      for (let i = metaRows.length - 1; i >= 0; i--) {
        const row = metaRows[i];
        const w = row.c && row.c[COL_META_WEEK] && row.c[COL_META_WEEK].v;
        const c = row.c && row.c[COL_META_CONV] && row.c[COL_META_CONV].v;
        if (w && c !== null && c !== undefined) {
          const label = String(w).toLowerCase();
          if (label.includes('grand') || label.includes('total') || label.includes('subtotal')) continue;
          metaWeek = String(w); metaConv = c; break;
        }
      }
      res.writeHead(200); res.end(JSON.stringify({
        week: shopify.week, orders: shopify.orders, revenue: shopify.revenue,
        metaWeek, metaConv, lastUpdated: shopify.lastUpdated
      }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── Shopify OAuth: start ──
  if (pathname === '/shopify/auth') {
    const authUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.writeHead(302, { Location: authUrl }); res.end(); return;
  }

  // ── Shopify OAuth: callback ──
  if (pathname === '/shopify/callback') {
    const code = parsed.query.code;
    if (!code) { res.writeHead(400); res.end('Missing code'); return; }
    try {
      const result = await shopifyPost('/admin/oauth/access_token', { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code });
      if (result.access_token) {
        fs.writeFileSync(TOKEN_FILE, result.access_token);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="background:#04050a;color:#4ade80;font-family:sans-serif;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:20px;font-weight:700;">
          Shopify connected! Close this tab and refresh your dashboard.</body></html>`);
      } else {
        res.writeHead(500); res.end('Auth failed: ' + JSON.stringify(result));
      }
    } catch(e) { res.writeHead(500); res.end('Error: ' + e.message); }
    return;
  }

  // ── Shopify data API ──
  if (pathname === '/api/shopify') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const token = getToken();
    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'not_connected' })); return;
    }
    try {
      const data = await getTodayOrders(token);
      res.writeHead(200); res.end(JSON.stringify(data));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── Static files ──
  let fileUrl = pathname === '/' ? '/dashboard.html' : pathname;
  const filePath = path.join(ROOT, fileUrl.split('?')[0]);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); }
    else { res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' }); res.end(data); }
  });

}).listen(PORT, () => console.log('Serving on http://localhost:' + PORT));
