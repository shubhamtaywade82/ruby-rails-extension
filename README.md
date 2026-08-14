# RailsForge — Supercharged Ruby & Rails IDE

<p align="center">
  <img src="media/icon.png" alt="RailsForge Logo" width="160" height="160" />
</p>

<p align="center">
  <strong>The all-in-one developer platform for Ruby and Ruby on Rails in VS Code & Cursor.</strong>
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Ruby-2.7%20%7C%203.0%20%7C%203.1%20%7C%203.2%20%7C%203.3-CC342D?style=flat&logo=ruby&logoColor=white" alt="Ruby Versions"/></a>
  <a href="#features"><img src="https://img.shields.io/badge/Rails-5.2%20%7C%206.x%20%7C%207.x%20%7C%208.0-D30001?style=flat&logo=rubyonrails&logoColor=white" alt="Rails Versions"/></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"/></a>
</p>

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
- **SRP (Single Responsibility):** Flags Fat Models and Fat Controllers ($> 200$ LOC or $> 10$ actions) with 1-click QuickFix: *"Extract to Service Object"*.
- **Law of Demeter:** Detects deep association violations (`user.account.billing.address.city`) and suggests `delegate :method, to: :assoc`.
- **KISS (Keep It Simple):** Warns against unnecessary dynamic metaprogramming (`define_method`, `class_eval`) for static logic.
- **YAGNI (You Aren't Gonna Need It):** Flags unused private helper methods and dead abstractions.

### 📖 7. Version-Aware Documentation & Style Guide Engine
- **Contextual Hover Docs:** Hovering over core Rails DSLs (`has_many`, `belongs_to`, `turbo_stream`, `before_action`, `delegate`) renders concise explanations, code snippets, and direct links to official Rails Guides and the community Ruby Style Guide.

### 📊 8. RailsForge Architecture & Health Sidebar
- Dedicated Activity Bar Panel displaying:
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

### 🤖 11. Grounded Local AI Agent (`@rails`)
Powered by local Ollama (`qwen2.5-coder:14b` / `7b`):
- **Version Anti-Hallucination:** Automatically discovers active Ruby and Rails versions from `Gemfile.lock` and `.ruby-version`, constraining the AI to compatible APIs only.
- **Context Grounding:** Injects relevant database schema tables, column definitions, and route mappings into prompts.
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

### In VS Code:
```bash
code --install-extension railsforge.vsix
```

### In Cursor:
```bash
cursor --install-extension railsforge.vsix
```

*Or install manually via VS Code / Cursor Extensions View (`Ctrl+Shift+X`) $\to$ Click `...` $\to$ **Install from VSIX...** $\to$ select `railsforge.vsix`.*

---

## Requirements
- Ruby $\ge 2.7$ & Rails $\ge 5.2$
- Bundler (`Gemfile` / `Gemfile.lock`)
- *(Optional)* [Ollama](https://ollama.ai/) running locally on `http://localhost:11434` for `@rails` AI assistant features (`ollama run qwen2.5-coder:14b` or `qwen2.5-coder:7b`).

---

## License
MIT License © 2026 Shubham Taywade.
