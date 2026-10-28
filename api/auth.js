// Vercel Function: /api/auth — step 1 of the blog editor (/admin) login.
// Same code as the Cloudflare version; Vercel passes its environment variables in.
import { onRequestGet } from '../functions/api/auth.js';

export function GET(request) {
  return onRequestGet({ request, env: process.env });
}
