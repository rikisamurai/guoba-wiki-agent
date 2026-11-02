import { existsSync } from 'node:fs'
import path from 'node:path'

import { loadConfig } from '@guoba-wiki-agent/agent'

import { createViewServer } from './server.ts'

const VIEWER_DIR = path.resolve(import.meta.dirname, '../../../viewer/dist')

/** `wiki-agent view`：只监听 127.0.0.1（ADR 0015），Ctrl-C 退出。 */
export async function viewCommand(command: { port: number; config: string }): Promise<void> {
  if (!existsSync(command.config)) throw new Error(`找不到配置文件：${command.config}`)
  const { runsDir } = await loadConfig(command.config)
  const server = createViewServer({ runsDir, viewerDir: VIEWER_DIR })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(command.port, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : command.port
  process.stdout.write(
    `Trajectory 查看器：http://127.0.0.1:${port}\n  读取 ${runsDir}\n  Ctrl-C 退出\n`,
  )
}
