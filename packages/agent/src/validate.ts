import {
  type Staging,
  checkIngestWarnings,
  checkInvariants,
  createLinkIndex,
  listVaultFiles,
  wikiDomains,
} from '@guoba-wiki-agent/vault'

import type { ResolvedTask } from './config.ts'
import type { Validation } from './finish.ts'

/** 对 Staging 当前的全部变更运行 Invariant 与该任务的 Warning（ADR 0006）。 */
export function validateStaging(
  staging: Staging,
  task: ResolvedTask,
  vaultRoot: string,
): Validation {
  const changes = staging.changes()
  const links = createLinkIndex(staging.list())
  const invariants = checkInvariants(changes, { scope: task.writeScope, links })
  const warnings =
    task.warnings === 'ingest'
      ? checkIngestWarnings(changes, { links, domains: wikiDomains(listVaultFiles(vaultRoot)) })
      : []
  return { invariants, warnings }
}
