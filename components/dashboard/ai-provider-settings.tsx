"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Bot, Eye, EyeOff, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type AIProvider = "openai" | "openrouter" | "groq" | "together" | "ollama" | "custom";

interface ProviderDefaults {
  endpoint: string;
  models: string[];
}

interface Settings {
  id: string;
  provider: AIProvider;
  apiEndpoint: string;
  hasApiKey: boolean;
  model: string;
  isEnabled: boolean;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  groq: "Groq",
  together: "Together AI",
  ollama: "Ollama (Local)",
  custom: "Custom Provider",
};

const PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
  openai: "Official OpenAI API with GPT-4o models",
  openrouter: "Access 100+ models including free tiers",
  groq: "Ultra-fast inference at competitive prices",
  together: "Open-source models with great pricing",
  ollama: "Run models locally on your machine",
  custom: "Any OpenAI-compatible API endpoint",
};

export function AIProviderSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Record<AIProvider, ProviderDefaults> | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasModifiedKey, setHasModifiedKey] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-provider");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setSettings(data.settings);
      setDefaults(data.defaults);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load AI provider settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider: settings.provider,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model,
        isEnabled: settings.isEnabled,
      };

      // Only include API key if it was modified
      if (hasModifiedKey && apiKeyInput) {
        body.apiKey = apiKeyInput;
      }

      const response = await fetch("/api/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      const data = await response.json();
      setSettings(data.settings);
      setHasModifiedKey(false);
      setApiKeyInput("");

      toast({
        title: "Settings saved",
        description: "AI provider configuration has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    if (!settings || !defaults) return;

    const defaultConfig = defaults[provider];
    setSettings({
      ...settings,
      provider,
      apiEndpoint: defaultConfig.endpoint,
      model: defaultConfig.models[0] || "",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!settings || !defaults) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Failed to load settings.</p>
        </CardContent>
      </Card>
    );
  }

  const availableModels = defaults[settings.provider]?.models || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          AI Provider Settings
        </CardTitle>
        <CardDescription>
          Configure your AI provider for receipt scanning and other AI-powered features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Enable AI Features</Label>
            <p className="text-sm text-muted-foreground">
              Turn on to use AI-powered receipt scanning
            </p>
          </div>
          <Switch
            aria-label="Enable AI features"
            checked={settings.isEnabled}
            onCheckedChange={(checked: boolean) =>
              setSettings({ ...settings, isEnabled: checked })
            }
          />
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(value) => handleProviderChange(value as AIProvider)}
          >
            <SelectTrigger id="provider" aria-label="AI provider">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((provider) => (
                <SelectItem key={provider} value={provider}>
                  <div className="flex flex-col items-start">
                    <span>{PROVIDER_LABELS[provider]}</span>
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_DESCRIPTIONS[provider]}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <Label htmlFor="endpoint">API Endpoint</Label>
          <Input
            id="endpoint"
            value={settings.apiEndpoint}
            onChange={(e) =>
              setSettings({ ...settings, apiEndpoint: e.target.value })
            }
            placeholder="https://api.example.com/v1"
          />
          <p className="text-xs text-muted-foreground">
            The base URL for your AI provider&apos;s API
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              value={hasModifiedKey ? apiKeyInput : settings.hasApiKey ? "••••••••••••••••" : ""}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setHasModifiedKey(true);
              }}
              placeholder={settings.hasApiKey ? "••••••••••••••••" : "Enter your API key"}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {settings.hasApiKey && !hasModifiedKey
              ? "API key is saved. Enter a new one to replace it."
              : "Your API key is encrypted and stored securely."}
          </p>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          {availableModels.length > 0 ? (
            <Select
              value={settings.model}
              onValueChange={(value) => setSettings({ ...settings, model: value })}
            >
              <SelectTrigger id="model" aria-label="Model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="model"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              placeholder="Enter model name (e.g., gpt-4o)"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Choose a model that supports vision for receipt scanning
          </p>
        </div>

        {/* Provider-specific hints */}
        {settings.provider === "openrouter" && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" />
              Free models available on OpenRouter
            </p>
            <p className="mt-1 text-muted-foreground">
              Try <code className="rounded bg-background px-1">google/gemma-3-27b-it</code> or{" "}
              <code className="rounded bg-background px-1">meta-llama/llama-3.2-11b-vision-instruct</code> for free vision capabilities.
            </p>
          </div>
        )}

        {settings.provider === "ollama" && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">Local AI Setup</p>
            <p className="mt-1 text-muted-foreground">
              Make sure Ollama is running locally. Install vision models with:{" "}
              <code className="rounded bg-background px-1">ollama pull llava</code>
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
