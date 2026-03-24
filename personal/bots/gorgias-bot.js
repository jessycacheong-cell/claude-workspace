// ── InboxBot: Gorgias ────────────────────────────────────────────────────────
// Fetches top 5 open Gorgias tickets and writes to personal/data.json
// Runs via GitHub Actions on schedule

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DOMAIN    = 'umeistore';
const API_KEY   = process.env.GORGIAS_API_KEY;
const EMAIL     = process.env.GORGIAS_EMAIL;

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fetchGorgias() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${EMAIL}:${API_KEY}`).toString('base64');
    const options = {
      hostname: `${DOMAIN}.gorgias.com`,
      path: '/api/tickets?limit=5&order_by=created_datetime:desc',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let raw = '';
      console.log(`📡 Gorgias API status: ${res.statusCode}`);
      res.on('data', c => raw += c);
      res.on('end', () => {
        console.log(`📦 Raw response (first 500 chars): ${raw.slice(0,500)}`);
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error(`Parse error: ${raw.slice(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const res     = await fetchGorgias();
    const tickets = (res.data || []).slice(0, 5).map(t => ({
      id:        t.id,
      subject:   t.subject || '(No subject)',
      customer:  t.requester?.email || 'Unknown',
      status:    t.status,
      timestamp: t.created_datetime
    }));

    const dataPath = path.join(__dirname, '../data.json');
    const data     = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    if (!data.inbox) data.inbox = {};
    data.inbox.gorgias        = tickets;
    data.inbox.gorgiasUpdated = new Date().toISOString();

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`✅ Gorgias: ${tickets.length} tickets written to data.json`);
    tickets.forEach(t => console.log(`   #${t.id} [${t.status}] ${t.subject} — ${t.time}`));
  } catch(e) {
    console.error('❌ Gorgias bot failed:', e.message);
    process.exit(1);
  }
}

main();
