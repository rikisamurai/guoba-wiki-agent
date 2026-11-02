import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http'

import { listRuns, readEvents, trajectoryFile } from './runs.ts'
import { serveStatic } from './static.ts'
import { streamTrajectory } from './stream.ts'

export interface ViewServerOptions {
  runsDir: string
  /** 查看器构建产物目录（apps/viewer/dist）。 */
  viewerDir: string
  /** SSE 轮询文件的间隔，默认 200 毫秒。 */
  pollMs?: number
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const EVENTS_PAGE = 500

/**
 * `wiki-agent view` 的本地服务（ADR 0015）：只读 `.runs/`，调用方负责只监听 127.0.0.1。
 * 另外校验 Host 头，防止 DNS rebinding 让外部网页读到含 Vault 全文的 Trajectory。
 */
export function createViewServer(options: ViewServerOptions): Server {
  return createServer((req, res) => {
    try {
      route(req, res, options)
    } catch (error) {
      if (res.headersSent) res.end()
      else json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}

function route(req: IncomingMessage, res: ServerResponse, options: ViewServerOptions): void {
  if (!isLocalHost(req.headers.host)) {
    json(res, 403, { error: '只接受通过 127.0.0.1 或 localhost 访问' })
    return
  }
  if (req.method !== 'GET') {
    json(res, 405, { error: '只读服务，只支持 GET' })
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname === '/api/runs') {
    json(res, 200, { runs: listRuns(options.runsDir) })
    return
  }
  const match = /^\/api\/runs\/([^/]+)\/(events|stream)$/.exec(url.pathname)
  if (match) {
    const file = trajectoryFile(options.runsDir, match[1] ?? '')
    const from = startSeq(req, url)
    const limit = intParam(url, 'limit', EVENTS_PAGE)
    if (!file) json(res, 404, { error: `Run 不存在：${match[1]}` })
    else if (from === undefined || limit === undefined) json(res, 400, { error: '参数无效' })
    else if (match[2] === 'events') json(res, 200, readEvents(file, from, limit))
    else streamTrajectory(file, from, res, options.pollMs ?? 200)
    return
  }
  if (url.pathname.startsWith('/api/')) {
    json(res, 404, { error: `未知接口：${url.pathname}` })
    return
  }
  serveStatic(options.viewerDir, url.pathname, res)
}

/** EventSource 断线重连时带 Last-Event-ID，优先于 URL 中的 from。 */
function startSeq(req: IncomingMessage, url: URL): number | undefined {
  const lastId = req.headers['last-event-id']
  if (typeof lastId === 'string' && /^\d+$/.test(lastId)) return Number(lastId) + 1
  return intParam(url, 'from', 0)
}

function intParam(url: URL, name: string, fallback: number): number | undefined {
  const value = url.searchParams.get(name)
  if (value === null) return fallback
  return /^\d+$/.test(value) ? Number(value) : undefined
}

function isLocalHost(host: string | undefined): boolean {
  if (!host) return false
  try {
    return LOCAL_HOSTS.has(new URL(`http://${host}`).hostname)
  } catch {
    return false
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(`${JSON.stringify(body)}\n`)
}
