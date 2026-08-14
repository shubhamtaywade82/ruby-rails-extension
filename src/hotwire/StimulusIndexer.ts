/**
 * StimulusIndexer - Discovers and indexes Stimulus controllers, actions, and targets
 */

export interface StimulusControllerDef {
  identifier: string
  filePath: string
  targets: string[]
  actions: string[]
  values: string[]
}

export class StimulusIndexer {
  private controllers: Map<string, StimulusControllerDef> = new Map()

  parseControllerCode(filePath: string, code: string): StimulusControllerDef {
    const identifier = this.fileToIdentifier(filePath)
    const targets = this.extractTargets(code)
    const actions = this.extractActions(code)
    const values = this.extractValues(code)

    const def: StimulusControllerDef = {
      identifier,
      filePath,
      targets,
      actions,
      values,
    }

    this.controllers.set(identifier, def)
    return def
  }

  private fileToIdentifier(filePath: string): string {
    const match = /(?:controllers[/\\])(.+)_controller\.[jt]s$/.exec(filePath)
    if (!match) {
      return 'application'
    }
    return match[1].replace(/[/\\]/g, '--').replace(/_/g, '-')
  }

  private extractTargets(code: string): string[] {
    const match = /static\s+targets\s*=\s*\[([^\]]+)\]/.exec(code)
    if (!match) {return []}

    return match[1]
      .split(',')
      .map(t => t.replace(/['"\s]/g, '').trim())
      .filter(Boolean)
  }

  private extractActions(code: string): string[] {
    const actions: string[] = []
    const methodRegex = /^\s*([a-zA-Z0-9_]+)\s*\((?:event)?\)\s*\{/gm
    let match: RegExpExecArray | null

    while ((match = methodRegex.exec(code)) !== null) {
      const name = match[1]
      if (!['connect', 'disconnect', 'initialize'].includes(name)) {
        actions.push(name)
      }
    }
    return actions
  }

  private extractValues(code: string): string[] {
    const match = /static\s+values\s*=\s*\{([^}]+)\}/.exec(code)
    if (!match) {return []}

    return match[1]
      .split(',')
      .map(v => v.split(':')[0].replace(/['"\s]/g, '').trim())
      .filter(Boolean)
  }

  getController(identifier: string): StimulusControllerDef | undefined {
    return this.controllers.get(identifier)
  }

  getAllControllers(): StimulusControllerDef[] {
    return Array.from(this.controllers.values())
  }
}
