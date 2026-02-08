import {
  AGENT_PROVIDER_LABEL,
  AGENT_PROVIDERS,
  resolveAgentModel,
  type AgentProvider,
  type AgentSettings,
} from '../agentConfig'

interface ProviderModelCatalogEntry {
  models: string[]
  source: string | null
  fetchedAt: string | null
  isLoading: boolean
  error: string | null
}

interface SettingsPanelProps {
  settings: AgentSettings
  modelCatalogByProvider: Record<AgentProvider, ProviderModelCatalogEntry>
  onRefreshProviderModels: (provider: AgentProvider) => void
  onChange: (settings: AgentSettings) => void
  onClose: () => void
}

export function SettingsPanel({
  settings,
  modelCatalogByProvider,
  onRefreshProviderModels,
  onChange,
  onClose,
}: SettingsPanelProps): JSX.Element {
  const updateDefaultProvider = (provider: AgentProvider): void => {
    onChange({
      ...settings,
      defaultProvider: provider,
    })
  }

  const updateProviderCustomModelEnabled = (provider: AgentProvider, enabled: boolean): void => {
    onChange({
      ...settings,
      customModelEnabledByProvider: {
        ...settings.customModelEnabledByProvider,
        [provider]: enabled,
      },
    })
  }

  const updateProviderCustomModel = (provider: AgentProvider, model: string): void => {
    onChange({
      ...settings,
      customModelByProvider: {
        ...settings.customModelByProvider,
        [provider]: model,
      },
    })
  }

  const selectedModel =
    resolveAgentModel(settings, settings.defaultProvider) ?? 'Default (Follow CLI)'

  return (
    <div
      className="settings-backdrop"
      onClick={() => {
        onClose()
      }}
    >
      <section
        className="settings-panel"
        onClick={event => {
          event.stopPropagation()
        }}
      >
        <div className="settings-panel__header">
          <h2>Settings</h2>
          <button
            type="button"
            className="settings-panel__close"
            onClick={() => {
              onClose()
            }}
          >
            ×
          </button>
        </div>

        <div className="settings-panel__section">
          <label htmlFor="settings-default-provider">Default Agent</label>
          <select
            id="settings-default-provider"
            value={settings.defaultProvider}
            onChange={event => {
              updateDefaultProvider(event.target.value as AgentProvider)
            }}
          >
            {AGENT_PROVIDERS.map(provider => (
              <option value={provider} key={provider}>
                {AGENT_PROVIDER_LABEL[provider]}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-panel__section">
          <h3>Model Override</h3>
          {AGENT_PROVIDERS.map(provider => {
            const modelCatalog = modelCatalogByProvider[provider]
            const customEnabled = settings.customModelEnabledByProvider[provider]
            const customModel = settings.customModelByProvider[provider]
            const modelListId = `settings-provider-model-list-${provider}`

            return (
              <article className="settings-provider-card" key={provider}>
                <div className="settings-provider-card__header">
                  <strong>{AGENT_PROVIDER_LABEL[provider]}</strong>
                  <button
                    type="button"
                    className="settings-provider-card__refresh"
                    disabled={modelCatalog.isLoading}
                    onClick={() => {
                      onRefreshProviderModels(provider)
                    }}
                  >
                    {modelCatalog.isLoading ? 'Refreshing...' : 'Refresh Models'}
                  </button>
                </div>

                <label className="settings-provider-card__toggle">
                  <input
                    type="checkbox"
                    data-testid={`settings-custom-model-enabled-${provider}`}
                    checked={customEnabled}
                    onChange={event => {
                      updateProviderCustomModelEnabled(provider, event.target.checked)
                    }}
                  />
                  <span>Use custom model (unchecked = follow CLI default)</span>
                </label>

                <input
                  type="text"
                  list={modelListId}
                  data-testid={`settings-custom-model-input-${provider}`}
                  value={customModel}
                  disabled={!customEnabled}
                  placeholder={
                    provider === 'codex' ? 'Example: gpt-5.2-codex' : 'Example: claude-sonnet-4-5'
                  }
                  onChange={event => {
                    updateProviderCustomModel(provider, event.target.value)
                  }}
                />

                <datalist id={modelListId}>
                  {modelCatalog.models.map(model => (
                    <option value={model} key={model}>
                      {model}
                    </option>
                  ))}
                </datalist>

                <div className="settings-provider-card__meta">
                  <span>
                    Source: {modelCatalog.source ?? 'N/A'} · {modelCatalog.models.length} models
                  </span>
                  {modelCatalog.error ? (
                    <span className="settings-provider-card__error">
                      Error: {modelCatalog.error}
                    </span>
                  ) : modelCatalog.fetchedAt ? (
                    <span>Updated: {new Date(modelCatalog.fetchedAt).toLocaleTimeString()}</span>
                  ) : (
                    <span>Waiting for first fetch...</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <p className="settings-panel__hint">
          Current default: {AGENT_PROVIDER_LABEL[settings.defaultProvider]} · {selectedModel}
        </p>
      </section>
    </div>
  )
}
