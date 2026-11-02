import { createTwoFilesPatch } from 'diff'

import type { Change } from './types.ts'

/** 一个文件的 unified diff。新建文件的旧路径记为 /dev/null。 */
export function renderDiff(change: Change, context = 3): string {
  const oldName = change.base === null ? '/dev/null' : `a/${change.path}`
  return createTwoFilesPatch(
    oldName,
    `b/${change.path}`,
    change.base ?? '',
    change.next,
    undefined,
    undefined,
    {
      context,
    },
  )
}
