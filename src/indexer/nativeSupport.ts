/**
 * nativeSupport - gates whether it's safe to load better-sqlite3 at all.
 *
 * better-sqlite3's N-API build hardcodes NAPI_VERSION=10 (every published version,
 * 13.0.0+, no lower-NAPI release exists). Node's own N-API version matrix backported
 * version 10 only to >= 22.14 / 23.6 — Node 20.x (and older 22.x patches) top out at
 * N-API 9. Loading an addon that requests an unsupported N-API version doesn't throw a
 * catchable JS error: it calls the native `napi_fatal_error`, which aborts the entire
 * process immediately. try/catch cannot protect against this — the only safe fix is to
 * never call `require('better-sqlite3')` (see database.ts's lazy require) unless this
 * check has already confirmed the runtime supports it.
 */

const REQUIRED_NAPI_VERSION = 10

export function isPersistentIndexSupported(): boolean {
  const napiVersion = Number(process.versions.napi)
  return Number.isFinite(napiVersion) && napiVersion >= REQUIRED_NAPI_VERSION
}
