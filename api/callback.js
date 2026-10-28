// Vercel Function: /api/callback — step 2 of the blog editor (/admin) login.
import { onRequestGet } from '../functions/api/callback.js';

export function GET(request) {
  return onRequestGet({ request, env: process.env });
}
