import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import { Logger } from '../src/util/Logger'

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes output channel and registers subscription', () => {
    const subscriptions: unknown[] = []
    const context = { subscriptions } as unknown as vscode.ExtensionContext

    Logger.init(context)

    expect(subscriptions.length).toBe(1)
  })

  it('formats and writes info, warn, error, and debug messages', () => {
    const appendLine = vi.fn()
    const info = vi.fn()
    const warn = vi.fn()
    const error = vi.fn()
    const debug = vi.fn()

    Logger['channel'] = {
      appendLine,
      info,
      warn,
      error,
      debug,
      show: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.LogOutputChannel

    Logger.info('Test info message', { count: 42 })
    Logger.warn('Test warning message')
    Logger.error('Test error message')
    Logger.debug('Test debug message')

    expect(info).toHaveBeenCalledWith('Test info message', { count: 42 })
    expect(warn).toHaveBeenCalledWith('Test warning message')
    expect(error).toHaveBeenCalledWith('Test error message')
    expect(debug).toHaveBeenCalledWith('Test debug message')
  })

  it('falls back to appendLine when log-level methods are absent', () => {
    const appendLine = vi.fn()

    Logger['channel'] = {
      appendLine,
      show: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.OutputChannel

    Logger.info('Simple message')

    expect(appendLine).toHaveBeenCalled()
    const callArg = appendLine.mock.calls[0][0] as string
    expect(callArg).toContain('[INFO] Simple message')
  })

  it('show calls channel show', () => {
    const show = vi.fn()
    Logger['channel'] = {
      show,
    } as unknown as vscode.OutputChannel

    Logger.show(false)

    expect(show).toHaveBeenCalledWith(false)
  })
})
