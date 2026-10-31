import { AIConfig, AIMessage, AITestResult } from "./types";

/**
 * Sends a chat completion request to the active AI provider.
 */
export async function sendAIChatRequest(
  messages: AIMessage[],
  config: AIConfig
): Promise<string> {
  if (!config.enabled) {
    throw new Error("AI features are disabled in Finly settings.");
  }

  switch (config.provider) {
    case "ollama":
      return callOllama(messages, config);
    case "gemini":
      return callGemini(messages, config);
    case "openai":
      return callOpenAI(messages, config);
    case "anthropic":
      return callAnthropic(messages, config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Verifies connectivity to the configured AI provider.
 */
export async function testAIConnection(config: AIConfig): Promise<AITestResult> {
  const start = performance.now();

  try {
    switch (config.provider) {
      case "ollama": {
        const endpoint = (config.ollamaEndpoint || "http://localhost:11434").replace(/\/$/, "");
        const res = await fetch(`${endpoint}/api/tags`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          throw new Error(`Ollama returned HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const models: string[] = Array.isArray(data.models)
          ? data.models.map((m: any) => m.name.replace(/:latest$/, ""))
          : [];

        const latencyMs = Math.round(performance.now() - start);

        if (models.length === 0) {
          return {
            success: true,
            latencyMs,
            message: "Connected to Ollama! (No models installed yet. Run 'ollama pull llama3.2')",
            availableModels: [],
          };
        }

        return {
          success: true,
          latencyMs,
          message: `Connected to Ollama! Found ${models.length} installed model(s).`,
          availableModels: models,
        };
      }

      case "gemini": {
        const apiKey = config.geminiApiKey?.trim();
        if (!apiKey) throw new Error("Google Gemini API key is missing");

        // 1. Discover models supported by this specific key
        const availableModels = await fetchGeminiModels(apiKey);

        // 2. Select target model, substituting if configured model is not available
        let targetModel = config.geminiModel || "gemini-1.5-flash";
        if (availableModels.length > 0 && !availableModels.includes(targetModel)) {
          const substitute = availableModels.find((m) => m.includes("flash")) || availableModels[0];
          targetModel = substitute;
        }

        // 3. Test generateContent with candidate models across v1beta and v1
        let success = false;
        let lastError = "";

        const candidateModels = [targetModel];
        if (!targetModel.endsWith("-latest")) candidateModels.push(`${targetModel}-latest`);
        if (!candidateModels.includes("gemini-1.5-flash-latest")) candidateModels.push("gemini-1.5-flash-latest");
        if (!candidateModels.includes("gemini-1.5-flash")) candidateModels.push("gemini-1.5-flash");

        for (const m of candidateModels) {
          for (const v of ["v1beta", "v1"]) {
            try {
              const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`;
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: "Respond with the single word 'Connected'." }] }],
                }),
                signal: AbortSignal.timeout(10000),
              });

              if (res.ok) {
                success = true;
                targetModel = m;
                break;
              } else {
                const errData = await res.json().catch(() => null);
                lastError = errData?.error?.message || `HTTP ${res.status} (${res.statusText})`;
              }
            } catch (err: any) {
              lastError = err.message || "Network error";
            }
          }
          if (success) break;
        }

        if (!success) {
          throw new Error(`Gemini API Error: ${lastError}`);
        }

        const latencyMs = Math.round(performance.now() - start);
        return {
          success: true,
          latencyMs,
          message: `Successfully connected to Gemini (${targetModel})!`,
          availableModels: availableModels.length > 0 ? availableModels : undefined,
        };
      }

      case "openai": {
        const apiKey = config.openaiApiKey?.trim();
        if (!apiKey) throw new Error("OpenAI API key is missing");

        const model = config.openaiModel || "gpt-4o-mini";
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Respond with 'Connected'." }],
            max_tokens: 10,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const msg = errData?.error?.message || `HTTP ${res.status} (${res.statusText})`;
          throw new Error(`OpenAI Error: ${msg}`);
        }

        const latencyMs = Math.round(performance.now() - start);
        return {
          success: true,
          latencyMs,
          message: `Successfully connected to OpenAI (${model})!`,
        };
      }

      case "anthropic": {
        const apiKey = config.anthropicApiKey?.trim();
        if (!apiKey) throw new Error("Anthropic API key is missing");

        const model = config.anthropicModel || "claude-3-5-haiku-20241022";
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: "user", content: "Respond with 'Connected'." }],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const msg = errData?.error?.message || `HTTP ${res.status} (${res.statusText})`;
          throw new Error(`Anthropic Error: ${msg}`);
        }

        const latencyMs = Math.round(performance.now() - start);
        return {
          success: true,
          latencyMs,
          message: `Successfully connected to Claude (${model})!`,
        };
      }

      default:
        return { success: false, message: "Unknown provider" };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    let errMsg = err.message || "Failed to connect";
    if (err.name === "TimeoutError") {
      errMsg = "Connection timed out. Check network or server status.";
    } else if (config.provider === "ollama" && (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError"))) {
      errMsg = "Could not connect to Ollama at " + (config.ollamaEndpoint || "http://localhost:11434") + ". Make sure Ollama is installed and running (`ollama serve`).";
    }
    return {
      success: false,
      latencyMs,
      message: errMsg,
    };
  }
}

