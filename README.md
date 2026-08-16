# RailsForge — Supercharged Ruby & Rails IDE

![RailsForge Logo](media/icon.png)

**The all-in-one developer platform for Ruby and Ruby on Rails in VS Code & Cursor.**

[![Ruby Versions](https://img.shields.io/badge/Ruby-2.7%20%7C%203.0%20%7C%203.1%20%7C%203.2%20%7C%203.3-CC342D?style=flat&logo=ruby&logoColor=white)](#features)
[![Rails Versions](https://img.shields.io/badge/Rails-5.2%20%7C%206.x%20%7C%207.x%20%7C%208.0-D30001?style=flat&logo=rubyonrails&logoColor=white)](#features)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

---

## Why RailsForge?

Developers working with Ruby and Rails typically have to install 8 to 12 separate extensions (LSP, RuboCop, Brakeman, route finders, ERB helpers, test runners, and AI plugins) that do not share state.

**RailsForge** replaces this fragmented toolchain with a single, highly integrated extension. It features **deterministic runtime environment detection**, **Hotwire/Stimulus intelligence**, **native VS Code Test Explorer integration**, **zero-downtime migration diagnostics**, and a **grounded local AI agent (`@rails`)**.

---

## Core Features

### ⚡ 1. ActiveRecord Schema Peek & Association Explorer

- **Instant Schema Tooltips:** Hover over any ActiveRecord model (`User`, `Order`, `Account`) to view an instant Markdown table of database columns, types, nullability, defaults, and foreign keys directly from `db/schema.rb`.
- **Zero Configuration:** Automatically watches `db/schema.rb` and re-indexes on migration runs.

### 🚀 2. Fast MVC & Resource Navigation

Quickly jump across related Rails companion files using ergonomic keybindings:

| Action | Keybinding (Linux/Win) | Keybinding (macOS) | Target File |
| :--- | :--- | :--- | :--- |
| **Go to Model** | `Alt+R M` | `Cmd+Alt+R M` | `app/models/[resource].rb` |
| **Go to Controller** | `Alt+R C` | `Cmd+Alt+R C` | `app/controllers/[resource]_controller.rb` |
| **Go to View** | `Alt+R V` | `Cmd+Alt+R V` | `app/views/[resource]/` |
| **Go to Spec / Test** | `Alt+R S` | `Cmd+Alt+R S` | `spec/models/[resource]_spec.rb` |
| **Go to Policy** | `Alt+R P` | `Cmd+Alt+R P` | `app/policies/[resource]_policy.rb` |
| **Search Routes** | `Alt+R R` | `Cmd+Alt+R R` | Interactive Route Search |

### 🛣️ 3. Real-Time Route Resolver & Path Helpers

- **URL Helper Autocompletion:** Autocomplete named route helpers like `users_path`, `edit_order_url`, and `api_v1_products_path`.
- **Interactive Route Search:** Press `Alt+R R` to search all defined routes, HTTP verbs, URL patterns, and controller#action mappings.

### ⚡ 4. Native Hotwire, Stimulus & Turbo Orchestration

- **Stimulus Autocompletion:** Dynamically indexes `app/javascript/controllers/` to autocomplete `data-controller`, `data-action` (`click->controller#action`), and `data-*-target` inside `.html.erb`, `.haml`, and `.slim`.
- **Turbo Frame Navigation:** Jump directly to definition and find references for `<%= turbo_frame_tag "cart" %>` and `<turbo-frame id="cart">` across view templates.

### 🧪 5. Next-Gen Testing & FactoryBot Intelligence

- **Test Explorer Integration:** Automatically populates the VS Code Test sidebar with discovered RSpec (`spec/`) and Minitest (`test/`) hierarchies.
- **FactoryBot Jump to Definition:** `Ctrl+Click` / `Cmd+Click` on `create(:user)`, `build(:order)`, or `build_stubbed(:account)` jumps directly to its declaration in `spec/factories/*.rb`.
- **Inline CodeLens:** Directly above any `describe`, `context`, `it`, or `test` block:
  - `▶ Run Test` — Executes the specific test line in an isolated terminal.
  - `🐞 Debug (rdbg)` — Launches the Ruby 3.1+ native debugger (`rdbg`) session.

### 🏛️ 6. Design Principles Engine (SOLID, DRY, KISS, YAGNI & Demeter)

- **SRP (Single Responsibility):** Flags Fat Models and Fat Controllers ($> 200$ LOC or $> 10$ actions) with 1-click QuickFix: *"Extract to Service Object"* — a single `WorkspaceEdit` that creates the new service file and replaces only the selected code, leaving the rest of the file untouched.
- **Law of Demeter:** Detects deep association violations (`user.account.billing.address.city`) with a real Quick Fix that inserts `delegate :method, to: :assoc` for you.
- **KISS (Keep It Simple):** Warns against unnecessary dynamic metaprogramming (`define_method`, `class_eval`) for static logic.
- **YAGNI (You Aren't Gonna Need It):** Flags unused private helper methods with a Quick Fix that deletes the whole unused method.
- **Hard-Coded Collaborators:** `MinimalDependencyGraph` flags `PaymentGatewayService.call(...)`-style references to other indexed services/queries/policies and offers *"Inject `X` via constructor"* — adds a keyword constructor param and rewrites call sites in that file to use it.
- **✨ AI Suggest Fix:** Every principle diagnostic also offers an AI-generated fix (via the local `@rails` agent) alongside the deterministic one, plus `RailsForge: Fix All Deterministic Principle Violations in File` to batch-apply the non-AI fixes.

### 📖 7. Version-Aware Documentation & Style Guide Engine

- **Contextual Hover Docs:** Hovering over core Rails DSLs (`has_many`, `belongs_to`, `turbo_stream`, `before_action`, `delegate`) renders concise explanations, code snippets, and direct links to official Rails Guides and the community Ruby Style Guide.

### 📊 8. RailsForge Architecture & Health Sidebar

Dedicated Activity Bar Panel displaying:

- **Runtime Environment:** Active Ruby, Rails, Hotwire, Testing framework, and migration safety status.
- **Database & Models:** Indexed table counts and column breakdowns.
- **Routes & Hotwire:** Route counts and registered Stimulus controller mappings.

### 🛡️ 9. DevSecOps & Zero-Downtime Migration Safety

- **RuboCop Real-Time Engine:** Live diagnostics, 1-click line disables (`# rubocop:disable ...`), and safe (`-a`) or unsafe (`-A`) autocorrect on save.
- **Brakeman Security Audits:** 1-click vulnerability scanning for SQL injection, mass assignment, XSS, and unpermitted parameters.
- **Bundler-Audit Dependency Scanner:** Audits `Gemfile.lock` for known CVEs.
- **Strong Migrations Analyzer:** Live linter for `db/migrate/*.rb` warning against table-locking operations with 1-click QuickFixes (`algorithm: :concurrently`).

### 🧱 10. Architecture & Refactoring Tools

- **Extract to Service Object:** Select business logic in controllers or models and extract it into a clean `app/services/[name]_service.rb` implementing the `ApplicationService.call` pattern.
- **Extract to Query Object:** Move complex ActiveRecord query chains into `app/queries/[name]_query.rb`.

### 🧩 12. Living Pattern Catalog ("How We Do X Here")

Unlike the static Refactoring Guru catalog (§10), this indexes **your own project's**
`app/services`, `app/queries`, `app/forms`, `app/policies`, `app/decorators`, and
concerns as you work:

- **CodeLens on every Service/Query/Form/Policy class:** `📋 N similar patterns in this project`.
- **`RailsForge: Show Similar Patterns in This Project`** — quick-pick of the closest
  existing implementations (ranked by name and public-method overlap), so you check for
  prior art before writing a new `CreateXService` from scratch.
- **Live re-indexing** on file save/create/delete — no separate build step.
- Feeds directly into the `@rails` agent's grounding (below), so generated code is
  steered toward your existing patterns instead of reinventing them.

### 🔗 13. Cross-File "Related Files" CodeLens & Hover

Stops the "open 5-6 files to understand this class" loop:

- **On a model** (`app/models/*.rb`): CodeLens above the class shows
  `🔗 3 Services · 2 Queries · 1 Policy · 6 Specs` — every indexed pattern that
  references the model by name or by `Model.find`/`.create`/`.where`-style usage,
  plus its RSpec/Minitest spec count.
- **On a service/query/policy/decorator**: CodeLens shows `🔗 Called by 7 · Depends on 3 · 2 Specs`,
  sourced from the same collaborator graph the "Inject via constructor" Quick Fix uses (§6).
- **Hover** the `class` definition line for the same information inline, without a click.
- **`RailsForge: Show Related Files`** opens a quick-pick of everything found — services,
  queries, policies, callers, collaborators, and specs — each jumping straight to the
  right line.

### 💎 14. Standalone Ruby Scripts & Gem Support

RailsForge activates on any Ruby file, Gemfile, or `.rb` script — not only full Rails
apps — and adjusts what it claims accordingly:

- **`hasRails` detection:** `EnvironmentDetector` only reports a Rails version when
  `rails` is an actual `Gemfile.lock` dependency. A standalone gem or script gets
  `hasRails: false` instead of a fabricated Rails version, and the Architecture sidebar
  shows *"Not a Rails app"* rather than a misleading `Rails ` line.
- **`@rails` agent grounding adapts:** for a non-Rails project, the system prompt drops
  the "strictly uses Rails X" constraint and Rails-specific advice (Service Objects,
  N+1 prevention) in favor of plain-Ruby/SOLID guidance grounded only in gems that are
  actually declared as dependencies — it won't assume ActiveRecord/ActionController exist.
- **Pattern catalog works in `lib/`, not just `app/`:** `ProjectPatternIndexer` matches
  `services/`, `queries/`, `forms/`, `policies/`, `decorators/`, and `concerns/`
  directories anywhere in the path, so a gem's `lib/my_gem/services/*.rb` is indexed the
  same way `app/services/*.rb` is — CodeLens, "show similar patterns", and the dependency
  graph all work unmodified.
- **SRP still flags fat classes in `lib/`**, just with generic "split this up" guidance
  instead of the Rails-specific "extract to `app/services`" quick fix, since a gem has no
  `app/` convention to extract into.
- **Still Rails-only:** schema/route indexing, MVC navigation, migration safety, and
  Hotwire/Stimulus tooling need `db/schema.rb`/`config/routes.rb`/`app/` structure that a
  plain gem or script doesn't have, and simply do nothing rather than error.

### 🤖 11. Grounded Local AI Agent (`@rails`)

Powered by local Ollama (`qwen2.5-coder:14b` / `7b`):

- **Version Anti-Hallucination:** Automatically discovers active Ruby and Rails versions from `Gemfile.lock` and `.ruby-version`, constraining the AI to compatible APIs only.
- **Context Grounding:** Injects relevant database schema tables, column definitions, route mappings, and a summary of existing Service/Query/Form/Policy patterns into prompts, with an explicit instruction to reuse or extend a close match before generating new code.
- **Slash Commands in Chat:**
  - `@rails /explain` — Explain complex queries, scopes, and associations.
  - `@rails /service` — Scaffold clean Service Objects with Result monads.
  - `@rails /scaffold` — Generate convention-compliant models, controllers, and migrations.
  - `@rails /spec` — Generate complete RSpec request and unit specs using FactoryBot.
  - `@rails /optimize` — Detect N+1 query risks and missing eager loads (`.includes`).
  - `@rails /migrate` — Generate safe, reversible ActiveRecord migrations.

---

## Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

| Command | Identifier |
| :--- | :--- |
| **RailsForge: Scan Workspace for Patterns, Smells & Safety** | `railsforge.scanWorkspaceArchitecture` |
| **RailsForge: Refactor Selection (Design Patterns)** | `railsforge.refactorSelection` |
| **RailsForge: Go to Matching Model** | `railsforge.goToModel` |
| **RailsForge: Go to Matching Controller** | `railsforge.goToController` |
| **RailsForge: Go to Matching View** | `railsforge.goToView` |
| **RailsForge: Go to Spec / Test** | `railsforge.goToSpec` |
| **RailsForge: Go to Pundit / CanCanCan Policy** | `railsforge.goToPolicy` |
| **RailsForge: Go to ViewComponent** | `railsforge.goToComponent` |
| **RailsForge: Search Rails Routes** | `railsforge.searchRoutes` |
| **RailsForge: RuboCop Autocorrect File** | `railsforge.rubocopAutocorrect` |
| **RailsForge: Run Brakeman Security Scan** | `railsforge.runBrakeman` |
| **RailsForge: Run Gemfile Security Audit (bundle-audit)** | `railsforge.runBundleAudit` |
| **RailsForge: Check Migration Safety (Strong Migrations)** | `railsforge.analyzeMigration` |
| **RailsForge: Extract Selection to Service Object** | `railsforge.extractService` |
| **RailsForge: Extract Selection to Query Object** | `railsforge.extractQuery` |

---

## Configuration Settings

Configure RailsForge in `settings.json`:

```json
{
  "railsForge.rubocop.autocorrectOnSave": true,
  "railsForge.rubocop.mode": "safe",
  "railsForge.brakeman.scanOnSave": false,
  "railsForge.testing.framework": "rspec",
  "railsForge.schema.autoIndex": true,
  "railsForge.routes.autoIndex": true,
  "railsForge.ollama.host": "http://localhost:11434",
  "railsForge.ollama.model": "qwen2.5-coder:14b"
}
```

---

## Installation

### In VS Code

```bash
code --install-extension railsforge.vsix
```

### In Cursor

```bash
cursor --install-extension railsforge.vsix
```

*Or install manually via VS Code / Cursor Extensions View (`Ctrl+Shift+X`) $\to$ Click `...` $\to$ **Install from VSIX...** $\to$ select `railsforge.vsix`.*

---

## Relationship to Ruby LSP

RailsForge is a **companion to Shopify's `ruby-lsp`**, not a replacement for it.
Install both:

```json
// .vscode/extensions.json
{ "recommendations": ["shopify.ruby-lsp", "nemesis.railsforge"] }
```

`ruby-lsp` (plus `ruby-lsp-rails`) remains the source of truth for Ruby syntax,
diagnostics, and go-to-definition. RailsForge adds Rails-specific intelligence
(schema peek, route search, pattern catalog, principle diagnostics, security
scans, the local AI agent) on top. For deeper integration, RailsForge also
ships an optional [`ruby-lsp` add-on gem](./ruby-lsp-addon) that injects schema
context directly into `ruby-lsp`'s own Hover responses — see
[`ruby-lsp-addon/README.md`](./ruby-lsp-addon/README.md) for setup and the
current scope (schema-aware hover today; route-aware completion and
association-aware navigation are natural next steps on the same scaffold).

## Roadmap

The pattern catalog, principle diagnostics, and `ruby-lsp` add-on above are the
first slice of a larger "architectural guardrail" direction: project-wide
semantic search, a dependency/collaborator graph for services, guided
"Extract Service/Query with caller updates" refactors, and an MCP server so
any AI client (not just the built-in `@rails` agent) can query RailsForge's
index. These are tracked in [`PRD.md`](./PRD.md) and are a deliberately
bigger lift (native indexing, AST parsing) than the current regex/heuristic
approach — happy to scope any one of them as a follow-up.

---

## Requirements

- Ruby $\ge 2.7$ & Rails $\ge 5.2$
- Bundler (`Gemfile` / `Gemfile.lock`)
- *(Optional)* [Ollama](https://ollama.ai/) running locally on `http://localhost:11434` for `@rails` AI assistant features (`ollama run qwen2.5-coder:14b` or `qwen2.5-coder:7b`).

---

## License

MIT License © 2026 Shubham Taywade.
