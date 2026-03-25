#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pixel Agent Server
// Watches Claude Code JSONL sessions → streams live agent states via SSE
// No npm install needed — pure Node.js built-ins only
//
// HOW TO START:
//   "C:\Program Files\Adobe\Adobe Photoshop 2026\node.exe" pixel-agent-server.js
//
// Then open your dashboard — pixel agents come alive automatically!
// Press Ctrl+C to stop.
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT       = 3402;
const HOME       = process.env.USERPROFILE || process.env.HOME || 'C:/Users/J';
const CLAUDE_DIR = path.join(HOME, '.claude', 'projects');

const clients = new Set();
let agentMap  = {};

// ── Read last N lines of a JSONL file ────────────────────────────────────────
function tail(filePath, n = 60) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').slice(-n);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// ── Detect what the agent is doing from its transcript ───────────────────────
function detectState(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (!e || !e.type) continue;

    if (e.type === 'user') {
      // Check if it's a human turn (waiting) or initial prompt (starting)
      return { state: 'waiting', detail: 'Waiting for you' };
    }

    if (e.type === 'assistant') {
      const content = (e.message && e.message.content) || [];
      for (let j = content.length - 1; j >= 0; j--) {
        const c = content[j];
        if (c.type === 'tool_use') {
          const name = (c.name || '').toLowerCase();
          const inputFile = c.input && (c.input.file_path || c.input.path || '');
          const shortFile = inputFile ? path.basename(inputFile) : '';

          if (name === 'write' || name === 'edit')
            return { state: 'typing', detail: shortFile ? `Writing ${shortFile}` : 'Writing file' };
          if (name === 'read' || name === 'glob' || name === 'grep')
            return { state: 'reading', detail: shortFile ? `Reading ${shortFile}` : 'Reading files' };
          if (name === 'bash')
            return { state: 'running', detail: 'Running command' };
          if (name.includes('web') || name.includes('search') || name.includes('fetch'))
            return { state: 'searching', detail: 'Searching web' };
          if (name === 'agent')
            return { state: 'delegating', detail: 'Spawning agent' };
          if (name.includes('notion') || name.includes('gmail') || name.includes('gcal'))
            return { state: 'working', detail: c.name };
          return { state: 'working', detail: c.name || 'Working' };
        }
        if (c.type === 'text') return { state: 'thinking', detail: 'Thinking...' };
      }
    }

    if (e.type === 'tool_result') return { state: 'processing', detail: 'Processing result' };
  }
  return { state: 'idle', detail: 'Idle' };
}

// ── Scan all active Claude Code sessions ─────────────────────────────────────
function scan() {
  const now    = Date.now();
  const fresh  = {};
  let   agentN = 0;

  if (!fs.existsSync(CLAUDE_DIR)) {
    agentMap = {};
    broadcast();
    return;
  }

  try {
    const projects = fs.readdirSync(CLAUDE_DIR).sort().reverse(); // newest first

    for (const proj of projects) {
      if (agentN >= 4) break;
      const projDir = path.join(CLAUDE_DIR, proj);
      try { if (!fs.statSync(projDir).isDirectory()) continue; } catch { continue; }

      let files = [];
      try { files = fs.readdirSync(projDir).filter(f => f.endsWith('.jsonl')); } catch { continue; }

      for (const file of files) {
        if (agentN >= 4) break;
        const fp = path.join(projDir, file);
        try {
          const fstat  = fs.statSync(fp);
          const ageMin = (now - fstat.mtimeMs) / 60000;
          if (ageMin > 20) continue; // ignore sessions inactive > 20 min

          const entries       = tail(fp, 60);
          const { state, detail } = ageMin > 4 ? { state: 'idle', detail: 'Idle' } : detectState(entries);
          const id            = file.replace('.jsonl', '').substring(0, 20);
          const rawName       = proj
            .replace(/^C--Users-[^-]+-Desktop-?/, '')
            .replace(/^C--Users-[^-]+-/, '')
            .replace(/-/g, ' ')
            .trim()
            .substring(0, 20) || 'Claude Session';

          fresh[id] = {
            id,
            name    : rawName,
            state,
            detail,
            ageMin  : Math.round(ageMin * 10) / 10,
            modified: fstat.mtime.toISOString(),
          };
          agentN++;
        } catch {}
      }
    }
  } catch (err) {
    console.error('Scan error:', err.message);
  }

  agentMap = fresh;
  broadcast();
}

// ── Broadcast to all SSE clients ─────────────────────────────────────────────
function broadcast() {
  const payload = `data: ${JSON.stringify({ agents: Object.values(agentMap), ts: Date.now() })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // SSE stream
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type' : 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection'   : 'keep-alive',
    });
    clients.add(res);
    // Send current state immediately
    res.write(`data: ${JSON.stringify({ agents: Object.values(agentMap), ts: Date.now() })}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }

  // JSON snapshot
  if (req.url === '/agents') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents: Object.values(agentMap), ts: Date.now() }, null, 2));
    return;
  }

  // Status page
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end([
    '🎮 Pixel Agent Server',
    `Port    : ${PORT}`,
    `Agents  : ${Object.keys(agentMap).length}`,
    `Watching: ${CLAUDE_DIR}`,
    '',
    'Endpoints:',
    `  GET http://localhost:${PORT}/agents  → JSON snapshot`,
    `  GET http://localhost:${PORT}/events  → SSE stream`,
    '',
    Object.values(agentMap).map(a => `  ${a.state.padEnd(12)} ${a.name} (${a.ageMin}min ago)`).join('\n') || '  No active sessions found.',
  ].join('\n'));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  🎮 Pixel Agent Server running!');
  console.log(`  ┌─────────────────────────────────────────┐`);
  console.log(`  │  Port    : ${PORT}                           │`);
  console.log(`  │  Events  : http://localhost:${PORT}/events  │`);
  console.log(`  │  Watching: .claude/projects/            │`);
  console.log(`  └─────────────────────────────────────────┘`);
  console.log('');
  console.log('  Open your dashboard — pixel agents will come alive!');
  console.log('  Press Ctrl+C to stop.\n');
});

setInterval(scan, 2000);
scan();