/**
 * Fetch list of installed models from local Ollama instance
 */
export async function fetchOllamaModels(endpointUrl?: string): Promise<string[]> {
  try {
    const endpoint = (endpointUrl || "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${endpoint}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name.replace(/:latest$/, ""));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetch list of models that support generateContent for a Google Gemini API key
 */
export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return [];

  for (const v of ["v1beta", "v1"]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${v}/models?key=${trimmedKey}`,
        { method: "GET", signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          const list = data.models
            .filter((m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
            )
            .map((m: any) => m.name.replace(/^models\//, ""));
          if (list.length > 0) return list;
        }
      }
    } catch {
      // try next
    }
  }
  return [];
}

/* ================= Internal Provider Implementations ================= */

async function callOllama(messages: AIMessage[], config: AIConfig): Promise<string> {
  const endpoint = (config.ollamaEndpoint || "http://localhost:11434").replace(/\/$/, "");
  const model = config.ollamaModel || "llama3.2";

  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama Error (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.message?.content || "";
}

async function callGemini(messages: AIMessage[], config: AIConfig): Promise<string> {
  const apiKey = config.geminiApiKey?.trim();
  if (!apiKey) throw new Error("Gemini API key is required");

  const model = config.geminiModel || "gemini-1.5-flash";

  // Separate system message if present
  const systemMsg = messages.find((m) => m.role === "system");
  const conversationMsgs = messages.filter((m) => m.role !== "system");

  const contents = conversationMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const payload: any = { contents };
  if (systemMsg) {
    payload.systemInstruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  const candidateModels = [model];
  if (!model.endsWith("-latest")) candidateModels.push(`${model}-latest`);
  if (!candidateModels.includes("gemini-1.5-flash-latest")) candidateModels.push("gemini-1.5-flash-latest");
  if (!candidateModels.includes("gemini-1.5-flash")) candidateModels.push("gemini-1.5-flash");

  let lastErr = "";
  for (const m of candidateModels) {
    for (const v of ["v1beta", "v1"]) {
      const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          const errData = await res.json().catch(() => null);
          lastErr = errData?.error?.message || `HTTP ${res.status}`;
          if (res.status === 404) continue;
          throw new Error(lastErr);
        }
      } catch (err: any) {
        if (!err.message?.includes("not found")) {
          throw err;
        }
      }
    }
  }

  throw new Error(`Gemini Error: ${lastErr || "Failed to reach Gemini model"}`);
}

async function callOpenAI(messages: AIMessage[], config: AIConfig): Promise<string> {
  const apiKey = config.openaiApiKey?.trim();
  if (!apiKey) throw new Error("OpenAI API key is required");

  const model = config.openaiModel || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error?.message || `OpenAI Error (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(messages: AIMessage[], config: AIConfig): Promise<string> {
  const apiKey = config.anthropicApiKey?.trim();
  if (!apiKey) throw new Error("Anthropic API key is required");

  const model = config.anthropicModel || "claude-3-5-haiku-20241022";
  const systemMsg = messages.find((m) => m.role === "system");
  const conversationMsgs = messages.filter((m) => m.role !== "system");

  const payload: any = {
    model,
    max_tokens: 2048,
    messages: conversationMsgs.map((m) => ({ role: m.role, content: m.content })),
  };

  if (systemMsg) {
    payload.system = systemMsg.content;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error?.message || `Anthropic Error (HTTP ${res.status})`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }
  return text;
}
