import os from 'node:os'
import process from 'node:process'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'

export interface SpawnPtyOptions {
  cwd: string
  shell?: string
  command?: string
  args?: string[]
  cols: number
  rows: number
}

const MAX_SNAPSHOT_CHARS = 400_000

export class PtyManager {
  private sessions = new Map<string, IPty>()
  private snapshots = new Map<string, string>()

  public spawnSession(options: SpawnPtyOptions): { sessionId: string; pty: IPty } {
    const sessionId = crypto.randomUUID()
    const command = options.command ?? options.shell ?? this.resolveDefaultShell()
    const args = options.command ? (options.args ?? []) : []

    const pty = spawn(command, args, {
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: process.env,
      name: 'xterm-256color',
    })

    this.sessions.set(sessionId, pty)
    this.snapshots.set(sessionId, '')

    return { sessionId, pty }
  }

  public appendSnapshotData(sessionId: string, data: string): void {
    if (!this.sessions.has(sessionId)) {
      return
    }

    const previous = this.snapshots.get(sessionId) ?? ''
    const next = previous + data

    if (next.length <= MAX_SNAPSHOT_CHARS) {
      this.snapshots.set(sessionId, next)
      return
    }

    this.snapshots.set(sessionId, next.slice(-MAX_SNAPSHOT_CHARS))
  }

  public snapshot(sessionId: string): string {
    return this.snapshots.get(sessionId) ?? ''
  }

  public write(sessionId: string, data: string): void {
    const pty = this.sessions.get(sessionId)
    if (!pty) {
      return
    }

    pty.write(data)
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const pty = this.sessions.get(sessionId)
    if (!pty) {
      return
    }

    pty.resize(cols, rows)
  }

  public kill(sessionId: string): void {
    const pty = this.sessions.get(sessionId)
    if (!pty) {
      return
    }

    pty.kill()
    this.sessions.delete(sessionId)
    this.snapshots.delete(sessionId)
  }

  public delete(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.snapshots.delete(sessionId)
  }

  public disposeAll(): void {
    for (const [sessionId, pty] of this.sessions.entries()) {
      pty.kill()
      this.sessions.delete(sessionId)
      this.snapshots.delete(sessionId)
    }
  }

  private resolveDefaultShell(): string {
    if (process.platform === 'win32') {
      return 'powershell.exe'
    }

    return process.env.SHELL || (os.platform() === 'darwin' ? '/bin/zsh' : '/bin/bash')
  }
}
