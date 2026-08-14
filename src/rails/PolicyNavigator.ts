/**
 * PolicyNavigator - Resolves Pundit & CanCanCan authorization policy files
 */

import * as path from 'path'
import * as fs from 'fs'

export class PolicyNavigator {
  resolvePolicyPath(modelName: string, workspaceRoot: string): string | null {
    const clean = modelName.replace(/[@:]/g, '').trim()
    const policyName = `${this.underscore(clean)}_policy.rb`
    const candidatePath = path.join(workspaceRoot, 'app', 'policies', policyName)

    if (fs.existsSync(candidatePath)) {
      return candidatePath
    }

    const appPolicy = path.join(workspaceRoot, 'app', 'policies', 'application_policy.rb')
    if (fs.existsSync(appPolicy)) {
      return appPolicy
    }

    return null
  }

  private underscore(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }
}
