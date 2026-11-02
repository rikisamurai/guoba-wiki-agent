#!/usr/bin/env node
import { USAGE, parseCommand } from './args.ts'
import { runCommand } from './run/command.ts'
import { viewCommand } from './view/command.ts'

const command = parseCommand(process.argv.slice(2))

try {
  switch (command.kind) {
    case 'help':
      process.stdout.write(USAGE)
      break
    case 'invalid':
      process.stderr.write(`${command.message}\n\n${USAGE}`)
      process.exitCode = 2
      break
    case 'run':
      process.exitCode = await runCommand(command)
      break
    case 'view':
      await viewCommand(command)
      break
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
