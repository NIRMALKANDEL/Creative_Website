// Cloudflare Pages Function: /api/callback
// Step 2 of the blog editor login. GitHub sends the editor back here; we swap the
// one-time code for a token and hand it to the editor window (Decap CMS protocol).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)cms_oauth_state=([^;]+)/)?.[1];

  let status = 'error';
  let content = { message: 'Login check failed. Close this window and try again.' };

  if (code && state && saved && state === saved) {
    try {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'whats-beyond-cms' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/api/callback`,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        status = 'success';
        content = { token: data.access_token, provider: 'github' };
      } else {
        content = { message: data.error_description || 'GitHub did not return a login token.' };
      }
    } catch (e) {
      content = { message: 'Could not reach GitHub. Please try again.' };
    }
  }

  const message = JSON.stringify(`authorization:github:${status}:${JSON.stringify(content)}`).replace(/</g, '\\u003c');
  const origin = JSON.stringify(url.origin);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="font-family:system-ui;padding:24px">${status === 'success' ? 'Signed in. You can close this window.' : 'Sign-in failed. You can close this window and try again.'}
<script>
(function () {
  var origin = ${origin};
  function receive(e) {
    if (e.origin !== origin) return;
    window.opener.postMessage(${message}, origin);
    window.removeEventListener('message', receive);
    setTimeout(function () { window.close(); }, 250);
  }
  window.addEventListener('message', receive, false);
  if (window.opener) window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'cms_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
