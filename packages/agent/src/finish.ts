import type { Finding } from '@guoba-wiki-agent/vault'

export interface Validation {
  invariants: Finding[]
  warnings: Finding[]
}

export type Verdict =
  /** 通过：Invariant 为空，Warning 为空或已经提示过。 */
  | { kind: 'pass'; validation: Validation; attempt: number }
  /** 只有 Warning，本 Turn 第一次出现：提示模型，可修可不修（ADR 0007）。 */
  | { kind: 'warnings'; validation: Validation; attempt: number }
  /** Invariant 未通过，还有修正机会。 */
  | { kind: 'retry'; validation: Validation; attempt: number; failures: number }
  /** Invariant 第 maxFailures 次未通过：运行失败，不能 Apply。 */
  | { kind: 'failed'; validation: Validation; attempt: number; failures: number }

/**
 * Finish 校验的计数规则（ADR 0007）。`finish` 工具与“模型没调用 finish 就停止”共用同一个实例。
 * Invariant 失败次数在整个 Run 内累计（含 Revise，ADR 0013）；Warning 每个 Turn 提示一次。
 */
export class FinishGate {
  #failures = 0
  #attempts = 0
  #warningsShown = false
  readonly #validate: () => Validation
  readonly #maxFailures: number

  constructor(validate: () => Validation, maxFailures = 3) {
    this.#validate = validate
    this.#maxFailures = maxFailures
  }

  check(): Verdict {
    const validation = this.#validate()
    const attempt = ++this.#attempts
    if (validation.invariants.length > 0) {
      const failures = ++this.#failures
      const kind = failures >= this.#maxFailures ? 'failed' : 'retry'
      return { kind, validation, attempt, failures }
    }
    if (validation.warnings.length > 0 && !this.#warningsShown) {
      this.#warningsShown = true
      return { kind: 'warnings', validation, attempt }
    }
    return { kind: 'pass', validation, attempt }
  }

  newTurn(): void {
    this.#warningsShown = false
  }

  get maxFailures(): number {
    return this.#maxFailures
  }
}

const list = (findings: readonly Finding[]) =>
  findings
    .map(
      (finding) =>
        `- [${finding.rule}] ${finding.path ? `${finding.path}：` : ''}${finding.message}`,
    )
    .join('\n')

/** 回传给模型的文字。 */
export function verdictText(verdict: Verdict, maxFailures: number): string {
  const { invariants, warnings } = verdict.validation
  if (verdict.kind === 'pass') return '校验通过。改动已就绪，等待用户确认。'
  if (verdict.kind === 'warnings') {
    return `Invariant 全部通过，但有以下不符合 Skill 规范的地方：\n${list(warnings)}\n\n可以修正后再次调用 finish；确认不需要修改时，直接再次调用 finish。`
  }
  if (verdict.kind === 'retry') {
    return `校验未通过（第 ${verdict.failures}/${maxFailures} 次）：\n${list(invariants)}\n\n这些问题会阻止写入 Vault。请修正后再次调用 finish。`
  }
  return `校验第 ${verdict.failures} 次未通过，已达到上限，本次运行结束：\n${list(invariants)}`
}
