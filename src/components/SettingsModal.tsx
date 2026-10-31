import { Component, createSignal, For, Show, onMount } from "solid-js";
import {
  X,
  User,
  Globe,
  Check,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  CircleAlert,
} from "./icons";
import { COUNTRIES, getCurrencyByCountry } from "../utils/countries";
import { ThemeMode, UserProfile } from "../types/finance";
import { applyTheme } from "../utils/theme";
import {
  AIConfig,
  AI_PROVIDERS,
  DEFAULT_AI_CONFIG,
  AITestResult,
} from "../utils/ai/types";
import { getAIConfig, saveAIConfig } from "../utils/ai/storage";
import { testAIConnection, fetchOllamaModels, fetchGeminiModels } from "../utils/ai/client";

interface SettingsModalProps {
  currentProfile: UserProfile | null;
  currentTheme: ThemeMode;
  onClose: () => void;
  onSave: (profile: UserProfile, theme: ThemeMode) => void;
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<"general" | "ai">("general");

  // Profile & Theme State
  const [name, setName] = createSignal(props.currentProfile?.name || "");
  const [selectedCountry, setSelectedCountry] = createSignal(
    props.currentProfile?.country || "India"
  );
  const [customSymbol, setCustomSymbol] = createSignal(
    props.currentProfile?.currencySymbol || ""
  );
  const [selectedTheme, setSelectedTheme] = createSignal<ThemeMode>(
    props.currentTheme || "auto"
  );

  // AI Configuration State
  const [aiConfig, setAiConfig] = createSignal<AIConfig>(DEFAULT_AI_CONFIG);
  const [showApiKey, setShowApiKey] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<AITestResult | null>(null);
  const [isDetectingOllama, setIsDetectingOllama] = createSignal(false);
  const [detectedOllamaModels, setDetectedOllamaModels] = createSignal<string[]>([]);
  const [detectedGeminiModels, setDetectedGeminiModels] = createSignal<string[]>([]);

  onMount(async () => {
    try {
      const cfg = await getAIConfig();
      setAiConfig(cfg);
      if (cfg.provider === "ollama") {
        const models = await fetchOllamaModels(cfg.ollamaEndpoint);
        setDetectedOllamaModels(models);
      } else if (cfg.provider === "gemini" && cfg.geminiApiKey) {
        const geminiModels = await fetchGeminiModels(cfg.geminiApiKey);
        setDetectedGeminiModels(geminiModels);
      }
    } catch (err) {
      console.error("Failed to load AI config:", err);
    }
  });

  const detectedCurrency = () =>
    getCurrencyByCountry(selectedCountry()) || COUNTRIES[0];

  const activeSymbol = () =>
    customSymbol().trim() || detectedCurrency().symbol;

