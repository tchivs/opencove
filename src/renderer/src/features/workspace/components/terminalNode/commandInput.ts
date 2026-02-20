export type TerminalInputEscapeState = 'none' | 'esc' | 'csi' | 'ss3' | 'osc'

export interface TerminalCommandInputState {
  lineBuffer: string
  escapeState: TerminalInputEscapeState
  oscSawEscape: boolean
}

export interface ParsedTerminalCommands {
  nextState: TerminalCommandInputState
  commands: string[]
}

const MAX_COMMAND_BUFFER_CHARS = 4096

export function createTerminalCommandInputState(): TerminalCommandInputState {
  return {
    lineBuffer: '',
    escapeState: 'none',
    oscSawEscape: false,
  }
}

function appendCharacter(buffer: string, char: string): string {
  if (buffer.length < MAX_COMMAND_BUFFER_CHARS) {
    return `${buffer}${char}`
  }

  return `${buffer.slice(-(MAX_COMMAND_BUFFER_CHARS - 1))}${char}`
}

function deleteLastWord(buffer: string): string {
  let index = buffer.length

  while (index > 0 && /\s/.test(buffer[index - 1] ?? '')) {
    index -= 1
  }

  while (index > 0 && !/\s/.test(buffer[index - 1] ?? '')) {
    index -= 1
  }

  return buffer.slice(0, index)
}

function pushCommand(commands: string[], lineBuffer: string): void {
  const normalized = lineBuffer.trim()
  if (normalized.length > 0) {
    commands.push(normalized)
  }
}

export function parseTerminalCommandInput(
  data: string,
  state: TerminalCommandInputState,
): ParsedTerminalCommands {
  let lineBuffer = state.lineBuffer
  let escapeState = state.escapeState
  let oscSawEscape = state.oscSawEscape
  const commands: string[] = []

  for (const char of data) {
    if (escapeState === 'esc') {
      if (char === '[') {
        escapeState = 'csi'
      } else if (char === ']') {
        escapeState = 'osc'
        oscSawEscape = false
      } else if (char === 'O') {
        escapeState = 'ss3'
      } else {
        escapeState = 'none'
      }
      continue
    }

    if (escapeState === 'csi') {
      if (char >= '@' && char <= '~') {
        escapeState = 'none'
      }
      continue
    }

    if (escapeState === 'ss3') {
      escapeState = 'none'
      continue
    }

    if (escapeState === 'osc') {
      if (char === '\u0007') {
        escapeState = 'none'
        oscSawEscape = false
        continue
      }

      if (oscSawEscape) {
        if (char === '\\') {
          escapeState = 'none'
          oscSawEscape = false
          continue
        }

        oscSawEscape = char === '\u001b'
        continue
      }

      if (char === '\u001b') {
        oscSawEscape = true
      }

      continue
    }

    if (char === '\u001b') {
      escapeState = 'esc'
      continue
    }

    if (char === '\r' || char === '\n') {
      pushCommand(commands, lineBuffer)
      lineBuffer = ''
      continue
    }

    if (char === '\b' || char === '\u007f') {
      lineBuffer = lineBuffer.slice(0, -1)
      continue
    }

    if (char === '\u0003' || char === '\u0015') {
      lineBuffer = ''
      continue
    }

    if (char === '\u0017') {
      lineBuffer = deleteLastWord(lineBuffer)
      continue
    }

    if (char >= ' ') {
      lineBuffer = appendCharacter(lineBuffer, char)
    }
  }

  return {
    nextState: {
      lineBuffer,
      escapeState,
      oscSawEscape,
    },
    commands,
  }
}
