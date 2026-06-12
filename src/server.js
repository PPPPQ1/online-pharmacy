import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from './controllers/router.js';
import { fail, HttpError } from './utils/apiResponse.js';

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError('请求体不是合法 JSON');
  }
}

async function sendJson(res, payload, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = normalize(join(publicDir, requestPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/v1/')) {
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const result = await route(req, body, url);
      if (!result) return sendJson(res, fail('接口不存在', 404), 404);
      return sendJson(res, result, result.code === 200 ? 200 : result.code);
    }
    return serveStatic(req, res, url);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return sendJson(res, fail(error.message || '服务器内部错误', status), status);
  }
});

server.listen(port, () => {
  console.log(`Online pharmacy demo is running at http://localhost:${port}`);
});
