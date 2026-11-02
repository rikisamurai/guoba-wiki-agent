import { open } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'

const NEWLINE = 0x0a

/**
 * SSE（ADR 0015）：先发送 seq ≥ from 的已有事件，再轮询文件、发送新增的完整行；
 * 读到 run/end 后发送 `event: end` 并关闭。只按字节在换行处切分，不会切断多字节字符。
 */
export function streamTrajectory(
  file: string,
  from: number,
  res: ServerResponse,
  pollMs: number,
): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  let offset = 0
  let pending = Buffer.alloc(0)
  let reading = false
  let closed = false
  const stop = () => {
    closed = true
    clearInterval(timer)
  }
  const finish = (tail: string) => {
    res.end(tail)
    stop()
  }

  const send = (line: string): void => {
    const envelope = parseEnvelope(line)
    if (!envelope) {
      finish(`event: error\ndata: ${JSON.stringify({ message: '无法解析的 Trajectory 行' })}\n\n`)
      return
    }
    if (envelope.seq >= from) res.write(`id: ${envelope.seq}\ndata: ${line}\n\n`)
    if (envelope.type === 'run/end') finish('event: end\ndata: {}\n\n')
  }

  const poll = async (): Promise<void> => {
    if (reading || closed) return
    reading = true
    const handle = await open(file, 'r')
    try {
      const { size } = await handle.stat()
      if (size <= offset) return
      const chunk = Buffer.alloc(size - offset)
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset)
      offset += bytesRead
      pending = Buffer.concat([pending, chunk.subarray(0, bytesRead)])
      const end = pending.lastIndexOf(NEWLINE)
      if (end === -1) return
      const lines = pending.subarray(0, end).toString('utf8').split('\n')
      pending = pending.subarray(end + 1)
      for (const line of lines) {
        if (closed) break
        send(line)
      }
    } finally {
      reading = false
      await handle.close()
    }
  }

  const timer = setInterval(() => void poll(), pollMs)
  res.on('close', stop)
  void poll()
}

function parseEnvelope(line: string): { seq: number; type: string } | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const fields = new Map<string, unknown>(Object.entries(value))
  const seq = fields.get('seq')
  const type = fields.get('type')
  return typeof seq === 'number' && typeof type === 'string' ? { seq, type } : undefined
}
