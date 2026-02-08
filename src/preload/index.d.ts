import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  KillTerminalInput,
  ListAgentModelsInput,
  ListAgentModelsResult,
  ResizeTerminalInput,
  SpawnTerminalInput,
  TerminalDataEvent,
  TerminalExitEvent,
  WorkspaceDirectory,
  WriteTerminalInput,
} from '../shared/types/api'

type UnsubscribeFn = () => void

export interface CoveApi {
  workspace: {
    selectDirectory: () => Promise<WorkspaceDirectory | null>
  }
  pty: {
    spawn: (payload: SpawnTerminalInput) => Promise<{ sessionId: string }>
    write: (payload: WriteTerminalInput) => Promise<void>
    resize: (payload: ResizeTerminalInput) => Promise<void>
    kill: (payload: KillTerminalInput) => Promise<void>
    onData: (listener: (event: TerminalDataEvent) => void) => UnsubscribeFn
    onExit: (listener: (event: TerminalExitEvent) => void) => UnsubscribeFn
  }
  agent: {
    listModels: (payload: ListAgentModelsInput) => Promise<ListAgentModelsResult>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    coveApi: CoveApi
  }
}
