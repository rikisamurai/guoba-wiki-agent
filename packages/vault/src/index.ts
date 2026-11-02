export { type ApplyResult, applyProposal } from './apply.ts'
export { renderDiff } from './diff.ts'
export { hashText, listVaultFiles, readVaultText, toVaultKey } from './fs.ts'
export { type InvariantContext, addedNoteLinks, checkInvariants } from './invariants.ts'
export { type LinkIndex, createLinkIndex, isNoteTarget } from './links.ts'
export {
  type FrontmatterResult,
  type Wikilink,
  extractWikilinks,
  parseFrontmatter,
  splitFrontmatter,
} from './markdown.ts'
export { VaultPathError, resolveVaultPath } from './path.ts'
export { globToRegExp, matchScope, scopeViolation } from './scope.ts'
export { Staging, StagingError, WriteScopeError, type WriteResult } from './staging.ts'
export type { Change, Finding, WriteScopeRule } from './types.ts'
export { type IngestWarningContext, checkIngestWarnings, wikiDomains } from './warnings.ts'
