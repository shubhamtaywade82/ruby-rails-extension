# Cassettes

VCR-style recorded HTTP responses for `RailsAgent`'s provider tests
(`test/RailsAgent.test.ts`), replayed via `test/support/cassette.ts` instead
of hand-typed mock response bodies. The point is to validate response
*parsing* against a real provider payload, not a guess at its shape.

## Regenerating

```sh
pnpm run record-cassettes
```

This is **not** run in CI or by `pnpm test` — cassettes are committed
fixtures. Re-record one only when a provider actually changes its response
shape, using real credentials:

| Cassette | Needs | Notes |
| :--- | :--- | :--- |
| `rails-agent-ollama-chat.json` | `CLOUD_OLLAMA_HOST` + `CLOUD_OLLAMA_API_KEY` (or a local Ollama on `OLLAMA_HOST`) | Also used to validate the `openai` provider's parsing branch — both go through the same OpenAI-compatible response shape in `RailsAgent`, see `provenance` in the file |
| `rails-agent-openai-chat.json` | `OPENAI_API_KEY` | Not currently recorded — no key was available when this was set up; `record.mjs` supports it whenever a maintainer has one |
| `rails-agent-anthropic-message.json` | `ANTHROPIC_API_KEY` | Not currently recorded, same reason. The corresponding test in `RailsAgent.test.ts` is skipped (`it.skipIf`) with an `it.todo` note until this exists |

Each `.json` file only stores the **response** (status + body), never the
request headers/auth used to record it — nothing secret ends up committed.
See `record.mjs`'s header comment for exact usage.
