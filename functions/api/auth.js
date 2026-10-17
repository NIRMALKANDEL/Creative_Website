// Cloudflare Pages Function: /api/auth
// Step 1 of the blog editor login. Sends the editor to GitHub to sign in.
// Needs two environment variables in Cloudflare Pages → Settings → Variables:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  (from a GitHub OAuth App)
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('Blog editor login is not set up yet: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Pages settings.', { status: 500 });
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const github = new URL('https://github.com/login/oauth/authorize');
  github.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  github.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
  github.searchParams.set('scope', url.searchParams.get('scope') || 'repo');
  github.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      'Set-Cookie': `cms_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
