/**
 * RoutesIndexer - In-memory index of Rails route table and named path helpers
 */

export interface RailsRoute {
  prefix?: string
  verb: string
  uriPattern: string
  controller: string
  action: string
  helperName?: string
}

export class RoutesIndexer {
  private routes: RailsRoute[] = []
  private helperMap: Map<string, RailsRoute> = new Map()

  parseRoutesTable(content: string): void {
    this.routes = []
    this.helperMap.clear()
    const lines = content.split('\n')

    for (const line of lines) {
      const route = this.parseRouteLine(line)
      if (route) {
        this.routes.push(route)
        if (route.helperName) {
          this.helperMap.set(route.helperName, route)
          this.helperMap.set(`${route.helperName}_path`, route)
          this.helperMap.set(`${route.helperName}_url`, route)
        }
      }
    }
  }

  private parseRouteLine(line: string): RailsRoute | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('Prefix') || trimmed.startsWith('--')) {
      return null
    }

    const parts = trimmed.split(/\s+/)
    if (parts.length < 3) {return null}

    let prefix: string | undefined
    let verb: string
    let uriPattern: string
    let controllerAction: string

    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(parts[0])) {
      verb = parts[0]
      uriPattern = parts[1]
      controllerAction = parts[2]
    } else {
      prefix = parts[0]
      verb = parts[1]
      uriPattern = parts[2]
      controllerAction = parts[3]
    }

    if (!controllerAction || !controllerAction.includes('#')) {
      return null
    }

    const [controller, action] = controllerAction.split('#')
    return {
      prefix,
      verb,
      uriPattern,
      controller,
      action,
      helperName: prefix,
    }
  }

  findHelper(name: string): RailsRoute | undefined {
    return this.helperMap.get(name)
  }

  searchRoutes(query: string): RailsRoute[] {
    const q = query.toLowerCase()
    return this.routes.filter(r =>
      r.uriPattern.toLowerCase().includes(q) ||
      (r.helperName && r.helperName.toLowerCase().includes(q)) ||
      `${r.controller}#${r.action}`.toLowerCase().includes(q),
    )
  }

  getAllRoutes(): RailsRoute[] {
    return this.routes
  }
}
