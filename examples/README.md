# RailsForge Test Workspaces

This directory contains standalone, minimal reference projects representing all project types supported by RailsForge.

## Workspaces Overview

| Workspace | Project Type | Key Features Exercised |
| :--- | :--- | :--- |
| [`rails-monolith/`](./rails-monolith) | `monolith` | Full MVC navigation (`Alt+R M/C/V/S`), DevDocs/APIDock hover, Schema Peek, Route Search, Rake Tasks, Pundit, ViewComponent, Strong Migrations |
| [`rails-api/`](./rails-api) | `api_only` | Adaptive UI (views hidden), OpenAPI Skeleton Generator (`railsforge.generateApiDocs`), route search, schema peek |
| [`ruby-gem/`](./ruby-gem) | `gem` | Gem Version Bumper (`railsforge.bumpGemVersion`), Bundler gem release tasks, RBS generation |
| [`ruby-script/`](./ruby-script) | `script` | REPL evaluation (`Alt+R E`), RuboCop autocorrect, AST analysis |

## How to Test in VS Code / Cursor

1. Open one of the subdirectories directly in VS Code or Cursor:
   ```bash
   code examples/rails-monolith
   # or
   cursor examples/rails-api
   ```
2. In the debug host or with the RailsForge extension installed, open the **RailsForge** activity bar view to inspect detected project type and features.

---

For the full step-by-step verification checklist, see [**CHECKLIST.md**](./CHECKLIST.md).



