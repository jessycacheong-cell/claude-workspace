// Outlook OAuth Helper — run ONCE locally to get a refresh token
// Usage:
//   1. Set env vars: MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET
//   2. Run: node outlook-oauth-helper.js
//   3. Browser opens → sign in with jessyca.cheong@cubework.com → grant
//   4. Copy the refresh token printed in the terminal → add as MS_REFRESH_TOKEN secret on GitHub

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { URL, URLSearchParams } = require('url');

const CLIENT_ID = process.env.MS_CLIENT_ID;
const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'offline_access Mail.Read User.Read';

if (!CLIENT_ID || !TENANT_ID || !CLIENT_SECRET) {
  console.error('Missing env vars. Set MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET first.');
  console.error('Example (PowerShell): $env:MS_CLIENT_ID="..."; $env:MS_TENANT_ID="..."; $env:MS_CLIENT_SECRET="..."; node outlook-oauth-helper.js');
  process.exit(1);
}

const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` + new URLSearchParams({
  client_id: CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  response_mode: 'query',
  scope: SCOPES,
  prompt: 'consent'
}).toString();

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPES,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  }).toString();
  return request({
    hostname: 'login.microsoftonline.com',
    path: `/${TENANT_ID}/oauth2/v2.0/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  if (url.pathname !== '/callback') {
    res.writeHead(404); res.end('Not found'); return;
  }
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (error) {
    res.writeHead(400, {'Content-Type':'text/html'}); res.end(`<h2>Error</h2><pre>${error}</pre>`);
    console.error('Auth error:', error); server.close(); process.exit(1);
  }
  if (!code) { res.writeHead(400); res.end('No code'); return; }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      res.writeHead(500, {'Content-Type':'text/html'}); res.end(`<h2>No refresh token</h2><pre>${JSON.stringify(tokens, null, 2)}</pre>`);
      console.error('Token response:', tokens); server.close(); process.exit(1);
    }
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(`<h2 style="font-family:sans-serif">Success! Check your terminal for the refresh token, then close this tab.</h2>`);
    console.log('\n' + '='.repeat(70));
    console.log('REFRESH TOKEN (add to GitHub Secrets as MS_REFRESH_TOKEN):');
    console.log('='.repeat(70));
    console.log(tokens.refresh_token);
    console.log('='.repeat(70) + '\n');
    setTimeout(() => { server.close(); process.exit(0); }, 500);
  } catch (e) {
    res.writeHead(500, {'Content-Type':'text/html'}); res.end(`<h2>Exchange failed</h2><pre>${e.message}</pre>`);
    console.error(e); server.close(); process.exit(1);
  }
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
  console.log('Opening browser to consent...\n');
  const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
  exec(cmd, err => { if (err) console.log('Open this URL manually:\n' + authUrl); });
});
