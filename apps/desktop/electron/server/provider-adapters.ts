export interface ProviderTestResult {
  success: boolean;
  availableModels?: string[];
  errorMessage?: string;
}

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ModelProviderAdapter {
  readonly provider: "gemini" | "openai" | "anthropic";
  testConnection(apiKey: string): Promise<ProviderTestResult>;
  generateChatResponse(
    apiKey: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>;
}

// ==========================================
// GOOGLE GEMINI ADAPTER
// ==========================================
export class GeminiAdapter implements ModelProviderAdapter {
  public readonly provider = "gemini" as const;
  private readonly baseUrl: string;

  constructor(baseUrl = "https://generativelanguage.googleapis.com") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async testConnection(apiKey: string): Promise<ProviderTestResult> {
    if (!apiKey || apiKey.trim().length < 8) {
      return {
        success: false,
        errorMessage: "API key is missing or too short",
      };
    }

    try {
      const url = `${this.baseUrl}/v1beta/models`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey.trim(),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 400 || res.status === 403) {
          return {
            success: false,
            errorMessage: `Invalid Gemini API Key: ${msg}`,
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            errorMessage: `Gemini quota exceeded: ${msg}`,
          };
        }
        return {
          success: false,
          errorMessage: `Gemini verification failed: ${msg}`,
        };
      }

      const data = await res.json().catch(() => ({}));
      const modelsList = Array.isArray(data?.models)
        ? data.models
            .map((m: any) => m.name?.replace(/^models\//, ""))
            .filter((name: string) => name && name.includes("gemini"))
        : [];

      return {
        success: true,
        availableModels:
          modelsList.length > 0
            ? modelsList
            : ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err.name === "AbortError"
            ? "Verification timed out"
            : `Network error: ${err.message}`,
      };
    }
  }

  public async generateChatResponse(
    apiKey: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const model = req.model || "gemini-2.5-flash";
    const cleanModel = model.replace(/^models\//, "");
    const url = `${this.baseUrl}/v1beta/models/${cleanModel}:generateContent`;

    // Map conversation contents
    const contents: any[] = [];
    for (const msg of req.messages) {
      if (msg.role === "system") continue; // passed in systemInstruction
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const payload: any = { contents };
    if (req.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: req.systemPrompt }],
      };
    }
    if (typeof req.temperature === "number") {
      payload.generationConfig = { temperature: req.temperature };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg =
        errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      if (res.status === 400 || res.status === 403) {
        throw new Error(`Gemini authentication error: ${msg}`);
      }
      if (res.status === 429) {
        throw new Error(`Gemini quota or rate limit exceeded: ${msg}`);
      }
      throw new Error(`Gemini API error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text && candidate?.finishReason) {
      throw new Error(
        `Gemini generation stopped early: ${candidate.finishReason}`,
      );
    }

    return {
      content: text || "I didn't receive a textual response from Gemini.",
      model: cleanModel,
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount,
        completionTokens: data?.usageMetadata?.candidatesTokenCount,
        totalTokens: data?.usageMetadata?.totalTokenCount,
      },
    };
  }
}

// ==========================================
// OPENAI ADAPTER
// ==========================================
export class OpenAIAdapter implements ModelProviderAdapter {
  public readonly provider = "openai" as const;
  private readonly baseUrl: string;

  constructor(baseUrl = "https://api.openai.com") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async testConnection(apiKey: string): Promise<ProviderTestResult> {
    if (!apiKey || apiKey.trim().length < 8) {
      return {
        success: false,
        errorMessage: "API key is missing or too short",
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 401) {
          return {
            success: false,
            errorMessage: `Invalid OpenAI API Key: ${msg}`,
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            errorMessage: `OpenAI quota or rate limit exceeded: ${msg}`,
          };
        }
        return {
          success: false,
          errorMessage: `OpenAI verification failed: ${msg}`,
        };
      }

      const data = await res.json().catch(() => ({}));
      const modelsList = Array.isArray(data?.data)
        ? data.data
            .map((m: any) => m.id)
            .filter(
              (id: string) =>
                id &&
                (id.startsWith("gpt-") ||
                  id.startsWith("o1") ||
                  id.startsWith("o3")),
            )
        : [];

      return {
        success: true,
        availableModels:
          modelsList.length > 0
            ? modelsList.slice(0, 8)
            : ["gpt-4o", "gpt-4o-mini"],
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err.name === "AbortError"
            ? "Verification timed out"
            : `Network error: ${err.message}`,
      };
    }
  }

  public async generateChatResponse(
    apiKey: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const model = req.model || "gpt-4o";
    const messages: any[] = [];

    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    for (const msg of req.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const payload: any = {
      model,
      messages,
      temperature: typeof req.temperature === "number" ? req.temperature : 0.7,
    };
    if (typeof req.maxTokens === "number") {
      payload.max_tokens = req.maxTokens;
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg =
        errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      if (res.status === 401) {
        throw new Error(`OpenAI authentication error: ${msg}`);
      }
      if (res.status === 429) {
        throw new Error(`OpenAI quota or rate limit exceeded: ${msg}`);
      }
      throw new Error(`OpenAI API error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return {
      content,
      model,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
    };
  }
}

// ==========================================
// ANTHROPIC CLAUDE ADAPTER
// ==========================================
export class AnthropicAdapter implements ModelProviderAdapter {
  public readonly provider = "anthropic" as const;
  private readonly baseUrl: string;

  constructor(baseUrl = "https://api.anthropic.com") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async testConnection(apiKey: string): Promise<ProviderTestResult> {
    if (!apiKey || apiKey.trim().length < 8) {
      return {
        success: false,
        errorMessage: "API key is missing or too short",
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 401) {
          return {
            success: false,
            errorMessage: `Invalid Anthropic API Key: ${msg}`,
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            errorMessage: `Anthropic rate limit exceeded: ${msg}`,
          };
        }
        return {
          success: false,
          errorMessage: `Anthropic verification failed: ${msg}`,
        };
      }

      const data = await res.json().catch(() => ({}));
      const modelsList = Array.isArray(data?.data)
        ? data.data
            .map((m: any) => m.id)
            .filter((id: string) => id && id.includes("claude"))
        : [];

      return {
        success: true,
        availableModels:
          modelsList.length > 0
            ? modelsList.slice(0, 6)
            : ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err.name === "AbortError"
            ? "Verification timed out"
            : `Network error: ${err.message}`,
      };
    }
  }

  public async generateChatResponse(
    apiKey: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const model = req.model || "claude-3-5-sonnet-20241022";
    const messages: any[] = [];

    for (const msg of req.messages) {
      if (msg.role === "system") continue;
      messages.push({ role: msg.role, content: msg.content });
    }

    const payload: any = {
      model,
      messages,
      max_tokens: req.maxTokens || 4096,
    };
    if (req.systemPrompt) {
      payload.system = req.systemPrompt;
    }
    if (typeof req.temperature === "number") {
      payload.temperature = req.temperature;
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg =
        errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      if (res.status === 401) {
        throw new Error(`Anthropic authentication error: ${msg}`);
      }
      if (res.status === 429) {
        throw new Error(`Anthropic rate limit exceeded: ${msg}`);
      }
      throw new Error(`Anthropic API error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    let text = "";
    if (Array.isArray(data?.content)) {
      text = data.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }

    return {
      content: text || "Received empty completion from Claude.",
      model,
      usage: {
        promptTokens: data?.usage?.input_tokens,
        completionTokens: data?.usage?.output_tokens,
        totalTokens:
          (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
      },
    };
  }
}

// ==========================================
// ADAPTER REGISTRY / ROUTER
// ==========================================
export class ModelProviderRouter {
  private adapters: Map<string, ModelProviderAdapter> = new Map();

  constructor(adapters?: ModelProviderAdapter[]) {
    if (adapters) {
      for (const a of adapters) {
        this.adapters.set(a.provider, a);
      }
    } else {
      this.adapters.set("gemini", new GeminiAdapter());
      this.adapters.set("openai", new OpenAIAdapter());
      this.adapters.set("anthropic", new AnthropicAdapter());
    }
  }

  public getAdapter(
    provider: "gemini" | "openai" | "anthropic" | string,
  ): ModelProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unsupported model provider: "${provider}"`);
    }
    return adapter;
  }

  public registerAdapter(adapter: ModelProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }
}

export const defaultProviderRouter = new ModelProviderRouter();
