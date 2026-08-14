/**
 * BundlerAuditScanner - Scans Gemfile.lock for vulnerable gem dependencies (CVEs)
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface GemVulnerability {
  gemName: string
  version: string
  cve: string
  title: string
  url: string
  criticality: 'High' | 'Medium' | 'Low' | 'Unknown'
}

export interface BundlerAuditReport {
  vulnerabilities: GemVulnerability[]
  unpatchedGems: number
}

export class BundlerAuditScanner {
  async runAudit(workspaceRoot: string): Promise<BundlerAuditReport> {
    const cmd = 'bundle-audit check --format json || bundle exec bundle-audit check --format json'
    try {
      const { stdout } = await execAsync(cmd, { cwd: workspaceRoot, maxBuffer: 5 * 1024 * 1024 })
      const parsed = JSON.parse(stdout)
      const vulns: GemVulnerability[] = (parsed.results ?? []).map((r: { gem?: { name?: string; version?: string }; advisory?: { cve?: string; title?: string; url?: string; criticality?: string } }) => ({
        gemName: r.gem?.name ?? 'unknown',
        version: r.gem?.version ?? 'unknown',
        cve: r.advisory?.cve ?? 'CVE-UNKNOWN',
        title: r.advisory?.title ?? 'Vulnerability detected',
        url: r.advisory?.url ?? '',
        criticality: (r.advisory?.criticality ?? 'Medium') as 'High' | 'Medium' | 'Low' | 'Unknown',
      }))

      return {
        vulnerabilities: vulns,
        unpatchedGems: vulns.length,
      }
    } catch {
      return { vulnerabilities: [], unpatchedGems: 0 }
    }
  }

  formatReport(report: BundlerAuditReport): string {
    if (report.vulnerabilities.length === 0) {
      return '## RailsForge Dependency Security Audit (bundle-audit)\n\n✓ **0 Vulnerable Gem Dependencies Found in Gemfile.lock!**'
    }

    const lines: string[] = ['## RailsForge Dependency Security Audit (bundle-audit)\n']
    lines.push(`Found **${report.vulnerabilities.length}** vulnerable dependency advisories:\n`)

    for (const v of report.vulnerabilities) {
      lines.push(`### [${v.criticality}] ${v.gemName} (${v.version}) - ${v.cve}`)
      lines.push(`- **Advisory**: ${v.title}`)
      if (v.url) {lines.push(`- **Reference**: [${v.url}](${v.url})`)}
      lines.push('')
    }

    return lines.join('\n')
  }
}
