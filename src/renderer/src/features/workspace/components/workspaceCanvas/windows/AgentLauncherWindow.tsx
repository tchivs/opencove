import type { Dispatch, SetStateAction } from 'react'
import {
  AGENT_PROVIDERS,
  resolveAgentModel,
  type AgentProvider,
  type AgentSettings,
} from '../../../../settings/agentConfig'
import { providerLabel, toSuggestedWorktreePath } from '../helpers'
import type { AgentLauncherState } from '../types'

interface AgentLauncherWindowProps {
  agentLauncher: AgentLauncherState | null
  agentSettings: AgentSettings
  workspacePath: string
  launcherModelOptions: string[]
  setAgentLauncher: Dispatch<SetStateAction<AgentLauncherState | null>>
  closeAgentLauncher: () => void
  launchAgentNode: () => Promise<void>
}

export function AgentLauncherWindow({
  agentLauncher,
  agentSettings,
  workspacePath,
  launcherModelOptions,
  setAgentLauncher,
  closeAgentLauncher,
  launchAgentNode,
}: AgentLauncherWindowProps): React.JSX.Element | null {
  if (!agentLauncher) {
    return null
  }

  return (
    <div
      className="cove-window-backdrop workspace-agent-launcher-backdrop workspace-task-creator-backdrop"
      onClick={() => {
        closeAgentLauncher()
      }}
    >
      <section
        className="cove-window workspace-agent-launcher workspace-task-creator"
        data-testid="workspace-agent-launcher"
        onClick={event => {
          event.stopPropagation()
        }}
      >
        <h3>Run Agent</h3>

        <div className="workspace-agent-launcher__field-row workspace-task-creator__field-row">
          <label htmlFor="workspace-agent-provider">Provider</label>
          <select
            id="workspace-agent-provider"
            data-testid="workspace-agent-launch-provider"
            value={agentLauncher.provider}
            disabled={agentLauncher.isLaunching}
            onChange={event => {
              const nextProvider = event.target.value as AgentProvider
              setAgentLauncher(prev => {
                if (!prev) {
                  return prev
                }

                return {
                  ...prev,
                  provider: nextProvider,
                  model: resolveAgentModel(agentSettings, nextProvider) ?? '',
                  customDirectory:
                    prev.directoryMode === 'custom'
                      ? toSuggestedWorktreePath(workspacePath, nextProvider)
                      : prev.customDirectory,
                  error: null,
                }
              })
            }}
          >
            {AGENT_PROVIDERS.map(provider => (
              <option value={provider} key={provider}>
                {providerLabel(provider)}
              </option>
            ))}
          </select>
        </div>

        <div className="workspace-agent-launcher__field-row workspace-task-creator__field-row">
          <label htmlFor="workspace-agent-model">
            Model (optional, empty = follow CLI/default)
          </label>
          <input
            id="workspace-agent-model"
            data-testid="workspace-agent-launch-model"
            list="workspace-agent-model-options"
            value={agentLauncher.model}
            disabled={agentLauncher.isLaunching}
            placeholder="e.g. gpt-5.2-codex or claude-opus-4-6"
            onChange={event => {
              const nextModel = event.target.value
              setAgentLauncher(prev =>
                prev
                  ? {
                      ...prev,
                      model: nextModel,
                      error: null,
                    }
                  : prev,
              )
            }}
          />
          <datalist id="workspace-agent-model-options">
            {launcherModelOptions.map(model => (
              <option value={model} key={model} />
            ))}
          </datalist>
        </div>

        <div className="workspace-agent-launcher__field-row workspace-task-creator__field-row">
          <label htmlFor="workspace-agent-prompt">Prompt (optional)</label>
          <textarea
            id="workspace-agent-prompt"
            data-testid="workspace-agent-launch-prompt"
            placeholder="留空可直接启动交互式 agent..."
            value={agentLauncher.prompt}
            disabled={agentLauncher.isLaunching}
            onChange={event => {
              const nextPrompt = event.target.value
              setAgentLauncher(prev =>
                prev
                  ? {
                      ...prev,
                      prompt: nextPrompt,
                      error: null,
                    }
                  : prev,
              )
            }}
          />
        </div>

        <div className="workspace-agent-launcher__field-row workspace-task-creator__field-row">
          <label>Execution Directory</label>
          <div className="workspace-agent-launcher__directory-mode">
            <label>
              <input
                type="radio"
                name="workspace-agent-directory-mode"
                checked={agentLauncher.directoryMode === 'workspace'}
                disabled={agentLauncher.isLaunching}
                onChange={() => {
                  setAgentLauncher(prev =>
                    prev
                      ? {
                          ...prev,
                          directoryMode: 'workspace',
                          error: null,
                        }
                      : prev,
                  )
                }}
              />
              <span>Project Root</span>
            </label>

            <label>
              <input
                type="radio"
                name="workspace-agent-directory-mode"
                checked={agentLauncher.directoryMode === 'custom'}
                disabled={agentLauncher.isLaunching}
                onChange={() => {
                  setAgentLauncher(prev =>
                    prev
                      ? {
                          ...prev,
                          directoryMode: 'custom',
                          customDirectory:
                            prev.customDirectory.trim().length > 0
                              ? prev.customDirectory
                              : toSuggestedWorktreePath(workspacePath, prev.provider),
                          error: null,
                        }
                      : prev,
                  )
                }}
              />
              <span>Custom / Worktree</span>
            </label>
          </div>

          {agentLauncher.directoryMode === 'custom' ? (
            <>
              <input
                type="text"
                data-testid="workspace-agent-launch-custom-directory"
                value={agentLauncher.customDirectory}
                disabled={agentLauncher.isLaunching}
                placeholder="/absolute/path/or/relative/path"
                onChange={event => {
                  const nextValue = event.target.value
                  setAgentLauncher(prev =>
                    prev
                      ? {
                          ...prev,
                          customDirectory: nextValue,
                          error: null,
                        }
                      : prev,
                  )
                }}
              />

              <label className="cove-window__checkbox workspace-agent-launcher__checkbox workspace-task-creator__checkbox">
                <input
                  type="checkbox"
                  checked={agentLauncher.shouldCreateDirectory}
                  disabled={agentLauncher.isLaunching}
                  onChange={event => {
                    setAgentLauncher(prev =>
                      prev
                        ? {
                            ...prev,
                            shouldCreateDirectory: event.target.checked,
                          }
                        : prev,
                    )
                  }}
                />
                <span>Auto create directory if missing</span>
              </label>
            </>
          ) : (
            <p className="workspace-agent-launcher__meta">{workspacePath}</p>
          )}
        </div>

        {agentLauncher.error ? (
          <p className="cove-window__error workspace-agent-launcher__error workspace-task-creator__error">
            {agentLauncher.error}
          </p>
        ) : null}

        <div className="cove-window__actions workspace-agent-launcher__actions workspace-task-creator__actions">
          <button
            type="button"
            className="cove-window__action cove-window__action--ghost workspace-task-creator__action workspace-task-creator__action--ghost"
            data-testid="workspace-agent-launch-cancel"
            disabled={agentLauncher.isLaunching}
            onClick={() => {
              closeAgentLauncher()
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cove-window__action cove-window__action--primary workspace-task-creator__action workspace-task-creator__action--primary"
            data-testid="workspace-agent-launch-submit"
            disabled={agentLauncher.isLaunching}
            onClick={() => {
              void launchAgentNode()
            }}
          >
            {agentLauncher.isLaunching ? 'Launching...' : 'Run'}
          </button>
        </div>
      </section>
    </div>
  )
}
