#!/usr/bin/env node
import { USAGE, parseCommand } from './args.ts'

const command = parseCommand(process.argv.slice(2))

switch (command.kind) {
  case 'help':
    process.stdout.write(USAGE)
    break
  case 'invalid':
    process.stderr.write(`${command.message}\n\n${USAGE}`)
    process.exitCode = 2
    break
  case 'run':
  case 'view':
    process.stderr.write(`wiki-agent ${command.kind} 尚未实现，见 docs/plan/v1.md。\n`)
    process.exitCode = 1
    break
}
