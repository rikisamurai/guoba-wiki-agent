import { splitPath } from '@/lib/format'
import { cn } from '@/lib/utils'

/** 路径：目录变淡，文件名加粗；变窄时只截断目录，文件名保持完整（极窄时整体裁切）。 */
export function PathText({ path, className }: { path: string; className?: string }) {
  const { dir, name } = splitPath(path)
  return (
    <span
      className={cn('flex min-w-0 overflow-hidden font-mono whitespace-nowrap', className)}
      title={path}
    >
      {dir && (
        <span className="text-faint min-w-[1.6em] shrink overflow-hidden text-ellipsis">{dir}</span>
      )}
      <span className="shrink-0 font-medium">{name}</span>
    </span>
  )
}
