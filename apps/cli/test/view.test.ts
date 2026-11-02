import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { TrajectoryEventMap } from '@guoba-wiki-agent/trajectory'
import { createTrajectoryWriter } from '@guoba-wiki-agent/trajectory/node'
import { afterEach, describe, expect, it } from 'vitest'

import { createViewServer } from '../src/view/server.ts'

const RUN_START: TrajectoryEventMap['run/start'] = {
  runId: 'r',
  taskSkill: 'ingest',
  source: 'sources/a.md',
  vault: '/vault',
  model: { provider: 'deepseek', id: 'deepseek-flash' },
  thinkingLevel: 'high',
  pricing: null,
  config: {},
  versions: { wikiAgent: null, pi: '1.4.0' },
  vaultGit: null,
  skillHashes: {},
}

const OLD = '2026-11-01T08-00-00Z-aaaaaaaa'
const LIVE = '2026-11-02T08-00-00Z-bbbbbbbb'
const BROKEN = '2026-10-31T08-00-00Z-cccccccc'

let close: (() => void) | undefined
afterEach(() => close?.())

/** 一个已结束的 Run、一个进行中的 Run（返回其 writer）、一个损坏的 Run。 */
async function setup(viewerDir = path.join(tmpdir(), 'no-viewer')) {
  const runsDir = mkdtempSync(path.join(tmpdir(), 'runs-'))
  const old = createTrajectoryWriter(path.join(runsDir, OLD, 'trajectory.jsonl'))
  old.append('run/start', { ...RUN_START, runId: OLD })
  old.append('turn/start', { turn: 0 })
  old.append('turn/end', { turn: 0, reason: 'cancelled' })
  old.append('run/end', { reason: 'cancelled' })
  old.close()
  const live = createTrajectoryWriter(path.join(runsDir, LIVE, 'trajectory.jsonl'))
  live.append('run/start', { ...RUN_START, runId: LIVE })
  live.append('turn/start', { turn: 0 })
  mkdirSync(path.join(runsDir, BROKEN))
  writeFileSync(path.join(runsDir, BROKEN, 'trajectory.jsonl'), '{"type":"nope"}\n')

  const server = createViewServer({ runsDir, viewerDir, pollMs: 10 })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  close = () => {
    live.close()
    server.closeAllConnections()
    server.close()
  }
  const address = server.address()
  if (typeof address !== 'object' || !address) throw new Error('server is not listening')
  return { live, base: () => `http://127.0.0.1:${address.port}` }
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url)
  return { status: res.status, body: await res.json() }
}

function getWithHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request(url, { headers: { host } }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
      .on('error', reject)
      .end()
  })
}

describe('wiki-agent view API (ADR 0015)', () => {
  it('lists Runs newest first, summarized from their Trajectory', async () => {
    const { base } = await setup()

    const { status, body } = await getJson(`${base()}/api/runs`)

    expect(status).toBe(200)
    expect(body.runs.map((run: { id: string }) => run.id)).toEqual([LIVE, OLD, BROKEN])
    expect(body.runs[0].summary).toMatchObject({ runId: LIVE, reason: 'incomplete', turns: 1 })
    expect(body.runs[1].summary).toMatchObject({ runId: OLD, reason: 'cancelled' })
    expect(body.runs[2].error).toMatch(/unknown event type/)
  })

  it('pages through events by seq', async () => {
    const { base } = await setup()

    const first = await getJson(`${base()}/api/runs/${OLD}/events?from=1&limit=2`)
    const last = await getJson(`${base()}/api/runs/${OLD}/events?from=3`)

    expect(first.body.events.map((event: { seq: number }) => event.seq)).toEqual([1, 2])
    expect(first.body.next).toBe(3)
    expect(last.body).toMatchObject({ events: [{ type: 'run/end' }], next: null })
  })

  it('rejects unknown Runs, path tricks and bad parameters', async () => {
    const { base } = await setup()

    expect((await getJson(`${base()}/api/runs/nope/events`)).status).toBe(404)
    expect((await getJson(`${base()}/api/runs/%2E%2E/events`)).status).toBe(404)
    expect((await getJson(`${base()}/api/runs/${OLD}/events?from=-1`)).status).toBe(400)
    expect((await getJson(`${base()}/api/nope`)).status).toBe(404)
    expect((await fetch(`${base()}/api/runs`, { method: 'POST' })).status).toBe(405)
  })

  it('refuses requests whose Host is not local (DNS rebinding)', async () => {
    const { base } = await setup()

    expect(await getWithHost(`${base()}/api/runs`, 'evil.example:5050')).toBe(403)
    expect(await getWithHost(`${base()}/api/runs`, 'localhost:5050')).toBe(200)
  })

  it('streams existing and newly appended events over SSE until run/end', async () => {
    const { base, live } = await setup()

    const res = await fetch(`${base()}/api/runs/${LIVE}/stream?from=1`)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const chunks = res.body!.pipeThrough(new TextDecoderStream())[Symbol.asyncIterator]()
    let text = (await chunks.next()).value ?? ''
    expect(text).toContain('id: 1\n')
    expect(text).not.toContain('id: 0\n')

    live.append('user/message', { turn: 0, source: 'task', text: '多字节：执行 ingest' })
    live.append('run/end', { reason: 'cancelled' })
    for await (const chunk of { [Symbol.asyncIterator]: () => chunks }) text += chunk

    expect([...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]))).toEqual([1, 2, 3])
    expect(text).toContain('多字节：执行 ingest')
    expect(text.endsWith('event: end\ndata: {}\n\n')).toBe(true)
  })

  it('resumes after Last-Event-ID and ends immediately for a finished Run', async () => {
    const { base } = await setup()

    const res = await fetch(`${base()}/api/runs/${OLD}/stream?from=0`, {
      headers: { 'last-event-id': '1' },
    })
    const text = await res.text()

    expect([...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]))).toEqual([2, 3])
    expect(text).toContain('event: end')
  })
})

describe('wiki-agent view static files', () => {
  it('explains that the viewer is not built yet', async () => {
    const { base } = await setup()

    const res = await fetch(`${base()}/`)
    expect(await res.text()).toContain('查看器页面尚未构建')
  })

  it('serves the built viewer and nothing outside it', async () => {
    const viewerDir = mkdtempSync(path.join(tmpdir(), 'viewer-'))
    writeFileSync(path.join(viewerDir, 'index.html'), '<!doctype html><title>viewer</title>')
    writeFileSync(path.join(path.dirname(viewerDir), 'secret.txt'), 'secret')
    const { base } = await setup(viewerDir)

    const index = await fetch(`${base()}/`)
    expect(index.headers.get('content-type')).toMatch(/text\/html/)
    expect(await index.text()).toContain('<title>viewer</title>')
    expect((await fetch(`${base()}/..%2Fsecret.txt`)).status).toBe(404)
    expect((await fetch(`${base()}/missing.js`)).status).toBe(404)
  })
})
