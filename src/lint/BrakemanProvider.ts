/**
 * BrakemanProvider - Runs Brakeman security analysis on Rails projects
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface BrakemanWarning {
  warning_type: string
  warning_code: number
  fingerprint: string
  message: string
  file: string
  line: number
  link: string
  confidence: 'High' | 'Medium' | 'Weak'
  user_input?: string
}

export interface BrakemanReport {
  warnings: BrakemanWarning[]
  errors: string[]
  scanDuration: number
}

export class BrakemanProvider {
  async runScan(workspaceRoot: string): Promise<BrakemanReport> {
    const cmd = 'bundle exec brakeman -f json -q || brakeman -f json -q'
    try {
      const { stdout } = await execAsync(cmd, { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 })
      const parsed = JSON.parse(stdout)
      return {
        warnings: parsed.warnings ?? [],
        errors: parsed.errors ?? [],
        scanDuration: parsed.scan_info?.duration ?? 0,
      }
    } catch (err: unknown) {
      const execErr = err as { stdout?: string }
      if (execErr.stdout) {
        try {
          const parsed = JSON.parse(execErr.stdout)
          return {
            warnings: parsed.warnings ?? [],
            errors: parsed.errors ?? [],
            scanDuration: parsed.scan_info?.duration ?? 0,
          }
        } catch {
          // Fall through
        }
      }
      return { warnings: [], errors: ['Brakeman execution failed.'], scanDuration: 0 }
    }
  }

  formatMarkdownReport(report: BrakemanReport): string {
    if (report.warnings.length === 0) {
      return '## RailsForge Security Audit (Brakeman)\n\n✓ **0 Security Vulnerabilities Found!** Clean bill of health.'
    }

    const lines: string[] = ['## RailsForge Security Audit (Brakeman)\n']
    lines.push(`Found **${report.warnings.length}** security warning(s):\n`)

    for (const w of report.warnings) {
      lines.push(`### [${w.confidence} Confidence] ${w.warning_type}`)
      lines.push(`- **Location**: \`${w.file}:${w.line}\``)
      lines.push(`- **Details**: ${w.message}`)
      if (w.user_input) {
        lines.push(`- **User Input**: \`${w.user_input}\``)
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}
