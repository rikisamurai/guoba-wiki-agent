import type { Run, TurnResult, TurnStatus } from '@guoba-wiki-agent/agent'
import type { AnyTrajectoryEvent } from '@guoba-wiki-agent/trajectory'

import { colorDiff, formatFinding } from './format.ts'
import { limitText } from './progress.ts'
import type { Terminal } from './terminal.ts'

export const EXIT_OK = 0
export const EXIT_FAILED = 1
export const EXIT_CANCELLED = 130

const QUESTION = '写入 Vault？ y 写入 / n 放弃 / r 提出修改意见 > '

type Decision = { choice: 'y' } | { choice: 'n' } | { choice: 'r'; feedback: string }

/**
 * 终端确认流程（ADR 0013）：执行 → 摘要与 diff → y / n / r。返回进程退出码。
 * `events` 是到目前为止的 Trajectory，diff 取自最近一次 proposal/diff。
 */
export async function reviewRun(
  run: Run,
  term: Terminal,
  events: readonly AnyTrajectoryEvent[],
): Promise<number> {
  return reviewTurn(run, term, events, await run.execute())
}

/** 处理一个 Turn 的结果；选择 r 时 Revise，再处理下一个 Turn。 */
async function reviewTurn(
  run: Run,
  term: Terminal,
  events: readonly AnyTrajectoryEvent[],
  result: TurnResult,
): Promise<number> {
  if (result.status !== 'ready') return reportStopped(result.status, result, term)
  term.write(renderProposal(result, events))
  const decision = await askDecision(term)
  if (decision === null) {
    run.cancel()
    term.write('已放弃，Vault 未改动。\n')
    return EXIT_CANCELLED
  }
  if (decision.choice === 'y') return reportApply(run.apply(), term)
  if (decision.choice === 'n') {
    run.discard()
    term.write('已放弃，Vault 未改动。\n')
    return EXIT_OK
  }
  return reviewTurn(run, term, events, await run.revise(decision.feedback))
}

export function renderProposal(result: TurnResult, events: readonly AnyTrajectoryEvent[]): string {
  const proposal = events.findLast((event) => event.type === 'proposal/diff')
  const files = proposal?.type === 'proposal/diff' ? proposal.data.files : []
  const created = files.filter((file) => file.created).length
  const warnings = result.validation?.warnings ?? []
  const counts = `新建 ${created} 个、修改 ${files.length - created} 个文件，Warning ${warnings.length} 条`
  return [
    '',
    `Proposal：${counts}`,
    ...files.map((file) => `  ${file.created ? '+' : '~'} ${file.path}`),
    ...(warnings.length > 0 ? ['', 'Warning：', ...warnings.map(formatFinding)] : []),
    '',
    ...files.map((file) => colorDiff(file.diff)),
    `Proposal：${counts}`,
    '',
  ].join('\n')
}

async function askDecision(term: Terminal): Promise<Decision | null> {
  const answer = await term.ask(QUESTION)
  if (answer === null) return null
  const choice = answer.trim().toLowerCase()
  if (choice === 'y' || choice === 'n') return { choice }
  if (choice !== 'r') {
    term.write('请输入 y、n 或 r。\n')
    return askDecision(term)
  }
  const feedback = await term.ask('修改意见（一行）> ')
  if (feedback === null) return null
  return feedback.trim() ? { choice: 'r', feedback: feedback.trim() } : askDecision(term)
}

const STOPPED: Record<Exclude<TurnStatus, 'ready'>, string> = {
  invariant_failed: 'Finish 校验未通过，修正次数已用完（ADR 0007）',
  limit: '触及运行上限（ADR 0012）',
  cancelled: '已中止',
  provider_error: '模型请求失败',
}

function reportStopped(
  status: Exclude<TurnStatus, 'ready'>,
  result: TurnResult,
  term: Terminal,
): number {
  const details = [
    ...(status === 'invariant_failed'
      ? (result.validation?.invariants ?? []).map(formatFinding)
      : []),
    ...(result.limit ? [`  ${limitText(result.limit)}`] : []),
    ...(result.error ? [`  ${result.error}`] : []),
  ]
  term.write([`\n${STOPPED[status]}，Run 结束。`, ...details, 'Vault 未改动。', ''].join('\n'))
  return status === 'cancelled' ? EXIT_CANCELLED : EXIT_FAILED
}

function reportApply(result: ReturnType<Run['apply']>, term: Terminal): number {
  if (result.status === 'applied') {
    term.write(
      `已写入 ${result.written.length} 个文件。没有做 git 提交，请在 Vault 中检查后自行提交。\n`,
    )
    return EXIT_OK
  }
  if (result.status === 'conflict') {
    term.write(
      [
        '没有写入：以下文件在 Run 期间被外部修改（ADR 0009）',
        ...result.conflicts.map((p) => `  - ${p}`),
        'Vault 未改动。',
        '',
      ].join('\n'),
    )
  } else if (result.status === 'invalid') {
    term.write(
      [
        '没有写入：基于当前 Vault 重新校验发现 Invariant',
        ...result.invariants.map(formatFinding),
        'Vault 未改动。',
        '',
      ].join('\n'),
    )
  } else {
    term.write(
      [
        `只写入了 ${result.written.length} 个文件，以下文件写入失败，请用 git 检查 Vault：`,
        ...result.failed.map((f) => `  - ${f.path}：${f.error}`),
        '',
      ].join('\n'),
    )
  }
  return EXIT_FAILED
}
