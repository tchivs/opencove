import type { Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsPromisesMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
}))

const osMock = vi.hoisted(() => ({
  homedir: vi.fn(() => '/Users/tester'),
}))

vi.mock('node:fs/promises', () => ({
  default: fsPromisesMock,
}))

vi.mock('node:os', () => ({
  default: osMock,
}))

import { locateAgentResumeSessionId } from '../../../src/main/infrastructure/agent/AgentSessionLocator'

function createFileEntry(name: string): Dirent {
  return {
    name,
    isFile: () => true,
  } as unknown as Dirent
}

function toClaudeProjectDir(cwd: string): string {
  const encodedPath = resolve(cwd).replace(/[\\/]/g, '-').replace(/:/g, '')
  return join('/Users/tester', '.claude', 'projects', encodedPath)
}

describe('locateAgentResumeSessionId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    osMock.homedir.mockReturnValue('/Users/tester')
  })

  it('parses claude resume session id from jsonl payload instead of filename', async () => {
    const cwd = '/Users/tester/Development/cove'
    const startedAtMs = 1_707_000_000_000
    const projectDir = toClaudeProjectDir(cwd)
    const latestFile = join(projectDir, 'agent-a5170af.jsonl')

    fsPromisesMock.readdir.mockResolvedValue([
      createFileEntry('agent-a5170af.jsonl'),
      createFileEntry('agent-legacy.jsonl'),
    ])

    fsPromisesMock.stat.mockImplementation(async (filePath: string) => {
      if (filePath === latestFile) {
        return { mtimeMs: startedAtMs + 150 }
      }

      return { mtimeMs: startedAtMs + 50 }
    })

    fsPromisesMock.readFile.mockImplementation(async (filePath: string) => {
      if (filePath === latestFile) {
        return '{"type":"bootstrap","sessionId":"c954dfa5-20a2-45eb-bfe6-1802f9b41683"}\n'
      }

      return '{"type":"bootstrap","sessionId":"4c839b40-c95d-40b6-87ff-6800f64febb8"}\n'
    })

    const sessionId = await locateAgentResumeSessionId({
      provider: 'claude-code',
      cwd,
      startedAtMs,
      timeoutMs: 10,
    })

    expect(sessionId).toBe('c954dfa5-20a2-45eb-bfe6-1802f9b41683')
  })

  it('falls back to uuid filename for legacy claude session logs', async () => {
    const cwd = '/Users/tester/Development/cove'
    const startedAtMs = 1_707_000_000_000
    const projectDir = toClaudeProjectDir(cwd)
    const sessionId = 'c954dfa5-20a2-45eb-bfe6-1802f9b41683'
    const fileName = `${sessionId}.jsonl`
    const targetFile = join(projectDir, fileName)

    fsPromisesMock.readdir.mockResolvedValue([createFileEntry(fileName)])

    fsPromisesMock.stat.mockImplementation(async (filePath: string) => {
      if (filePath === targetFile) {
        return { mtimeMs: startedAtMs + 100 }
      }

      return { mtimeMs: startedAtMs - 20_000 }
    })

    fsPromisesMock.readFile.mockResolvedValue('{"type":"message"}\n')

    const detected = await locateAgentResumeSessionId({
      provider: 'claude-code',
      cwd,
      startedAtMs,
      timeoutMs: 10,
    })

    expect(detected).toBe(sessionId)
  })
})
