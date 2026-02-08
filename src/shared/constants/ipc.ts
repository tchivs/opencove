export const IPC_CHANNELS = {
  workspaceSelectDirectory: 'workspace:select-directory',
  ptySpawn: 'pty:spawn',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  agentListModels: 'agent:list-models',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
