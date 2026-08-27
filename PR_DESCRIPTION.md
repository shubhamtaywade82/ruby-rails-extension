## Problem

When using the `@rails` AI chat participant (in VS Code's Copilot chat panel) or the sidebar webview chat, the AI generates code, diffs, and file content — but **none of it can be applied to files**. The response is display-only markdown text. There is no "Apply" button, no diff preview, and no file modification.

This contrasts with how Cursor agents work: they parse the LLM output and directly apply changes to the project files.

### Root Cause

The `applyAiFix` pipeline in `extension.ts` has all the right machinery (unified diff parsing, `vscode.diff` preview, `WorkspaceEdit` application, Ruby syntax verification, RuboCop verification), but it was **sealed behind the CodeAction lightbulb** — only reachable when clicking 💡 on a diagnostic. The two chat interfaces had zero ability to apply changes:

| Interface | Before | After |
|---|---|---|
| `@rails` Copilot chat participant | Streams markdown only | Streams markdown + "Apply" button |
| Sidebar webview chat | Copy/Insert buttons only | + Apply Diff / Replace File buttons |
| CodeAction lightbulb (existing) | Full diff apply pipeline | Unchanged |

## Solution

### 1. New `ChatDiffApplier` service (`src/chat/ChatDiffApplier.ts`)

Shared service extracted for both chat entry points:
- **`applyDiffToFile()`** — parses unified diff via existing `parseUnifiedDiff()` → applies via `applyUnifiedHunks()` → shows `vscode.diff` preview → applies `WorkspaceEdit` on user confirmation
- **`applyFullFileReplacement()`** — shows full-file diff preview, applies on confirm
- **`createNewFile()`** — prompts for path (or uses suggested path), writes file
- **`smartApplyResponse()`** — auto-detects the best strategy from the AI response:
  - `/service`, `/scaffold`, `/migrate`, `/form` commands → create new file
  - Response contains `@@` / `---` / `+++` → apply as unified diff
  - Response contains large code block with `class`/`module` → replace file
  - `/fix` command → try diff first, then targeted selection replacement
  - Fallback → "use Insert button"

### 2. Chat participant gets an "Apply" button

`RailsChatParticipant.ts` now calls `stream.button()` after streaming the response, wiring to the new `railsforge.applyChatResponse` command. The button title adapts: "Apply Diff" for diffs, "Apply Changes" for code blocks.

### 3. Webview gets diff-aware code buttons

`RailsChatViewProvider.ts` now detects code blocks in AI responses and shows contextual buttons:
- **"🔀 Apply Diff"** — when the block matches `@@`, `---`, `+++` patterns
- **"📄 Replace File"** — when the block is >10 lines and starts with `class`/`module`
- **"📋 Copy"** and **"📥 Insert"** — existing, unchanged

The `applyCode()` handler supports two new modes (`applyDiff`, `replaceFile`) in addition to the existing `insert`/`replace`/`create`.

### 4. New command: `railsforge.applyChatResponse`

Registered in `package.json`, wired in `extension.ts`, delegates to `smartApplyResponse()`.

## Files Changed

- **`src/chat/ChatDiffApplier.ts`** (NEW) — 297 lines
- **`src/chat/RailsChatParticipant.ts`** — Added import + button after streaming
- **`src/chat/RailsChatViewProvider.ts`** — Diff-aware buttons + new applyCode modes
- **`src/extension.ts`** — Import + new `railsforge.applyChatResponse` command
- **`package.json`** — New command + enablement condition

## Testing

- All 326 existing tests pass
- TypeScript compiles cleanly (`tsc --noEmit`)
- No existing behavior changed — this is purely additive