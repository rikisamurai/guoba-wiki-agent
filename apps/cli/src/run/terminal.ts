import { createInterface } from 'node:readline/promises'

export interface Terminal {
  write(text: string): void
  /** 读一行输入；Ctrl-C 或输入结束（EOF）时返回 null。 */
  ask(question: string): Promise<string | null>
}

/** 每次提问临时创建 readline，执行期间终端保持普通模式，Ctrl-C 以 SIGINT 送达进程。 */
export function createTerminal(): Terminal {
  return {
    write(text) {
      process.stdout.write(text)
    },
    async ask(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const controller = new AbortController()
      rl.on('SIGINT', () => controller.abort())
      rl.on('close', () => controller.abort())
      try {
        return await rl.question(question, { signal: controller.signal })
      } catch {
        process.stdout.write('\n')
        return null
      } finally {
        rl.close()
      }
    },
  }
}
