# Cursor Rules & MDC Architecture

Structure, generate, and manage project-specific AI rules (`.cursor/rules/*.mdc` and `.cursorrules`) for Cursor, Claude Code, and Antigravity.

---

## 1. MDC File Format (`.cursor/rules/*.mdc`)

Cursor's modern rule format uses Markdown with YAML frontmatter to support file globbing and conditional context injection.

### Standard Format

```markdown
---
description: Standards and patterns for Rails controllers and API endpoints
globs: app/controllers/**/*.rb,app/serializers/**/*.rb
alwaysApply: false
---

# Rails Controller Guidelines

## Core Rules
- Controllers should remain thin (< 50 lines). Move business logic to Service Objects in `app/services/`.
- Use strong parameters explicitly in private methods.
- Return structured JSON responses with appropriate HTTP status codes.

## Standard Template
```ruby
class Api::V1::UsersController < ApplicationController
  def show
    user = User.find(params[:id])
    render json: UserSerializer.new(user).serializable_hash
  end
end
```
```

---

## 2. Frontmatter Properties

| Field | Type | Description |
| :--- | :--- | :--- |
| `description` | `string` | When the AI model should invoke this rule during semantic matching. |
| `globs` | `string` | Comma-separated glob patterns (e.g., `app/models/**/*.rb,spec/models/**/*`). The rule activates when files matching the glob are active/referenced. |
| `alwaysApply` | `boolean` | If `true`, the rule is included in every chat/composer session regardless of active files. |

---

## 3. Dynamic Rule Generation from Extension

You can programmatically generate `.cursor/rules/*.mdc` rules based on the user's workspace analysis (e.g. detected Rails gems, database schema, active linters):

```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectRuleSpec {
  name: string;
  description: string;
  globs: string;
  content: string;
}

export function writeCursorRule(workspaceRoot: string, rule: ProjectRuleSpec): void {
  const rulesDir = path.join(workspaceRoot, '.cursor', 'rules');
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  const mdcContent = `---
description: ${rule.description}
globs: ${rule.globs}
alwaysApply: false
---

${rule.content.trim()}
`;

  fs.writeFileSync(path.join(rulesDir, `${rule.name}.mdc`), mdcContent, 'utf8');
}
```

---

## 4. Multi-Agent Compatibility Matrix

| AI Tool | Configuration Path | Supported Formats |
| :--- | :--- | :--- |
| **Cursor** | `.cursor/rules/*.mdc` or `.cursorrules` | YAML frontmatter + Markdown |
| **Claude Code** | `CLAUDE.md` / `.claude/rules/*.md` | Markdown |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Markdown |
| **Antigravity / Cline** | `.agents/skills/*/SKILL.md` or `.roomodes` | YAML frontmatter + Markdown |