  const handleSelectTheme = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    applyTheme(mode); // Immediate live preview!
  };

  const handleClose = () => {
    applyTheme(props.currentTheme);
    props.onClose();
  };

  const updateAIField = <K extends keyof AIConfig>(field: K, val: AIConfig[K]) => {
    setAiConfig((prev) => ({ ...prev, [field]: val }));
    setTestResult(null);
  };

  const handleDetectOllama = async () => {
    setIsDetectingOllama(true);
    setTestResult(null);
    try {
      const models = await fetchOllamaModels(aiConfig().ollamaEndpoint);
      setDetectedOllamaModels(models);
      if (models.length > 0 && !models.includes(aiConfig().ollamaModel)) {
        updateAIField("ollamaModel", models[0]);
      }
    } finally {
      setIsDetectingOllama(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(aiConfig());
      setTestResult(res);
      if (res.availableModels && res.availableModels.length > 0) {
        if (aiConfig().provider === "ollama") {
          setDetectedOllamaModels(res.availableModels);
        } else if (aiConfig().provider === "gemini") {
          setDetectedGeminiModels(res.availableModels);
          if (!res.availableModels.includes(aiConfig().geminiModel)) {
            const first =
              res.availableModels.find((m) => m.includes("flash")) ||
              res.availableModels[0];
            updateAIField("geminiModel", first);
          }
        }
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    // 1. Save AI Config
    await saveAIConfig(aiConfig());

    // 2. Save Profile & Theme
    const curr = detectedCurrency();
    const updated: UserProfile = {
      name: name().trim() || "User",
      country: selectedCountry(),
      currencyCode: curr.currencyCode,
      currencySymbol: activeSymbol(),
      theme: selectedTheme(),
    };
    props.onSave(updated, selectedTheme());
    props.onClose();
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: "light", label: "Light", icon: Sun },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "auto", label: "System", icon: Monitor },
  ];

  const currentProviderInfo = () =>
    AI_PROVIDERS.find((p) => p.id === aiConfig().provider) || AI_PROVIDERS[0];

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div class="bg-card rounded-2xl border border-card-border shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-card-border px-6 py-4 bg-card">
          <div>
            <h2 class="text-base font-bold text-text-main">Settings</h2>
            <p class="text-xs text-text-muted mt-0.5">
              Personalize theme, profile, and AI configuration
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div class="flex items-center gap-1 px-6 pt-3 border-b border-card-border bg-card">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            class={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-px flex items-center gap-2 ${
              activeTab() === "general"
                ? "border-primary text-primary bg-primary-light/50"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <User class="w-3.5 h-3.5" />
            <span>General & Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            class={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-px flex items-center gap-2 ${
              activeTab() === "ai"
                ? "border-primary text-primary bg-primary-light/50"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>AI Assistant</span>
            <Show when={aiConfig().enabled}>
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </Show>
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} class="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ================= GENERAL TAB ================= */}
          <Show when={activeTab() === "general"}>
            {/* Theme Mode Selection */}
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
                Appearance & Theme
              </label>
              <div class="grid grid-cols-3 gap-2">
                <For each={themeOptions}>
                  {(opt) => {
                    const Icon = opt.icon;
                    const isSelected = () => selectedTheme() === opt.mode;
                    return (
                      <button
                        type="button"
                        onClick={() => handleSelectTheme(opt.mode)}
                        class={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected()
                            ? "border-primary bg-primary-light text-primary ring-1 ring-primary shadow-xs"
                            : "border-card-border bg-card text-text-muted hover:text-text-main hover:bg-card-subtle"
                        }`}
                      >
                        <Icon class="w-4 h-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* User Name */}
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Username
              </label>
              <div class="relative">
                <User class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter your name..."
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  class="w-full bg-card border border-card-border rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Country Selection */}
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Country
              </label>
              <div class="relative">
                <Globe class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedCountry()}
                  onChange={(e) => {
                    setSelectedCountry(e.currentTarget.value);
                    const matched = getCurrencyByCountry(e.currentTarget.value);
                    if (matched) {
                      setCustomSymbol(matched.symbol);
                    }
                  }}
                  class="w-full bg-card border border-card-border rounded-xl pl-10 pr-9 py-2 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none"
                >
                  <For each={COUNTRIES}>
                    {(c) => (
                      <option value={c.country} class="bg-card text-text-main">
                        {c.country} ({c.currencyCode} · {c.symbol})
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </div>

            {/* Detected Currency Card */}
            <div class="bg-primary-light border border-primary/20 rounded-xl p-3.5 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Check class="w-3.5 h-3.5" />
                  Detected Currency
                </span>
                <span class="text-xs font-bold text-primary bg-card px-2 py-0.5 rounded-md border border-primary/20 shadow-2xs">
                  {detectedCurrency().currencyCode} ({activeSymbol()})
                </span>
              </div>

              <div class="text-xs text-text-main flex items-center justify-between pt-1">
                <span class="text-text-muted">{detectedCurrency().currencyName}</span>
                <span class="font-mono font-semibold">
                  Sample: {activeSymbol()}2,450.00
                </span>
              </div>
            </div>
          </Show>

          {/* ================= AI ASSISTANT TAB ================= */}
          <Show when={activeTab() === "ai"}>
            {/* Enable AI Toggle */}
            <div class="flex items-center justify-between p-3.5 rounded-xl border border-card-border bg-card-subtle">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-lg bg-primary-light text-primary">
                  <Sparkles class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-xs font-bold text-text-main">Enable Finly AI Features</div>
                  <div class="text-[11px] text-text-muted">
                    Powers conversational financial advisor, auto-insights, and smart categorization
                  </div>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig().enabled}
                  onChange={(e) => updateAIField("enabled", e.currentTarget.checked)}
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-card border border-card-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Provider Selection */}
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
                Select AI Provider
              </label>
              <div class="grid grid-cols-2 gap-2">
                <For each={AI_PROVIDERS}>
                  {(prov) => {
                    const isSelected = () => aiConfig().provider === prov.id;
                    return (
                      <button
                        type="button"
                        onClick={() => updateAIField("provider", prov.id)}
                        class={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected()
                            ? "border-primary bg-primary-light text-primary ring-1 ring-primary shadow-xs"
                            : "border-card-border bg-card text-text-main hover:bg-card-subtle"
                        }`}
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold">{prov.name}</span>
                          <Show when={prov.isLocal}>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Local / 100% Private
                            </span>
                          </Show>
                        </div>
                        <p class="text-[10px] text-text-muted line-clamp-2">
                          {prov.description}
                        </p>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Provider Specific Configuration Card */}
            <div class="p-4 rounded-xl border border-card-border bg-card space-y-3.5">
              {/* Ollama Options */}
              <Show when={aiConfig().provider === "ollama"}>
                <div class="space-y-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-text-muted mb-1">
                      Ollama Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:11434"
                      value={aiConfig().ollamaEndpoint}
                      onInput={(e) => updateAIField("ollamaEndpoint", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-text-muted">
                        Installed / Selected Model
                      </label>
                      <button
                        type="button"
                        onClick={handleDetectOllama}
                        disabled={isDetectingOllama()}
                        class="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw class={`w-3 h-3 ${isDetectingOllama() ? "animate-spin" : ""}`} />
                        <span>Detect Models</span>
                      </button>
                    </div>

                    <Show
                      when={detectedOllamaModels().length > 0}
                      fallback={
                        <input
                          type="text"
                          placeholder="llama3.2, mistral, qwen2.5..."
                          value={aiConfig().ollamaModel}
                          onInput={(e) => updateAIField("ollamaModel", e.currentTarget.value)}
                          class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      }
                    >
                      <select
                        value={aiConfig().ollamaModel}
                        onChange={(e) => updateAIField("ollamaModel", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <For each={detectedOllamaModels()}>
                          {(m) => <option value={m}>{m}</option>}
                        </For>
                      </select>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Google Gemini Options */}
              <Show when={aiConfig().provider === "gemini"}>
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-text-muted">
                        Google Gemini API Key
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        class="text-[10px] text-primary hover:underline"
                      >
                        Get Free Key &rarr;
                      </a>
                    </div>
                    <div class="relative">
                      <input
                        type={showApiKey() ? "text" : "password"}
                        placeholder="AIzaSy..."
                        value={aiConfig().geminiApiKey}
                        onInput={(e) => updateAIField("geminiApiKey", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-xl pl-3 pr-9 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey())}
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-main p-1 cursor-pointer"
                      >
                        <Show when={showApiKey()} fallback={<Eye class="w-3.5 h-3.5" />}>
                          <EyeOff class="w-3.5 h-3.5" />
                        </Show>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-text-muted">
                        Gemini Model
                      </label>
                      <Show when={detectedGeminiModels().length > 0}>
                        <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {detectedGeminiModels().length} available models discovered
                        </span>
                      </Show>
                    </div>
                    <select
                      value={aiConfig().geminiModel}
                      onChange={(e) => updateAIField("geminiModel", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <Show
                        when={detectedGeminiModels().length > 0}
                        fallback={
                          <For each={currentProviderInfo().recommendedModels}>
                            {(m) => <option value={m.id}>{m.label}</option>}
                          </For>
                        }
                      >
                        <For each={detectedGeminiModels()}>
                          {(m) => <option value={m}>{m}</option>}
                        </For>
                      </Show>
                    </select>
                  </div>
                </div>
              </Show>

              {/* OpenAI Options */}
              <Show when={aiConfig().provider === "openai"}>
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-text-muted">
                        OpenAI API Key
                      </label>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        class="text-[10px] text-primary hover:underline"
                      >
                        OpenAI Dashboard &rarr;
                      </a>
                    </div>
                    <div class="relative">
                      <input
                        type={showApiKey() ? "text" : "password"}
                        placeholder="sk-proj-..."
                        value={aiConfig().openaiApiKey}
                        onInput={(e) => updateAIField("openaiApiKey", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-xl pl-3 pr-9 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey())}
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-main p-1 cursor-pointer"
                      >
                        <Show when={showApiKey()} fallback={<Eye class="w-3.5 h-3.5" />}>
                          <EyeOff class="w-3.5 h-3.5" />
                        </Show>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-text-muted mb-1">
                      OpenAI Model
                    </label>
                    <select
                      value={aiConfig().openaiModel}
                      onChange={(e) => updateAIField("openaiModel", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <For each={currentProviderInfo().recommendedModels}>
                        {(m) => <option value={m.id}>{m.label}</option>}
                      </For>
                    </select>
                  </div>
                </div>
              </Show>

              {/* Anthropic Claude Options */}
              <Show when={aiConfig().provider === "anthropic"}>
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-text-muted">
                        Anthropic API Key
                      </label>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        class="text-[10px] text-primary hover:underline"
                      >
                        Anthropic Console &rarr;
                      </a>
                    </div>
                    <div class="relative">
                      <input
                        type={showApiKey() ? "text" : "password"}
                        placeholder="sk-ant-..."
                        value={aiConfig().anthropicApiKey}
                        onInput={(e) => updateAIField("anthropicApiKey", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-xl pl-3 pr-9 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey())}
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-main p-1 cursor-pointer"
                      >
                        <Show when={showApiKey()} fallback={<Eye class="w-3.5 h-3.5" />}>
                          <EyeOff class="w-3.5 h-3.5" />
                        </Show>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-text-muted mb-1">
                      Claude Model
                    </label>
                    <select
                      value={aiConfig().anthropicModel}
                      onChange={(e) => updateAIField("anthropicModel", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <For each={currentProviderInfo().recommendedModels}>
                        {(m) => <option value={m.id}>{m.label}</option>}
                      </For>
                    </select>
                  </div>
                </div>
              </Show>

              {/* Test Connection Button & Result Banner */}
              <div class="pt-2 border-t border-card-border flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting()}
                  class="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border text-xs font-semibold text-text-main hover:bg-card-subtle transition cursor-pointer disabled:opacity-50"
                >
                  <Show when={isTesting()} fallback={<RefreshCw class="w-3 h-3 text-primary" />}>
                    <Loader2 class="w-3 h-3 animate-spin text-primary" />
                  </Show>
                  <span>{isTesting() ? "Testing Connection..." : "Test Connection"}</span>
                </button>

                <Show when={testResult()}>
                  <div
                    class={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
                      testResult()!.success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    <Show
                      when={testResult()!.success}
                      fallback={<CircleAlert class="w-4 h-4 shrink-0 mt-0.5" />}
                    >
                      <Check class="w-4 h-4 shrink-0 mt-0.5" />
                    </Show>
                    <div>
                      <div class="font-medium">{testResult()!.message}</div>
                      <Show when={testResult()!.latencyMs !== undefined}>
                        <div class="text-[10px] opacity-80 mt-0.5">
                          Response time: {testResult()!.latencyMs}ms
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Action Buttons */}
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border">
            <button
              type="button"
              onClick={handleClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-active text-white transition shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
