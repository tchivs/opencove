#!/usr/bin/env node

import fs from 'node:fs/promises'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'

function sleep(ms) {
  return new Promise(resolveSleep => {
    setTimeout(resolveSleep, ms)
  })
}

function toDateDirectoryParts(timestampMs) {
  const date = new Date(timestampMs)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [year, month, day]
}

async function createCodexSessionFile(cwd) {
  const startedAtMs = Date.now()
  const sessionId = `cove-test-session-${startedAtMs}`
  const [year, month, day] = toDateDirectoryParts(startedAtMs)
  const sessionFilePath = join(
    os.homedir(),
    '.codex',
    'sessions',
    year,
    month,
    day,
    `rollout-${sessionId}.jsonl`,
  )
  const sessionTimestamp = new Date(startedAtMs).toISOString()

  await fs.mkdir(dirname(sessionFilePath), { recursive: true })
  await fs.writeFile(
    sessionFilePath,
    `${JSON.stringify({
      timestamp: sessionTimestamp,
      type: 'session_meta',
      payload: {
        id: sessionId,
        cwd,
        timestamp: sessionTimestamp,
      },
    })}\n`,
    'utf8',
  )

  return sessionFilePath
}

async function appendCodexRecord(sessionFilePath, record, { newline = true } = {}) {
  const serialized = JSON.stringify(record)
  await fs.appendFile(sessionFilePath, newline ? `${serialized}\n` : serialized, 'utf8')
}

async function runCodexStandbyNoNewlineScenario(cwd) {
  const sessionFilePath = await createCodexSessionFile(cwd)

  await sleep(800)
  await appendCodexRecord(sessionFilePath, {
    type: 'response_item',
    payload: {
      type: 'reasoning',
      summary: [],
    },
  })

  await sleep(1200)
  await appendCodexRecord(
    sessionFilePath,
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        phase: 'final_answer',
        content: [
          {
            type: 'output_text',
            text: 'All set.',
          },
        ],
      },
    },
    { newline: false },
  )

  await sleep(20_000)
}

async function runCodexCommentaryThenFinalScenario(cwd) {
  const sessionFilePath = await createCodexSessionFile(cwd)

  await sleep(700)
  await appendCodexRecord(sessionFilePath, {
    type: 'response_item',
    payload: {
      type: 'reasoning',
      summary: [],
    },
  })

  await sleep(1200)
  await appendCodexRecord(sessionFilePath, {
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'assistant',
      phase: 'commentary',
      content: [
        {
          type: 'output_text',
          text: 'I am checking the repo before making changes.',
        },
      ],
    },
  })

  await sleep(1200)
  await appendCodexRecord(sessionFilePath, {
    type: 'response_item',
    payload: {
      type: 'function_call',
      call_id: 'call-cove-test-1',
      name: 'exec_command',
      arguments: '{"cmd":"pwd"}',
    },
  })

  await sleep(1800)
  await appendCodexRecord(
    sessionFilePath,
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        phase: 'final_answer',
        content: [
          {
            type: 'output_text',
            text: 'Done.',
          },
        ],
      },
    },
    { newline: false },
  )

  await sleep(20_000)
}

async function main() {
  const [
    provider = 'codex',
    rawCwd = process.cwd(),
    mode = 'new',
    model = 'default-model',
    scenario = '',
  ] = process.argv.slice(2)
  const cwd = resolve(rawCwd)

  process.stdout.write(`[cove-test-agent] ${provider} ${mode} ${model}\n`)

  if (provider === 'codex' && scenario === 'codex-standby-no-newline') {
    await runCodexStandbyNoNewlineScenario(cwd)
    return
  }

  if (provider === 'codex' && scenario === 'codex-commentary-then-final') {
    await runCodexCommentaryThenFinalScenario(cwd)
    return
  }

  await sleep(120_000)
}

await main()
