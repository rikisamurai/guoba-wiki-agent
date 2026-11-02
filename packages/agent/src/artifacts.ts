import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildLedger, summarizeLedger } from '@guoba-wiki-agent/trajectory'
import { readTrajectoryFile } from '@guoba-wiki-agent/trajectory/node'

/**
 * 由 Trajectory 派生 `result.json` 与 `proposal.diff`（ADR 0014）。随时可以重新生成。
 */
export function writeRunArtifacts(runDir: string): void {
  const { events } = readTrajectoryFile(path.join(runDir, 'trajectory.jsonl'))
  const ledger = buildLedger(events)
  writeFileSync(
    path.join(runDir, 'result.json'),
    `${JSON.stringify(summarizeLedger(ledger, events), null, 2)}\n`,
  )
  const proposal = ledger.turns.findLast((turn) => turn.proposal)?.proposal ?? []
  writeFileSync(path.join(runDir, 'proposal.diff'), proposal.map((file) => file.diff).join(''))
}

/** 当前安装的 Pi 版本，写入 run/start（ADR 0014）。 */
export function piVersion(): string {
  const file = fileURLToPath(
    new URL('../node_modules/@earendil-works/pi-agent-core/package.json', import.meta.url),
  )
  if (!existsSync(file)) return 'unknown'
  const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'))
  return typeof pkg === 'object' &&
    pkg !== null &&
    'version' in pkg &&
    typeof pkg.version === 'string'
    ? pkg.version
    : 'unknown'
}
