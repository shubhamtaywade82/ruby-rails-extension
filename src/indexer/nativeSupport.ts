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
const REQUIRED_LINUX_GLIBC = [2, 33]

export function getLinuxGlibcVersion(): string | undefined {
  if (process.platform !== 'linux') {return undefined}
  try {
    const report = process.report?.getReport?.() as { header?: { glibcVersionRuntime?: string } } | undefined
    return report?.header?.glibcVersionRuntime
  } catch {
    // Some sandboxed/embedded hosts (e.g. remote extension hosts) can throw here
    // instead of returning undefined — either way, treat as "couldn't determine".
    return undefined
  }
}

export function isPersistentIndexSupported(): boolean {
  const napiVersion = Number(process.versions.napi)
  if (!Number.isFinite(napiVersion) || napiVersion < REQUIRED_NAPI_VERSION) {
    return false
  }

  // better-sqlite3 Linux prebuilt binary requires GLIBC >= 2.33. If the version can't be
  // determined, fail closed — loading the addon on an unverified runtime risks the
  // unrecoverable napi_fatal_error abort described above.
  if (process.platform === 'linux') {
    const glibcStr = getLinuxGlibcVersion()
    if (!glibcStr) {
      return false
    }
    const [major, minor] = glibcStr.split('.').map(Number)
    if (major < REQUIRED_LINUX_GLIBC[0] || (major === REQUIRED_LINUX_GLIBC[0] && minor < REQUIRED_LINUX_GLIBC[1])) {
      return false
    }
  }

  return true
}
