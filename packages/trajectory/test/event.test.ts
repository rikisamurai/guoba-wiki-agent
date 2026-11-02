import { describe, expect, it } from 'vitest'

import { findSeqGap } from '../src/index.ts'

describe('findSeqGap', () => {
  it('accepts a contiguous log starting at 0', () => {
    expect(findSeqGap([{ seq: 0 }, { seq: 1 }, { seq: 2 }])).toBeUndefined()
  })

  it('reports the first gap', () => {
    expect(findSeqGap([{ seq: 0 }, { seq: 2 }])).toEqual({ index: 1, expected: 1, actual: 2 })
  })

  it('rejects a log that does not start at 0', () => {
    expect(findSeqGap([{ seq: 1 }])).toEqual({ index: 0, expected: 0, actual: 1 })
  })
})
