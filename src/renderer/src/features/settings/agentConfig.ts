export const AGENT_PROVIDERS = ['claude-code', 'codex'] as const

export type AgentProvider = (typeof AGENT_PROVIDERS)[number]

export const AGENT_PROVIDER_LABEL: Record<AgentProvider, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
}

export type AgentCustomModelEnabledByProvider = {
  [provider in AgentProvider]: boolean
}

export type AgentCustomModelByProvider = {
  [provider in AgentProvider]: string
}

export interface AgentSettings {
  defaultProvider: AgentProvider
  customModelEnabledByProvider: AgentCustomModelEnabledByProvider
  customModelByProvider: AgentCustomModelByProvider
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  defaultProvider: 'claude-code',
  customModelEnabledByProvider: {
    'claude-code': false,
    codex: false,
  },
  customModelByProvider: {
    'claude-code': '',
    codex: '',
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isValidProvider(value: unknown): value is AgentProvider {
  return typeof value === 'string' && AGENT_PROVIDERS.includes(value as AgentProvider)
}

function normalizeModelValue(model: unknown): string {
  if (typeof model !== 'string') {
    return ''
  }

  return model.trim()
}

function normalizeModelEnabled(value: unknown): boolean | null {
  if (typeof value !== 'boolean') {
    return null
  }

  return value
}

export function resolveAgentModel(settings: AgentSettings, provider: AgentProvider): string | null {
  if (!settings.customModelEnabledByProvider[provider]) {
    return null
  }

  const model = settings.customModelByProvider[provider].trim()
  return model.length > 0 ? model : null
}

export function normalizeAgentSettings(value: unknown): AgentSettings {
  if (!isRecord(value)) {
    return DEFAULT_AGENT_SETTINGS
  }

  const defaultProvider = isValidProvider(value.defaultProvider)
    ? value.defaultProvider
    : DEFAULT_AGENT_SETTINGS.defaultProvider

  const enabledInput = isRecord(value.customModelEnabledByProvider)
    ? value.customModelEnabledByProvider
    : {}

  const customModelInput = isRecord(value.customModelByProvider) ? value.customModelByProvider : {}

  const legacyModelInput = isRecord(value.modelByProvider) ? value.modelByProvider : {}

  const customModelEnabledByProvider = AGENT_PROVIDERS.reduce<AgentCustomModelEnabledByProvider>(
    (acc, provider) => {
      const normalizedEnabled = normalizeModelEnabled(enabledInput[provider])
      const legacyModel = normalizeModelValue(legacyModelInput[provider])

      acc[provider] = normalizedEnabled === null ? legacyModel.length > 0 : normalizedEnabled

      return acc
    },
    { ...DEFAULT_AGENT_SETTINGS.customModelEnabledByProvider },
  )

  const customModelByProvider = AGENT_PROVIDERS.reduce<AgentCustomModelByProvider>(
    (acc, provider) => {
      const current = customModelInput[provider] ?? legacyModelInput[provider]
      acc[provider] = normalizeModelValue(current)
      return acc
    },
    { ...DEFAULT_AGENT_SETTINGS.customModelByProvider },
  )

  return {
    defaultProvider,
    customModelEnabledByProvider,
    customModelByProvider,
  }
}
