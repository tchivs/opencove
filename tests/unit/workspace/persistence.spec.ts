import { describe, expect, it } from 'vitest'
import {
  readPersistedState,
  toPersistedState,
  writePersistedState,
  writeRawPersistedState,
} from '../../../src/renderer/src/features/workspace/utils/persistence'
import type { WorkspaceState } from '../../../src/renderer/src/features/workspace/types'

class MockStorage implements Storage {
  private store = new Map<string, string>()

  public get length(): number {
    return this.store.size
  }

  public clear(): void {
    this.store.clear()
  }

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  public key(index: number): string | null {
    const keys = [...this.store.keys()]
    return keys[index] ?? null
  }

  public removeItem(key: string): void {
    this.store.delete(key)
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: new MockStorage(),
})

describe('workspace persistence', () => {
  it('writes and reads persisted state', () => {
    const workspaces: WorkspaceState[] = [
      {
        id: 'workspace-1',
        name: 'cove',
        path: '/tmp/cove',
        nodes: [
          {
            id: 'node-1',
            type: 'terminalNode',
            position: { x: 100, y: 80 },
            data: {
              sessionId: 'session-1',
              title: 'terminal-1',
              width: 460,
              height: 300,
            },
          },
        ],
      },
    ]

    const persisted = toPersistedState(workspaces, 'workspace-1')
    writePersistedState(persisted)

    const restored = readPersistedState()

    expect(restored).not.toBeNull()
    expect(restored?.activeWorkspaceId).toBe('workspace-1')
    expect(restored?.workspaces).toHaveLength(1)
    expect(restored?.workspaces[0].nodes[0].title).toBe('terminal-1')
    expect(restored?.settings.defaultProvider).toBe('claude-code')
    expect(restored?.settings.customModelEnabledByProvider.codex).toBe(false)
    expect(restored?.settings.customModelByProvider.codex).toBe('')
  })

  it('falls back to default settings when persisted settings are missing', () => {
    writeRawPersistedState(
      JSON.stringify({
        activeWorkspaceId: null,
        workspaces: [],
      }),
    )

    const restored = readPersistedState()
    expect(restored).not.toBeNull()
    expect(restored?.settings.defaultProvider).toBe('claude-code')
    expect(restored?.settings.customModelEnabledByProvider['claude-code']).toBe(false)
    expect(restored?.settings.customModelByProvider['claude-code']).toBe('')
  })

  it('returns null when stored json is invalid', () => {
    writeRawPersistedState('{')
    expect(readPersistedState()).toBeNull()
  })
})
