import { createReadStream, existsSync, statSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import path from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const NOT_BUILT = `wiki-agent view：查看器页面尚未构建。在仓库根目录运行 pnpm build:viewer 后刷新。

数据接口：
  GET /api/runs
  GET /api/runs/<id>/events?from=<seq>&limit=<n>
  GET /api/runs/<id>/stream?from=<seq>   (SSE)
`

/** 提供查看器的构建产物（apps/viewer/dist）。查看器使用 hash 路由，只需要 index.html 与静态资源。 */
export function serveStatic(viewerDir: string, pathname: string, res: ServerResponse): void {
  if (!existsSync(path.join(viewerDir, 'index.html'))) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(NOT_BUILT)
    return
  }
  let relative: string
  try {
    relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
  } catch {
    res.writeHead(400).end()
    return
  }
  const file = path.resolve(viewerDir, relative)
  if (!file.startsWith(`${path.resolve(viewerDir)}${path.sep}`) || !isFile(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found\n')
    return
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(res)
}

function isFile(file: string): boolean {
  return existsSync(file) && statSync(file).isFile()
}
