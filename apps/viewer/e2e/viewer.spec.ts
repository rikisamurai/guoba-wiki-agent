import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { AnyTrajectoryEvent } from '@guoba-wiki-agent/trajectory'
import { expect, test } from '@playwright/test'

import { PAGE, RUN_ID, sampleRun, toJsonl } from '../test/sample-run.ts'

function runFile(id: string): string {
  const dir = path.join(process.env['E2E_RUNS_DIR'] ?? '', id)
  mkdirSync(dir, { recursive: true })
  return path.join(dir, 'trajectory.jsonl')
}

function writeRun(id: string, events: AnyTrajectoryEvent[]): string {
  const file = runFile(id)
  writeFileSync(file, toJsonl(events))
  return file
}

test('opens a Run from the list', async ({ page }) => {
  writeRun(RUN_ID, sampleRun())
  await page.goto('/')

  await page.getByRole('row').filter({ hasText: '已写入' }).first().click()

  await expect(page).toHaveURL(new RegExp(`#/runs/${RUN_ID}`))
  await expect(page.getByText('Turn 0', { exact: true })).toBeVisible()
  await expect(page.getByText('Turn 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /确认|提案/ }).first()).toBeVisible()
})

test('selects a Step and expands a tool call', async ({ page }) => {
  writeRun(RUN_ID, sampleRun())
  await page.goto(`/#/runs/${RUN_ID}`)

  await page.getByRole('link', { name: /Step 2.*write_file/ }).click()
  await expect(page).toHaveURL(/sel=s0-1/)
  await page.getByRole('button', { name: /write_file/ }).click()

  await expect(page.getByText(`已暂存 ${PAGE}（2043 字节）`)).toBeVisible()
})

test('appends events of a running Run without reloading', async ({ page }) => {
  const id = '2026-11-02T10-00-00Z-live0001'
  const events = sampleRun()
  const file = writeRun(id, events.slice(0, 10))
  await page.goto(`/#/runs/${id}`)

  await expect(page.getByText('实时 · 已连接')).toBeVisible()
  await expect(page.getByText('生成中，生成结束后显示思考与工具调用')).toBeVisible()

  appendFileSync(file, toJsonl(events.slice(10, 30)))
  await expect(page.getByRole('link', { name: /Step 2.*write_file/ })).toBeVisible()
  await expect(page.getByText('生成中，生成结束后显示思考与工具调用')).toBeHidden()

  appendFileSync(file, toJsonl(events.slice(30)))
  await expect(page.getByText('已写入 2 个文件')).toBeVisible()
  await expect(page.getByText('实时 · 已连接')).toBeHidden()
})
