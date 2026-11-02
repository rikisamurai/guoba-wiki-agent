import { readFileSync } from 'node:fs'

import { type ParsedTrajectory, parseTrajectory } from '../parse.ts'

export { createTrajectoryWriter, type TrajectoryWriter } from './writer.ts'

export function readTrajectoryFile(file: string): ParsedTrajectory {
  return parseTrajectory(readFileSync(file, 'utf8'))
}
