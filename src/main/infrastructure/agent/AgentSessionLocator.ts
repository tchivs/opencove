import fs from 'node:fs/promises'
import os from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { AgentProviderId } from '../../../shared/types/api'

interface LocateAgentResumeSessionInput {
  provider: AgentProviderId
  cwd: string
  startedAtMs: number
  timeoutMs?: number
}

const POLL_INTERVAL_MS = 200
const DEFAULT_TIMEOUT_MS = 2600
const CLAUDE_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CLAUDE_SESSION_SCAN_LINE_LIMIT = 32

function toDateDirectoryParts(timestampMs: number): [string, string, string] {
  const date = new Date(timestampMs)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [year, month, day]
}

function wait(durationMs: number): Promise<void> {
  return new Promise(resolveWait => {
    setTimeout(resolveWait, durationMs)
  })
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

async function listFiles(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    return entries.filter(entry => entry.isFile()).map(entry => join(directory, entry.name))
  } catch {
    return []
  }
}

function parseClaudeSessionIdFromFilePath(filePath: string): string | null {
  if (!filePath.endsWith('.jsonl')) {
    return null
  }

  const fileName = basename(filePath, '.jsonl').trim()
  if (!CLAUDE_UUID_PATTERN.test(fileName)) {
    return null
  }

  return fileName
}

function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function extractClaudeSessionId(record: Record<string, unknown>): string | null {
  const directSessionId = normalizeOptionalString(record.sessionId)
  if (directSessionId) {
    return directSessionId
  }

  const payload =
    typeof record.payload === 'object' && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : null

  const payloadSessionId = normalizeOptionalString(payload?.sessionId)
  if (payloadSessionId) {
    return payloadSessionId
  }

  return null
}

async function readClaudeSessionId(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split('\n')

    let inspectedLineCount = 0
    for (const line of lines) {
      if (inspectedLineCount >= CLAUDE_SESSION_SCAN_LINE_LIMIT) {
        break
      }

      const trimmed = line.trim()
      if (trimmed.length === 0) {
        continue
      }

      inspectedLineCount += 1

      const record = parseJsonObject(trimmed)
      if (!record) {
        continue
      }

      const sessionId = extractClaudeSessionId(record)
      if (sessionId) {
        return sessionId
      }
    }
  } catch {
    return parseClaudeSessionIdFromFilePath(filePath)
  }

  return parseClaudeSessionIdFromFilePath(filePath)
}

async function readFirstLine(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const [firstLine] = raw.split('\n', 1)
    return firstLine?.trim() ?? null
  } catch {
    return null
  }
}

async function findClaudeResumeSessionId(cwd: string, startedAtMs: number): Promise<string | null> {
  const claudeProjectsDir = join(os.homedir(), '.claude', 'projects')
  const encodedPath = resolve(cwd).replace(/[\\/]/g, '-').replace(/:/g, '')
  const projectDir = join(claudeProjectsDir, encodedPath)

  const files = (await listFiles(projectDir)).filter(file => file.endsWith('.jsonl'))
  if (files.length === 0) {
    return null
  }

  const candidates = await Promise.all(
    files.map(async file => {
      try {
        const stats = await fs.stat(file)

        if (stats.mtimeMs < startedAtMs - 6000) {
          return null
        }

        const sessionId = await readClaudeSessionId(file)
        if (!sessionId) {
          return null
        }

        return {
          sessionId,
          mtimeMs: stats.mtimeMs,
        }
      } catch {
        return null
      }
    }),
  )

  const latest = candidates
    .filter((item): item is { sessionId: string; mtimeMs: number } => item !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]

  return latest?.sessionId ?? null
}

async function findCodexResumeSessionId(cwd: string, startedAtMs: number): Promise<string | null> {
  const codexSessionsDir = join(os.homedir(), '.codex', 'sessions')
  const resolvedCwd = resolve(cwd)

  const dateCandidates = new Set<string>()
  const now = Date.now()
  const timestamps = [startedAtMs, now, now - 24 * 60 * 60 * 1000]

  for (const timestamp of timestamps) {
    const [year, month, day] = toDateDirectoryParts(timestamp)
    dateCandidates.add(join(codexSessionsDir, year, month, day))
  }

  const files = (
    await Promise.all(
      [...dateCandidates].map(async directory => {
        const directoryFiles = await listFiles(directory)
        return directoryFiles.filter(file => basename(file).startsWith('rollout-'))
      }),
    )
  ).flat()

  if (files.length === 0) {
    return null
  }

  const candidates = await Promise.all(
    files.map(async file => {
      try {
        const stats = await fs.stat(file)
        if (stats.mtimeMs < startedAtMs - 60_000) {
          return null
        }

        const firstLine = await readFirstLine(file)
        if (!firstLine) {
          return null
        }

        const parsed = JSON.parse(firstLine) as {
          payload?: {
            id?: unknown
            cwd?: unknown
          }
        }

        const sessionId = typeof parsed.payload?.id === 'string' ? parsed.payload.id.trim() : null
        const sessionCwd =
          typeof parsed.payload?.cwd === 'string' ? resolve(parsed.payload.cwd) : null

        if (!sessionId || sessionCwd !== resolvedCwd) {
          return null
        }

        return {
          sessionId,
          mtimeMs: stats.mtimeMs,
        }
      } catch {
        return null
      }
    }),
  )

  const latest = candidates
    .filter((item): item is { sessionId: string; mtimeMs: number } => item !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]

  return latest?.sessionId ?? null
}

async function tryFindResumeSessionId(
  provider: AgentProviderId,
  cwd: string,
  startedAtMs: number,
): Promise<string | null> {
  if (provider === 'claude-code') {
    return await findClaudeResumeSessionId(cwd, startedAtMs)
  }

  return await findCodexResumeSessionId(cwd, startedAtMs)
}

async function pollResumeSessionId(
  provider: AgentProviderId,
  cwd: string,
  startedAtMs: number,
  deadline: number,
): Promise<string | null> {
  const detected = await tryFindResumeSessionId(provider, cwd, startedAtMs)
  if (detected) {
    return detected
  }

  if (Date.now() > deadline) {
    return null
  }

  await wait(POLL_INTERVAL_MS)
  return await pollResumeSessionId(provider, cwd, startedAtMs, deadline)
}

export async function locateAgentResumeSessionId({
  provider,
  cwd,
  startedAtMs,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LocateAgentResumeSessionInput): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  return await pollResumeSessionId(provider, cwd, startedAtMs, deadline)
}
