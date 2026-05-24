import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin that adds a `/__proxy` endpoint to the dev server.
 * The client POSTs `{ url, headers }` and the server fetches the target URL
 * on the server side, returning the response — bypassing browser CORS.
 *
 * Security hardening:
 *  - Only https:// and http:// schemes allowed (no file://, ftp://, etc.)
 *  - Blocks requests to private/internal IP ranges and cloud metadata endpoints
 *  - Request body limited to 4 KB (just a URL + headers)
 *  - Only proxies JSON-like responses (JSON, text/plain, octet-stream)
 *  - Error messages are generic (no internal stack traces)
 *  - Upstream fetch has a bounded timeout supplied by the client
 */
function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // ── Limit request body size (4 KB) to prevent abuse ──
        const MAX_BODY = 4096;
        const chunks: Buffer[] = [];
        let totalSize = 0;
        for await (const chunk of req) {
          totalSize += (chunk as Buffer).length;
          if (totalSize > MAX_BODY) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body too large' }));
            return;
          }
          chunks.push(chunk as Buffer);
        }

        let body: { url?: string; headers?: Record<string, string>; timeoutMs?: number };
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        const { url, headers = {}, timeoutMs } = body;
        if (!url || typeof url !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid "url" in request body' }));
          return;
        }

        // ── Validate URL scheme — only http(s) allowed ──
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid URL' }));
          return;
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Only http and https URLs are allowed' }));
          return;
        }

        // ── Block private/internal network targets (SSRF protection) ──
        const blockedHosts = [
          /^localhost$/i,
          /^127\.\d+\.\d+\.\d+$/,
          /^10\.\d+\.\d+\.\d+$/,
          /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
          /^192\.168\.\d+\.\d+$/,
          /^169\.254\.\d+\.\d+$/,     // AWS metadata
          /^0\.0\.0\.0$/,
          /^\[::1?\]$/,               // IPv6 loopback
          /^metadata\.google\.internal$/i,
        ];

        if (blockedHosts.some((re) => re.test(parsed.hostname))) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Requests to private/internal addresses are blocked' }));
          return;
        }

        // ── Only forward safe header keys ──
        const safeHeaders: Record<string, string> = {};
        const allowedHeaderKeys = ['authorization', 'accept', 'accept-language'];
        for (const [k, v] of Object.entries(headers)) {
          if (allowedHeaderKeys.includes(k.toLowerCase()) && typeof v === 'string') {
            safeHeaders[k] = v;
          }
        }

        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const controller = new AbortController();
          const upstreamTimeout = Math.max(1_000, Math.min(Number(timeoutMs) || 20_000, 30_000));
          timeout = setTimeout(() => controller.abort(), upstreamTimeout);

          const upstream = await fetch(url, {
            headers: safeHeaders,
            signal: controller.signal,
          });

          const contentType = upstream.headers.get('content-type') || '';

          // ── Only proxy JSON-like responses to limit attack surface.
          // Some registries and raw file hosts serve JSON as text/plain or
          // application/octet-stream, so allow the same types the client-side
          // OSCAL resolvers accept and let JSON.parse validate the payload.
          const isJsonLike =
            contentType.includes('json') ||
            contentType.includes('text/plain') ||
            contentType.includes('octet-stream');

          if (!isJsonLike) {
            clearTimeout(timeout);
            timeout = undefined;
            res.writeHead(415, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Upstream responded with unsupported content type: ${contentType}. Only JSON-like responses are accepted.`,
            }));
            return;
          }

          const data = await upstream.arrayBuffer();
          clearTimeout(timeout);
          timeout = undefined;

          res.writeHead(upstream.status, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(Buffer.from(data));
        } catch {
          if (timeout) clearTimeout(timeout);
          // Generic error — don't leak internal details
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to fetch upstream resource' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
