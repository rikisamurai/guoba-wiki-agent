import type { ReactNode } from 'react'

/** 每个页面顶部的应用栏：名称、可选的状态（例如实时连接）、服务地址。 */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="border-line bg-surface flex h-[38px] shrink-0 items-center gap-3 border-b px-4">
      <span className="font-mono text-[13px] font-medium">wiki-agent</span>
      <span className="text-muted">Trajectory 查看器</span>
      <span className="flex-1" />
      {children}
      <span className="text-faint font-mono text-xs">{location.host}</span>
    </div>
  )
}

export function LiveIndicator() {
  return (
    <span className="text-accent inline-flex items-center gap-1.5 text-xs">
      <span className="bg-accent size-[7px] rounded-full motion-safe:animate-pulse" />
      实时 · 已连接
    </span>
  )
}
