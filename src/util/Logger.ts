/**
 * Logger - Centralized logging to the VS Code / Cursor 'RailsForge' Output Channel.
 */

import * as vscode from 'vscode'

export class Logger {
  private static channel?: vscode.LogOutputChannel | vscode.OutputChannel

  static init(context: vscode.ExtensionContext): void {
    try {
      Logger.channel = vscode.window.createOutputChannel('RailsForge', { log: true })
    } catch {
      // Older VS Code/Cursor versions do not support the { log: true } option.
      Logger.channel = vscode.window.createOutputChannel('RailsForge')
    }
    context.subscriptions.push(Logger.channel)
  }

  static info(message: string, ...args: unknown[]): void {
    Logger.write('INFO', message, args)
  }

  static warn(message: string, ...args: unknown[]): void {
    Logger.write('WARN', message, args)
  }

  static error(message: string, ...args: unknown[]): void {
    Logger.write('ERROR', message, args)
  }

  static debug(message: string, ...args: unknown[]): void {
    Logger.write('DEBUG', message, args)
  }

  static show(preserveFocus = true): void {
    Logger.channel?.show(preserveFocus)
  }

  private static write(level: string, message: string, args: unknown[]): void {
    if (!Logger.channel) {return}

    if ('info' in Logger.channel && level === 'INFO') {
      Logger.channel.info(message, ...args)
    } else if ('warn' in Logger.channel && level === 'WARN') {
      Logger.channel.warn(message, ...args)
    } else if ('error' in Logger.channel && level === 'ERROR') {
      Logger.channel.error(message, ...args)
    } else if ('debug' in Logger.channel && level === 'DEBUG') {
      Logger.channel.debug(message, ...args)
    } else {
      const extra = args.length > 0 ? ` ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}` : ''
      Logger.channel.appendLine(`[${new Date().toISOString()}] [${level}] ${message}${extra}`)
    }
  }
}
