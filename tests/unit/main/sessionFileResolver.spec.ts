import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveSessionFilePath } from '../../../src/main/infrastructure/session/SessionFileResolver'

describe('resolveSessionFilePath', () => {
  it('returns null for claude-code when session file does not exist yet', async () => {
    const tempHome = await fs.mkdtemp(join(tmpdir(), 'cove-test-home-'))
    const previousHome = process.env.HOME
    process.env.HOME = tempHome

    const cwd = join(tempHome, 'workspace')
    const sessionId = 'session-123'
    const startedAtMs = Date.now()

    try {
      const resolved = await resolveSessionFilePath({
        provider: 'claude-code',
        cwd,
        sessionId,
        startedAtMs,
        timeoutMs: 0,
      })

      expect(resolved).toBeNull()
    } finally {
      process.env.HOME = previousHome
    }
  })

  it('resolves claude-code session file once it exists', async () => {
    const tempHome = await fs.mkdtemp(join(tmpdir(), 'cove-test-home-'))
    const previousHome = process.env.HOME
    process.env.HOME = tempHome

    const cwd = join(tempHome, 'workspace')
    const sessionId = 'session-abc'
    const startedAtMs = Date.now()

    const encodedPath = resolvePath(cwd).replace(/[\\/]/g, '-').replace(/:/g, '')
    const expectedPath = join(tempHome, '.claude', 'projects', encodedPath, `${sessionId}.jsonl`)

    try {
      await fs.mkdir(dirname(expectedPath), { recursive: true })
      await fs.writeFile(expectedPath, '{"type":"assistant","message":{"content":[]}}\n', 'utf8')

      const resolved = await resolveSessionFilePath({
        provider: 'claude-code',
        cwd,
        sessionId,
        startedAtMs,
        timeoutMs: 0,
      })

      expect(resolved).toBe(expectedPath)
    } finally {
      process.env.HOME = previousHome
    }
  })
})
