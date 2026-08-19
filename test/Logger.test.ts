import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
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

  it('formats and writes info, warn, error, and debug messages at debug level', () => {
    const appendLine = vi.fn()
    const info = vi.fn()
    const warn = vi.fn()
    const error = vi.fn()
    const debug = vi.fn()
    const trace = vi.fn()

    Logger.setLevel('debug')
    Logger['channel'] = {
      appendLine,
      info,
      warn,
      error,
      debug,
      trace,
      show: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.LogOutputChannel

    Logger.info('Test info message', { count: 42 })
    Logger.warn('Test warning message')
    Logger.error('Test error message')
    Logger.debug('Test debug message')
    Logger.trace('Test trace message')

    expect(info).toHaveBeenCalledWith('Test info message', { count: 42 })
    expect(warn).toHaveBeenCalledWith('Test warning message')
    expect(error).toHaveBeenCalledWith('Test error message')
    expect(debug).toHaveBeenCalledWith('Test debug message')
    expect(trace).not.toHaveBeenCalled()
  })

  it('filters debug and trace at the default info level', () => {
    const debug = vi.fn()
    const trace = vi.fn()

    Logger.setLevel('info')
    Logger['channel'] = {
      debug,
      trace,
      show: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.LogOutputChannel

    Logger.debug('dropped')
    Logger.trace('dropped')

    expect(debug).not.toHaveBeenCalled()
    expect(trace).not.toHaveBeenCalled()
  })

  it('mirrors log lines to the configured log file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-logger-'))
    const file = path.join(dir, 'railsforge.log')

    Logger.setLevel('debug')
    Logger.setLogFile(file)
    Logger['channel'] = {
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.OutputChannel

    Logger.info('File line one')
    Logger.warn('File line two')

    await new Promise(resolve => setTimeout(resolve, 100))
    const content = fs.readFileSync(file, 'utf8')
    expect(content).toContain('[INFO] File line one')
    expect(content).toContain('[WARN] File line two')

    Logger.setLogFile(undefined)
    fs.rmSync(dir, { recursive: true, force: true })
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
