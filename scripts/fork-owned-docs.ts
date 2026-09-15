/**
 * English-only project documentation owned by mahmoudemad68/Cyber_harness.
 * DeepSeek pairing, wrap, link, and mermaid gates skip these paths.
 * See docs/ci/fork-ci.md.
 */

/**
 * Whether `relativePath` is this fork's planning or CI documentation rather than a DeepSeek bilingual page.
 * @param relativePath - repository-relative Markdown path; `\\` is normalized to `/`
 * @returns true when pairing, wrap, link, and mermaid gates must skip the file
 */
export function isForkOwnedDocumentation(relativePath: string): boolean {
  const path = relativePath.replaceAll('\\', '/')
  return path === 'docs/upstream-sync.md'
    || path.startsWith('docs/plans/')
    || path.startsWith('docs/notes/')
    || path.startsWith('docs/ci/')
}
