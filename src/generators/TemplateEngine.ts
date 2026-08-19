/**
 * TemplateEngine - Lets a team override RailsForge's generated code with their own
 * template, read from `.railsforge/templates/{name}.erb` in the workspace. Despite the
 * `.erb` extension (matching the file name a team would actually recognize/expect),
 * substitution is plain `{{variable}}` replacement, not real ERB evaluation — no Ruby
 * runtime is available inside the extension host to execute real ERB, and `{{var}}` is
 * exactly the variable syntax asked for, so there's no real ERB semantics being promised
 * here that this doesn't deliver.
 *
 * No `vscode` import; pure fs + string substitution.
 */

import * as fs from 'fs'
import * as path from 'path'

export const TEMPLATES_DIR = '.railsforge/templates'

/** Reads `.railsforge/templates/{templateName}.erb` if present, else null (never throws — a missing/unreadable custom template just means "use the built-in default"). */
export function findCustomTemplate(workspaceRoot: string, templateName: string): string | null {
  const templatePath = path.join(workspaceRoot, TEMPLATES_DIR, `${templateName}.erb`)
  if (!fs.existsSync(templatePath)) {return null}
  try {
    return fs.readFileSync(templatePath, 'utf8')
  } catch {
    return null
  }
}

/** Replaces every `{{key}}` with `variables[key]`; a `{{key}}` with no matching variable is left as-is rather than silently dropped, so a typo in a custom template is visible in the generated output instead of vanishing. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  )
}
