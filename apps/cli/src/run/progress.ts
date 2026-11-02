import {
  type AnyTrajectoryEvent,
  type TrajectoryEventMap,
  summarizeRun,
} from '@guoba-wiki-agent/trajectory'

import { formatSeconds, formatUsd } from './format.ts'

const INDENT = '          '

/**
 * 把 Trajectory Event 翻译成终端进度。终端显示的内容全部来自 Trajectory，与查看器同源。
 */
export interface Progress {
  /** 本次 Run 到目前为止的全部 Trajectory Event。 */
  readonly events: readonly AnyTrajectoryEvent[]
  onEvent(event: AnyTrajectoryEvent): void
}

export function createProgress(write: (text: string) => void): Progress {
  const events: AnyTrajectoryEvent[] = []
  return {
    events,
    onEvent(event: AnyTrajectoryEvent): void {
      events.push(event)
      const line = event.type === 'turn/end' ? turnEndLine(events) : progressLine(event)
      if (line !== undefined) write(`${line}\n`)
    },
  }
}

export function progressLine(event: AnyTrajectoryEvent): string | undefined {
  switch (event.type) {
    case 'run/start': {
      const { runId, taskSkill, source, vault, model } = event.data
      return [
        `Run ${runId}`,
        `  Task Skill：${taskSkill}　Source：${source}`,
        `  Vault：${vault}　模型：${model.provider}/${model.id}`,
        '  Ctrl-C 中止（Vault 不变）；另开终端运行 wiki-agent view 可实时查看完整轨迹',
      ].join('\n')
    }
    case 'turn/start':
      return `\nTurn ${event.data.turn}`
    case 'tool/call':
      return `  Step ${String(event.data.step + 1).padEnd(3)} ${event.data.name}${argHint(event.data.arguments)}`
    case 'tool/result':
      if (event.data.isError) return `${INDENT}✗ ${firstLine(event.data.content)}`
      // finish 的结果说明校验是通过了，还是把 Warning 回传给了模型
      return event.data.name === 'finish'
        ? `${INDENT}→ ${firstLine(event.data.content)}`
        : undefined
    case 'validation/result': {
      const { attempt, invariants, warnings } = event.data
      return `${INDENT}第 ${attempt} 次 Finish 校验：Invariant ${invariants.length} 条，Warning ${warnings.length} 条`
    }
    case 'user/message':
      return event.data.source === 'validation' ? `${INDENT}→ 校验结果已回传给模型` : undefined
    case 'assistant/attempt':
      return `  Step ${event.data.step + 1}  ✗ 模型请求未完成：${event.data.error}`
    case 'limit/hit':
      return `  触及上限：${limitText(event.data)}`
    default:
      return undefined
  }
}

/** Turn 结束：本 Turn 的 Step 数与耗时，以及整个 Run 的累计费用。 */
function turnEndLine(events: readonly AnyTrajectoryEvent[]): string {
  const startIndex = events.findLastIndex((event) => event.type === 'turn/start')
  const turn = events.slice(startIndex)
  const steps = turn.filter((event) => event.type === 'step/start').length
  const duration = (turn.at(-1)?.time ?? 0) - (turn[0]?.time ?? 0)
  const summary = summarizeRun(events)
  const cost = `${formatUsd(summary.costUsd)}${summary.costComplete ? '' : '（部分回复缺少用量，不完整）'}`
  return `  本 Turn ${steps} Step，${formatSeconds(duration)}；累计费用 ${cost}`
}

export function limitText(hit: TrajectoryEventMap['limit/hit']): string {
  if (hit.limit === 'steps') return `Step 数 ${hit.value} / ${hit.max}`
  if (hit.limit === 'duration')
    return `时长 ${formatSeconds(hit.value)} / ${formatSeconds(hit.max)}`
  return `费用 ${formatUsd(hit.value)} / ${formatUsd(hit.max)}`
}

/** 工具参数里最能说明这次调用的一项：路径、模式或 Skill 名。 */
function argHint(json: string): string {
  let args: unknown
  try {
    args = JSON.parse(json)
  } catch {
    return ''
  }
  if (typeof args !== 'object' || args === null) return ''
  const fields = new Map<string, unknown>(Object.entries(args))
  for (const key of ['path', 'pattern', 'name']) {
    const value = fields.get(key)
    if (typeof value === 'string') return `  ${truncate(value, 80)}`
  }
  return ''
}

function firstLine(text: string): string {
  return truncate(text.split('\n')[0] ?? '', 120)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
