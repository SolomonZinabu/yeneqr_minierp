'use client';

// ============================================================
// Yene QR — AI Configuration Panel (Settings tab)
// ============================================================
// Restaurant owners configure their own AI provider + API key.
// YeneQR does NOT pay for AI — each restaurant brings their own key.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Sparkles, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface AIConfig {
  aiProvider: string;
  aiModel: string | null;
  aiBaseUrl: string | null;
  aiEnabled: boolean;
  aiTranslationEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  aiChatEnabled: boolean;
  aiUpsellEnabled: boolean;
  hasApiKey: boolean;
}

const PROVIDER_INFO: Record<string, { label: string; description: string; models: string[]; signupUrl?: string; free?: boolean }> = {
  none: { label: 'Disabled', description: 'AI features are off. No API key needed.', models: [] },
  gemini: {
    label: 'Google Gemini (FREE)',
    description: 'Free tier: 15 requests/min, 1,500/day. No credit card needed.',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    signupUrl: 'https://aistudio.google.com/app/apikey',
    free: true,
  },
  openai: {
    label: 'OpenAI',
    description: 'Paid. gpt-4o-mini ~$0.15/1M tokens (~$0.02 per full menu translation).',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic Claude',
    description: 'Paid. claude-3-haiku is the most affordable option.',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    signupUrl: 'https://console.anthropic.com/',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    description: 'Any API that supports OpenAI chat completions format. Provide base URL.',
    models: [],
  },
};

const FEATURES = [
  { key: 'aiTranslationEnabled', label: 'Menu Translation', description: 'AI translates menu items into your enabled languages' },
  { key: 'aiSuggestionsEnabled', label: 'Dashboard Suggestions', description: 'AI suggests actions based on your restaurant data' },
  { key: 'aiChatEnabled', label: 'AI Chat Assistant', description: 'AI chat for owners, kitchen, waiters, and customers' },
  { key: 'aiUpsellEnabled', label: 'AI Upsell Recommendations', description: 'AI suggests add-ons and cross-sells to customers' },
] as const;

export function AIConfigPanel({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AIConfig }>(`/api/restaurants/${restaurantId}/ai-config`);
      setConfig(res.data);
      setModel(res.data.aiModel || '');
      setBaseUrl(res.data.aiBaseUrl || '');
    } catch {
      toast.error('Failed to load AI config');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/ai-config`, {
        aiProvider: config.aiProvider,
        aiApiKey: apiKey || undefined,
        aiModel: model || null,
        aiBaseUrl: baseUrl || null,
        aiEnabled: config.aiEnabled,
        aiTranslationEnabled: config.aiTranslationEnabled,
        aiSuggestionsEnabled: config.aiSuggestionsEnabled,
        aiChatEnabled: config.aiChatEnabled,
        aiUpsellEnabled: config.aiUpsellEnabled,
      });
      toast.success('AI configuration saved');
      setApiKey('');
      fetchConfig();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save AI config');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof AIConfig, value: any) => {
    setConfig(prev => prev ? { ...prev, [field]: value } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Failed to load configuration.</div>;
  }

  const providerInfo = PROVIDER_INFO[config.aiProvider] || PROVIDER_INFO.none;
  const canEnable = config.aiProvider !== 'none' && (config.hasApiKey || !!apiKey);

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Provider
          </CardTitle>
          <CardDescription>Choose your AI provider. You bring your own API key — YeneQR does not pay for AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Provider</Label>
            <Select
              value={config.aiProvider}
              onValueChange={(v) => {
                updateConfig('aiProvider', v);
                if (v === 'none') {
                  updateConfig('aiEnabled', false);
                  updateConfig('aiTranslationEnabled', false);
                  updateConfig('aiSuggestionsEnabled', false);
                  updateConfig('aiChatEnabled', false);
                  updateConfig('aiUpsellEnabled', false);
                }
                // Set default model for provider
                const info = PROVIDER_INFO[v];
                if (info?.models.length && !model) setModel(info.models[0]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                    {info.free && <Badge className="ml-2 text-[9px] bg-emerald-500 text-white">FREE</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{providerInfo.description}</p>
            {providerInfo.signupUrl && (
              <a href={providerInfo.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {config.aiProvider !== 'none' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">API Key {config.hasApiKey && !apiKey && <Badge variant="secondary" className="ml-2 text-[9px]">Already set</Badge>}</Label>
                <Input
                  type="password"
                  placeholder={config.hasApiKey ? '•••••••• (enter new key to replace)' : 'Paste your API key here'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {providerInfo.models.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Default model" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerInfo.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.aiProvider === 'custom' && (
                <div className="space-y-2">
                  <Label className="text-sm">API Base URL</Label>
                  <Input
                    placeholder="https://your-api-endpoint.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Master Switch + Feature Toggles */}
      {config.aiProvider !== 'none' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Toggles</CardTitle>
            <CardDescription>Control which AI features are active. Master switch must be on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Master switch */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Enable AI</Label>
                <p className="text-xs text-muted-foreground">Master switch — all features below require this to be on</p>
              </div>
              <div className="flex items-center gap-2">
                {!canEnable && config.aiEnabled && (
                  <Badge variant="destructive" className="text-[9px]">API key required</Badge>
                )}
                <Switch
                  checked={config.aiEnabled && canEnable}
                  onCheckedChange={(checked) => updateConfig('aiEnabled', checked)}
                  disabled={!canEnable}
                />
              </div>
            </div>

            {!canEnable && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Enter your API key above to enable AI features.
                </p>
              </div>
            )}

            <Separator />

            {/* Feature toggles */}
            {FEATURES.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{feature.label}</Label>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <Switch
                  checked={config[feature.key]}
                  onCheckedChange={(checked) => updateConfig(feature.key, checked)}
                  disabled={!config.aiEnabled}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save AI Configuration
        </Button>
      </div>
    </div>
  );
}
