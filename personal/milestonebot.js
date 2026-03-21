#!/usr/bin/env node
/**
 * MilestoneBot — reads Notion milestone tracker, calculates real progress, updates data.json
 *
 * Usage:
 *   node milestonebot.js
 *
 * Requires: NOTION_TOKEN env var (your Notion integration token)
 *   set NOTION_TOKEN=secret_...
 *
 * Schedule via Windows Task Scheduler to run at 9AM daily.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = '3279530a-745b-8197-81b8-ff3abc15058e';
const DATA_JSON = path.join('C:', 'Users', 'J', 'Desktop', 'data.json');

if (!NOTION_TOKEN) {
  console.error('\n❌  NOTION_TOKEN not set.');
  console.error('    Run: set NOTION_TOKEN=secret_...');
  console.error('    Get it from: https://www.notion.so/my-integrations\n');
  process.exit(1);
}

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

function notionPost(apiPath, body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.notion.com',
      path: apiPath,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(b)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(b);
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
  // Find milestone sections by h2 headings, count checked/unchecked todos under each
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

    // Detect milestone heading
    if (type === 'heading_2' || type === 'heading_1') {
      const text = (block[type]?.rich_text || []).map(t => t.plain_text).join('').toLowerCase();
      const idx = keywords.findIndex(k => text.includes(k));
      currentMs = idx >= 0 ? milestones[idx] : null;
    }

    // Count to_do blocks under current milestone
    if (type === 'to_do' && currentMs) {
      currentMs.total++;
      if (block.to_do?.checked) currentMs.checked++;
    }
  }

  // Calculate progress and status
  for (const ms of milestones) {
    if (ms.total > 0) {
      ms.progress = Math.round((ms.checked / ms.total) * 100);
      if (ms.progress === 100) ms.status = 'done';
      else if (ms.checked > 0 || ms.id === 1) ms.status = 'in-progress';
      else ms.status = 'not-started';
    }
    // Clean up helper fields before saving
    delete ms.checked;
    delete ms.total;
  }

  return milestones;
}

async function run() {
  console.log('\n🎯  MilestoneBot starting...');

  // Load existing data.json
  let data = {};
  try { data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8')); }
  catch { console.log('   No existing data.json — creating fresh.'); }

  console.log('   Reading Notion milestone tracker...');
  const blocks = await getPageBlocks(PAGE_ID);
  console.log(`   Found ${blocks.length} blocks`);

  const milestones = parseMilestoneBlocks(blocks);

  // Log what we found
  milestones.forEach(ms => {
    const bar = '█'.repeat(Math.round(ms.progress / 10)) + '░'.repeat(10 - Math.round(ms.progress / 10));
    console.log(`   M${ms.id} [${bar}] ${ms.progress}% — ${ms.name} (${ms.status})`);
  });

  // Update data.json
  data.milestones = milestones;
  data.lastUpdated = new Date().toISOString();
  if (!data.automations) data.automations = [];
  const botEntry = data.automations.find(a => a.name === 'MilestoneBot');
  if (botEntry) botEntry.lastRun = new Date().toISOString();

  fs.writeFileSync(DATA_JSON, JSON.stringify(data, null, 2), 'utf8');
  console.log('\n✅  data.json updated with live milestone progress.');
  console.log('    Dashboard will refresh automatically.\n');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
