export enum AIMode {
  STANDARD = "standard",
  CREATIVE = "creative", 
}

export enum SubscriptionTier {
  FREE = "free",
  PRO = "pro",
}

// export generation types
export type GenerationType = 'topic' | 'brainstorm' | 'research' | 'custom';

export interface GenerationResult {
  title: string;
  content: string;
  tags: string[];
}

export interface GenerationRequest {
  prompt: string;
  type: GenerationType;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  [key: string]: any; // Allow provider-specific options
}

export interface AIProviderCapabilities {
  name: string;
  version: string;
  supportedTypes: GenerationType[];
  maxTokens: number;
  hasStreamingSupport: boolean;
  supportedLanguages: string[];
  requiresApiKey: boolean;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultOptions?: GenerationOptions;
  enabled: boolean;
  [key: string]: any; // Allow provider-specific config
}

export interface AIProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  tokensUsed: number;
}

export abstract class AIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: AIProviderCapabilities;
  
  protected config: AIProviderConfig;
  protected metrics: AIProviderMetrics;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastUsed: new Date(),
      tokensUsed: 0
    };
  }

  abstract isAvailable(): Promise<boolean>;
  abstract generateContent(request: GenerationRequest): Promise<GenerationResult>;
  abstract validateConfig(config: AIProviderConfig): boolean;

  // Optional methods that providers can override
  async initialize(): Promise<void> {
    // Default implementation - no-op
  }

  async cleanup(): Promise<void> {
    // Default implementation - no-op
  }

  getMetrics(): AIProviderMetrics {
    return { ...this.metrics };
  }

  updateConfig(newConfig: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  protected updateMetrics(startTime: number, success: boolean, tokensUsed: number = 0): void {
    const responseTime = Date.now() - startTime;
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    this.metrics.lastUsed = new Date();
    this.metrics.tokensUsed += tokensUsed;
  }
}

export interface AIProviderRegistry {
  register(provider: AIProvider): void;
  unregister(providerId: string): void;
  getProvider(providerId: string): AIProvider | null;
  getAvailableProviders(): AIProvider[];
  getEnabledProviders(): AIProvider[];
  setProviderEnabled(providerId: string, enabled: boolean): void;
  getHealthyProviders(): Promise<AIProvider[]>;
  getProviderMetrics(): Record<string, any>;
}

export interface AIServiceConfig {
  primaryProvider?: string;
  fallbackProviders?: string[];
  retryAttempts: number;
  timeout: number;
  loadBalancing: 'round-robin' | 'random' | 'performance' | 'least-used';
}

export type AIProviderFactory = (config: AIProviderConfig) => AIProvider;

export interface AIConfig {
  mode: AIMode;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt?: string;
  features: string[];
}

export const AI_MODE_CONFIG: Record<AIMode, AIConfig> = {
  [AIMode.STANDARD]: {
    mode: AIMode.STANDARD,
    temperature: 0.3,
    maxTokens: 1000,
    model: "gemini-2.5-flash"
  },
  [AIMode.CREATIVE]: {
    mode: AIMode.CREATIVE,
    temperature: 0.8,
    maxTokens: 4000,
    model: "gemini-2.5-flash"
  }
};

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, string[]> = {
  [SubscriptionTier.FREE]: [
    AIMode.STANDARD
  ],
  [SubscriptionTier.PRO]: [
    AIMode.STANDARD,
    AIMode.CREATIVE
  ]
};

export function canUseAIMode(userTier: SubscriptionTier, mode: AIMode): boolean {
  return SUBSCRIPTION_FEATURES[userTier].includes(mode);
}

export function getAIModeDisplayName(mode: AIMode): string {
  switch (mode) {
    case AIMode.STANDARD:
      return "Standard";
    case AIMode.CREATIVE:
      return "Creative";
    default:
      return "Standard";
  }
}

export function getAIModeDescription(mode: AIMode): string {
  switch (mode) {
    case AIMode.STANDARD:
      return "Balanced AI responses for everyday use";
    case AIMode.CREATIVE:
      return "Advanced AI for creative and research tasks";
    default:
      return "Balanced AI responses for everyday use";
  }
}