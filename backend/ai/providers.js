// The AI providers users can connect with their own key.
// `adapter` picks the client implementation in ./adapters.
// Suggested models are only defaults for the model picker; users can choose any model
// their key can access, and the picker also lists models live from the provider.

const PROVIDERS = {
    anthropic: {
        id: "anthropic",
        label: "Anthropic (Claude)",
        adapter: "anthropic",
        keyRequired: true,
        keyPlaceholder: "sk-ant-...",
        keyUrl: "https://console.anthropic.com/settings/keys",
        baseUrl: null, // fixed: the official Claude API
        baseUrlEditable: false,
        defaultModels: { writer: "claude-opus-5-5", critic: "claude-sonnet-5-5" },
        suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
        supportsEmbeddings: false,
    },
    openai: {
        id: "openai",
        label: "OpenAI",
        adapter: "openai",
        keyRequired: true,
        keyPlaceholder: "sk-...",
        keyUrl: "https://platform.openai.com/api-keys",
        baseUrl: "https://api.openai.com/v1",
        baseUrlEditable: false,
        defaultModels: { writer: "", critic: "" },
        suggestedModels: [],
        supportsEmbeddings: true,
    },
    gemini: {
        id: "gemini",
        label: "Google Gemini",
        adapter: "gemini",
        keyRequired: true,
        keyPlaceholder: "AIza...",
        keyUrl: "https://aistudio.google.com/apikey",
        baseUrl: null, // fixed: the Gemini API
        baseUrlEditable: false,
        defaultModels: { writer: "gemini-2.5-pro", critic: "gemini-2.5-flash" },
        suggestedModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
        supportsEmbeddings: true,
    },
    openrouter: {
        id: "openrouter",
        label: "OpenRouter",
        adapter: "openai",
        keyRequired: true,
        keyPlaceholder: "sk-or-...",
        keyUrl: "https://openrouter.ai/keys",
        baseUrl: "https://openrouter.ai/api/v1",
        baseUrlEditable: false,
        defaultModels: { writer: "", critic: "" },
        suggestedModels: [],
        supportsEmbeddings: false,
    },
    ollama: {
        id: "ollama",
        label: "Ollama (self-hosted)",
        adapter: "openai",
        keyRequired: false,
        keyPlaceholder: "Optional",
        keyUrl: null,
        baseUrl: "http://localhost:11434/v1",
        baseUrlEditable: true,
        defaultModels: { writer: "", critic: "" },
        suggestedModels: [],
        supportsEmbeddings: true,
    },
    custom: {
        id: "custom",
        label: "OpenAI-compatible endpoint",
        adapter: "openai",
        keyRequired: false,
        keyPlaceholder: "Optional",
        keyUrl: null,
        baseUrl: "",
        baseUrlEditable: true,
        defaultModels: { writer: "", critic: "" },
        suggestedModels: [],
        supportsEmbeddings: false,
    },
};

function getProvider(id) {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, id) ? PROVIDERS[id] : null;
}

// The catalog as sent to the browser.
function listProviders() {
    return Object.values(PROVIDERS).map(({ adapter, ...publicFields }) => publicFields);
}

module.exports = { PROVIDERS, getProvider, listProviders };
