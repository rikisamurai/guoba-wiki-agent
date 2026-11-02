import type { Run } from '@guoba-wiki-agent/agent'

import { createProgress } from './progress.ts'
import { EXIT_CANCELLED, reviewRun } from './review.ts'
import { startCliRun } from './start.ts'
import { createTerminal } from './terminal.ts'

/** `wiki-agent run`：开始 Run、显示进度、终端确认。Ctrl-C 中止，再按一次强制退出。 */
export async function runCommand(command: {
  source: string
  task: string
  config: string
}): Promise<number> {
  const term = createTerminal()
  const progress = createProgress((text) => term.write(text))
  const run = await startCliRun(command, (event) => progress.onEvent(event))
  const onInterrupt = interruptHandler(run, (text) => term.write(text))
  process.on('SIGINT', onInterrupt)
  try {
    return await reviewRun(run, term, progress.events)
  } finally {
    process.off('SIGINT', onInterrupt)
    term.write(`Trajectory：${run.dir}/trajectory.jsonl\n`)
  }
}

function interruptHandler(run: Run, write: (text: string) => void): () => void {
  let interrupted = false
  return () => {
    if (interrupted) process.exit(EXIT_CANCELLED)
    interrupted = true
    write('\n正在中止……（再按一次 Ctrl-C 强制退出）\n')
    run.cancel()
  }
}
