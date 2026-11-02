export type Command =
  | { kind: 'run'; source: string }
  | { kind: 'view' }
  | { kind: 'help' }
  | { kind: 'invalid'; message: string }

export const USAGE = `用法：
  wiki-agent run <source>   对一份 Source 执行 Ingest（尚未实现，见 docs/plan/v1.md M4）
  wiki-agent view           启动本地 Trajectory 查看器（尚未实现，见 docs/plan/v1.md M4）
`

export function parseCommand(argv: readonly string[]): Command {
  const [name, ...rest] = argv
  switch (name) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return { kind: 'help' }
    case 'run': {
      const source = rest[0]
      return source
        ? { kind: 'run', source }
        : { kind: 'invalid', message: 'run 需要一个 Source 路径' }
    }
    case 'view':
      return { kind: 'view' }
    default:
      return { kind: 'invalid', message: `未知命令：${name}` }
  }
}
