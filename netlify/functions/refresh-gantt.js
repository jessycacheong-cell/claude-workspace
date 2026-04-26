// Triggers NotionGanttBot via GitHub repository_dispatch.
// Browser hits this endpoint -> we use a server-side PAT to call GitHub.
// PAT lives in Netlify env var GITHUB_PAT_DISPATCH (never exposed to browser).

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  const PAT = process.env.GITHUB_PAT_DISPATCH;
  if (!PAT) {
    return { statusCode: 500, headers, body: 'Server missing GITHUB_PAT_DISPATCH env var' };
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/jessycacheong-cell/claude-workspace/actions/workflows/notion-gantt-bot.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    if (res.status === 204) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    const text = await res.text();
    return { statusCode: res.status, headers, body: text };
  } catch (err) {
    return { statusCode: 500, headers, body: 'Error: ' + err.message };
  }
};
