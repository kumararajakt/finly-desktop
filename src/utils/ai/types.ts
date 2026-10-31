export type AIProvider = "ollama" | "gemini" | "openai" | "anthropic";

export interface AIProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  isLocal: boolean;
  defaultModel: string;
  recommendedModels: { id: string; label: string }[];
}

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;

  // Ollama (Local)
  ollamaEndpoint: string;
  ollamaModel: string;

  // Google Gemini
  geminiApiKey: string;
  geminiModel: string;

  // OpenAI
  openaiApiKey: string;
  openaiModel: string;

  // Anthropic Claude
  anthropicApiKey: string;
  anthropicModel: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AITestResult {
  success: boolean;
  message: string;
  availableModels?: string[];
  latencyMs?: number;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: "ollama",
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "llama3.2",
  geminiApiKey: "",
  geminiModel: "gemini-1.5-flash",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-haiku-20241022",
};

export const AI_PROVIDERS: AIProviderInfo[] = [
  {
    id: "ollama",
    name: "Local Ollama",
    description: "100% private & offline. Runs on your computer with zero external data transmission.",
    isLocal: true,
    defaultModel: "llama3.2",
    recommendedModels: [
      { id: "llama3.2", label: "Llama 3.2 (Fast & Lightweight)" },
      { id: "llama3.1", label: "Llama 3.1 8B (High Accuracy)" },
      { id: "mistral", label: "Mistral 7B (Great Reasoning)" },
      { id: "qwen2.5", label: "Qwen 2.5 (Ideal for Math & Finance)" },
      { id: "phi3", label: "Phi-3 (Very Fast)" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "High-speed multimodal AI with an accessible free tier via Google AI Studio.",
    isLocal: false,
    defaultModel: "gemini-1.5-flash",
    recommendedModels: [
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Fast & Recommended)" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Analysis)" },
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Next-Gen)" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Standard GPT-4o models via your OpenAI API key.",
    isLocal: false,
    defaultModel: "gpt-4o-mini",
    recommendedModels: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Affordable & Fast)" },
      { id: "gpt-4o", label: "GPT-4o (High Performance)" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Nuanced, high-precision financial reasoning via Claude API.",
    isLocal: false,
    defaultModel: "claude-3-5-haiku-20241022",
    recommendedModels: [
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast & Precise)" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Best Reasoning)" },
    ],
  },
];
