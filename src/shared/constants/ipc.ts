export const IPC_CHANNELS = {
  workspaceSelectDirectory: 'workspace:select-directory',
  workspaceEnsureDirectory: 'workspace:ensure-directory',
  ptySpawn: 'pty:spawn',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyAttach: 'pty:attach',
  ptyDetach: 'pty:detach',
  ptySnapshot: 'pty:snapshot',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  ptyDone: 'pty:done',
  agentListModels: 'agent:list-models',
  agentLaunch: 'agent:launch',
  taskSuggestTitle: 'task:suggest-title',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
