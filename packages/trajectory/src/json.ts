/**
 * 找出第一个无法无损往返 JSON 的位置（ADR 0014 要求 data 是无损 JSON）。
 * `undefined` 属性、NaN / Infinity、函数、Date 等非普通对象都算失败；可选字段应当省略，而不是写 undefined。
 */
export function findNonJson(value: unknown, at = '$'): string | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? undefined : at
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const bad = findNonJson(item, `${at}[${index}]`)
      if (bad) return bad
    }
    return undefined
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      const bad = findNonJson(item, `${at}.${key}`)
      if (bad) return bad
    }
    return undefined
  }
  return at
}
