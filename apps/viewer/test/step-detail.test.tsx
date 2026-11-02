import { allSteps, buildLedger, summarizeLedger } from '@guoba-wiki-agent/trajectory'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RunContext, type RunData } from '@/pages/run/context'
import { StepDetail } from '@/pages/run/step-detail'

import { PAGE, RUN_ID, THINKING, sampleRun } from './sample-run.ts'

afterEach(cleanup)

function runData(upTo?: number): RunData {
  const events = sampleRun(upTo)
  const ledger = buildLedger(events)
  return {
    runId: RUN_ID,
    events,
    ledger,
    summary: summarizeLedger(ledger, events),
    stream: 'live',
    open: ledger.end === undefined,
    t0: events[0]?.time ?? 0,
  }
}

function renderStep(index: number, upTo?: number) {
  const run = runData(upTo)
  const step = allSteps(run.ledger)[index]
  if (!step) throw new Error(`no step ${index}`)
  render(
    <RunContext.Provider value={run}>
      <StepDetail step={step} now={step.startedAt + 3000} />
    </RunContext.Provider>,
  )
}

describe('StepDetail', () => {
  it('collapses thinking to two lines by default and expands on demand', () => {
    renderStep(0)
    const thinking = screen.getByText(
      (_, element) => element?.textContent === THINKING && element.tagName === 'P',
    )
    expect(thinking.className).toContain('line-clamp-2')
    expect(screen.getByText(`${THINKING.length} 字`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '展开全部' }))

    expect(thinking.className).not.toContain('line-clamp-2')
    expect(screen.getByRole('button', { name: '收起' })).toBeTruthy()
  })

  it('expands a tool call into its arguments, result and Staging write', () => {
    renderStep(1)
    const row = screen.getByRole('button', { name: /write_file/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(row)

    expect(
      screen.getByText('---\ntitle: Obsidian Skills\n---\n', { normalizer: (s) => s }),
    ).toBeTruthy()
    expect(screen.getByText(`已暂存 ${PAGE}（2043 字节）`)).toBeTruthy()
    expect(screen.getByText(/写入前/).textContent).toContain('（新文件）')
  })

  it('shows the Finish verdict and its findings', () => {
    renderStep(2)
    expect(screen.getByText('Warning 1 条，已回传模型')).toBeTruthy()
    expect(screen.getByText('min-outlinks')).toBeTruthy()
  })

  it('shows a timer instead of content while the model is still generating', () => {
    renderStep(1, 10)
    expect(screen.getByText('模型正在生成')).toBeTruthy()
    expect(screen.getByText(/3\.00 s/)).toBeTruthy()
  })
})
