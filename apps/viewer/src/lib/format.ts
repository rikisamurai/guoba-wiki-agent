/** 查看器里所有数字、时间的格式。数字列一律等宽对齐（见 index.css 的 tabular）。 */

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
}

/** 工具耗时等毫秒级的时长。 */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : formatSeconds(ms)
}

/** Run 内的相对时间，mm:ss.s。 */
export function formatClock(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const seconds = (ms % 60_000) / 1000
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 本地时间，MM-DD HH:mm:ss。 */
export function formatLocalTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatTokens(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`
}

export function formatUsd(usd: number, digits = 4): string {
  return `$${usd.toFixed(digits)}`
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** 把路径拆成目录与文件名，用于「目录变淡、文件名加粗」。 */
export function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/')
  return index === -1
    ? { dir: '', name: path }
    : { dir: path.slice(0, index + 1), name: path.slice(index + 1) }
}
