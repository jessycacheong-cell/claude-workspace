#!/usr/bin/env node
/**
 * MilestoneBot — reads Notion milestone tracker, calculates real progress, updates data.json on GitHub
 *
 * Runs via GitHub Actions at 9AM daily.
 * Requires: NOTION_TOKEN, GITHUB_TOKEN (auto-provided by GitHub Actions)
 */

const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'jessycacheong-cell/claude-workspace';
const DATA_JSON_PATH = 'personal/data.json';
const PAGE_ID = '3279530a-745b-8197-81b8-ff3abc15058e';

if (!NOTION_TOKEN) { console.error('❌ NOTION_TOKEN not set'); process.exit(1); }
if (!GITHUB_TOKEN) { console.error('❌ GITHUB_TOKEN not set'); process.exit(1); }

// ── Notion helpers ──────────────────────────────────────────────────────────

function notionGet(apiPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path: apiPath,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getPageBlocks(pageId) {
  const blocks = [];
  let cursor = undefined;
  while (true) {
    const url = `/v1/blocks/${pageId}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`;
    const res = await notionGet(url);
    if (res.results) blocks.push(...res.results);
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return blocks;
}

function parseMilestoneBlocks(blocks) {
  const milestones = [
    { id: 1, name: 'Feedback & Fixes',          dates: 'Mar 17 → Mar 22, 2026', status: 'in-progress', progress: 0, checked: 0, total: 0 },
    { id: 2, name: 'Visual Polish (Figma)',      dates: 'Mar 23 → Apr 5, 2026',  status: 'not-started', progress: 0, checked: 0, total: 0 },
    { id: 3, name: 'Voice & Sound (ElevenLabs)', dates: 'Apr 6 → Apr 19, 2026',  status: 'not-started', progress: 0, checked: 0, total: 0 },
    { id: 4, name: 'Analytics',                  dates: 'Apr 20 → May 3, 2026',  status: 'not-started', progress: 0, checked: 0, total: 0 },
    { id: 5, name: 'Pilot & Roll Out',           dates: 'May 4 → May 17, 2026',  status: 'not-started', progress: 0, checked: 0, total: 0 }
  ];

  const keywords = ['feedback', 'visual polish', 'voice', 'analytics', 'pilot'];
  let currentMs = null;

  for (const block of blocks) {
    const type = block.type;
    if (type === 'heading_2' || type === 'heading_1') {
      const text = (block[type]?.rich_text || []).map(t => t.plain_text).join('').toLowerCase();
      const idx = keywords.findIndex(k => text.includes(k));
      currentMs = idx >= 0 ? milestones[idx] : null;
    }
    if (type === 'to_do' && currentMs) {
      currentMs.total++;
      if (block.to_do?.checked) currentMs.checked++;
    }
  }

  for (const ms of milestones) {
    if (ms.total > 0) {
      ms.progress = Math.round((ms.checked / ms.total) * 100);
      if (ms.progress === 100) ms.status = 'done';
      else if (ms.checked > 0 || ms.id === 1) ms.status = 'in-progress';
      else ms.status = 'not-started';
    }
    delete ms.checked;
    delete ms.total;
  }

  return milestones;
}

// ── GitHub helpers ──────────────────────────────────────────────────────────

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'User-Agent': 'MilestoneBot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(b ? { 'Content-Length': Buffer.byteLength(b) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    if (b) req.write(b);
    req.end();
  });
}

async function readDataJson() {
  const res = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${DATA_JSON_PATH}`);
  const content = Buffer.from(res.content, 'base64').toString('utf8');
  return { data: JSON.parse(content), sha: res.sha };
}

async function writeDataJson(data, sha) {
  await githubRequest('PUT', `/repos/${GITHUB_REPO}/contents/${DATA_JSON_PATH}`, {
    message: 'MilestoneBot: update milestone progress',
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    sha
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🎯  MilestoneBot starting...');

  const { data, sha } = await readDataJson();

  console.log('   Reading Notion milestone tracker...');
  const blocks = await getPageBlocks(PAGE_ID);
  console.log(`   Found ${blocks.length} blocks`);

  const milestones = parseMilestoneBlocks(blocks);
  milestones.forEach(ms => {
    const bar = '█'.repeat(Math.round(ms.progress / 10)) + '░'.repeat(10 - Math.round(ms.progress / 10));
    console.log(`   M${ms.id} [${bar}] ${ms.progress}% — ${ms.name} (${ms.status})`);
  });

  data.milestones = milestones;
  data.lastUpdated = new Date().toISOString();
  const botEntry = (data.automations || []).find(a => a.name === 'MilestoneBot');
  if (botEntry) botEntry.lastRun = new Date().toISOString();

  await writeDataJson(data, sha);
  console.log('\n✅  data.json updated on GitHub. Dashboard will refresh automatically.\n');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
