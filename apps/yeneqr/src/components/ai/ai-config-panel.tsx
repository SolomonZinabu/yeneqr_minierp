'use client';

// ============================================================
// Yene QR — AI Config Panel
// Per-tenant AI agent configuration admin UI
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, RotateCcw, Save, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AGENT_INFO, SUGGESTION_CATEGORIES } from '@/lib/ai/types';
import type { AgentType } from '@/lib/ai/types';
import { api } from '@/lib/api-client';

// Tool names by agent type (mirroring the agent definitions)
const TOOLS_BY_AGENT: Record<AgentType, string[]> = {
  owner: ['get_analytics', 'get_menu_performance', 'get_inventory_status', 'suggest_promotion', 'get_review_insights', 'get_demand_forecast'],
  kitchen: ['get_order_queue', 'get_prep_suggestion', 'get_batch_suggestions', 'check_ingredient_availability', 'get_allergen_info'],
  waiter: ['get_table_status', 'get_order_details', 'get_upsell_suggestions', 'get_menu_item_details', 'get_waiter_calls'],
  customer: ['get_menu_items', 'get_item_details', 'get_pairing_suggestions', 'check_allergen_safety', 'get_active_promotions', 'get_recommendation'],
};

interface AgentConfigData {
  agentType: AgentType;
  isEnabled: boolean;
  name: string;
  greeting: string;
  icon: string;
  color: string;
  temperature: number;
  maxToolIterations: number;
  maxTokens: number;
  customInstructions: string | null;
  enabledTools: string[] | null;
  disabledTools: string[];
  suggestionCategories: string[];
  language: string;
  autoSuggest: boolean;
  autoSuggestInterval: number;
  dbId: string | null;
  hasCustomConfig: boolean;
}

interface AIConfigPanelProps {
  restaurantId: string;
  className?: string;
}

export function AIConfigPanel({ restaurantId, className }: AIConfigPanelProps) {
  const [configs, setConfigs] = useState<AgentConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // agentType being saved
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set()); // track which agents have unsaved changes

  // Load configs
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ configs: AgentConfigData[] }>('/api/ai/config', { restaurantId });
      setConfigs(data.configs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI configurations');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Save config for a specific agent type
  const saveConfig = async (agentType: AgentType) => {
    const config = configs.find(c => c.agentType === agentType);
    if (!config) return;

    setSaving(agentType);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/api/ai/config', {
        restaurantId,
        agentType,
        isEnabled: config.isEnabled,
        customName: config.name !== AGENT_INFO[agentType].name ? config.name : null,
        customGreeting: config.greeting !== AGENT_INFO[agentType].greeting ? config.greeting : null,
        customIcon: config.icon !== AGENT_INFO[agentType].icon ? config.icon : null,
        customColor: config.color !== AGENT_INFO[agentType].color ? config.color : null,
        customInstructions: config.customInstructions || null,
        temperature: config.temperature,
        maxToolIterations: config.maxToolIterations,
        maxTokens: config.maxTokens,
        enabledTools: config.enabledTools,
        disabledTools: config.disabledTools,
        suggestionCategories: config.suggestionCategories,
        language: config.language,
        autoSuggest: config.autoSuggest,
        autoSuggestInterval: config.autoSuggestInterval,
      });

      setSuccess(`${config.name} saved successfully`);
      setDirty(prev => {
        const next = new Set(prev);
        next.delete(agentType);
        return next;
      });

      // Reload to get fresh data
      await loadConfigs();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(null);
    }
  };

  // Reset config to defaults
  const resetConfig = async (agentType: AgentType) => {
    setSaving(agentType);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/api/ai/config', { restaurantId, agentType });

      setSuccess(`${AGENT_INFO[agentType].name} reset to defaults`);
      setDirty(prev => {
        const next = new Set(prev);
        next.delete(agentType);
        return next;
      });

      await loadConfigs();
    } catch (err: any) {
      setError(err.message || 'Failed to reset configuration');
    } finally {
      setSaving(null);
    }
  };

  // Update a config field locally
  const updateConfig = (agentType: AgentType, field: string, value: any) => {
    setConfigs(prev => prev.map(c =>
      c.agentType === agentType ? { ...c, [field]: value } : c
    ));
    setDirty(prev => {
      const next = new Set(prev);
      next.add(agentType);
      return next;
    });
  };

  // Toggle a tool in the disabled list
  const toggleTool = (agentType: AgentType, toolName: string) => {
    const config = configs.find(c => c.agentType === agentType);
    if (!config) return;

    const isCurrentlyDisabled = config.disabledTools.includes(toolName);
    const newDisabled = isCurrentlyDisabled
      ? config.disabledTools.filter(t => t !== toolName)
      : [...config.disabledTools, toolName];

    updateConfig(agentType, 'disabledTools', newDisabled);
  };

  // Toggle a suggestion category
  const toggleSuggestionCategory = (agentType: AgentType, category: string) => {
    const config = configs.find(c => c.agentType === agentType);
    if (!config) return;

    const isActive = config.suggestionCategories.includes(category);
    const newCategories = isActive
      ? config.suggestionCategories.filter(c => c !== category)
      : [...config.suggestionCategories, category];

    updateConfig(agentType, 'suggestionCategories', newCategories);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading AI configuration...</span>
      </div>
    );
  }

  const defaultTab = configs.length > 0 ? configs[0].agentType : 'owner';

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          AI Agent Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Customize how each AI assistant works for your restaurant
        </p>
      </div>

      {/* Status messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
          <Check className="w-4 h-4 shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-4">
          {(['owner', 'kitchen', 'waiter', 'customer'] as AgentType[]).map(type => {
            const info = AGENT_INFO[type];
            const config = configs.find(c => c.agentType === type);
            const isDirty = dirty.has(type);
            return (
              <TabsTrigger key={type} value={type} className="gap-1.5 text-xs sm:text-sm">
                <span>{info.icon}</span>
                <span className="hidden sm:inline">{info.name.replace('Yene ', '')}</span>
                <span className="sm:hidden">{type.slice(0, 3)}</span>
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                {config && !config.isEnabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" title="Disabled" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {configs.map(config => (
          <TabsContent key={config.agentType} value={config.agentType}>
            <AgentConfigCard
              config={config}
              saving={saving === config.agentType}
              isDirty={dirty.has(config.agentType)}
              onSave={() => saveConfig(config.agentType)}
              onReset={() => resetConfig(config.agentType)}
              onUpdate={(field, value) => updateConfig(config.agentType, field, value)}
              onToggleTool={(toolName) => toggleTool(config.agentType, toolName)}
              onToggleCategory={(category) => toggleSuggestionCategory(config.agentType, category)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ── Individual Agent Config Card ────────────────────────────

interface AgentConfigCardProps {
  config: AgentConfigData;
  saving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onReset: () => void;
  onUpdate: (field: string, value: any) => void;
  onToggleTool: (toolName: string) => void;
  onToggleCategory: (category: string) => void;
}

function AgentConfigCard({
  config,
  saving,
  isDirty,
  onSave,
  onReset,
  onUpdate,
  onToggleTool,
  onToggleCategory,
}: AgentConfigCardProps) {
  const defaults = AGENT_INFO[config.agentType];
  const availableTools = TOOLS_BY_AGENT[config.agentType];
  const availableCategories = SUGGESTION_CATEGORIES[config.agentType] as readonly string[];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: config.color + '20' }}
            >
              {config.icon}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.name}
                {config.hasCustomConfig && (
                  <Badge variant="secondary" className="text-[10px] font-normal">Customized</Badge>
                )}
                {!config.isEnabled && (
                  <Badge variant="outline" className="text-[10px] font-normal text-gray-500">Disabled</Badge>
                )}
              </CardTitle>
              <CardDescription>{defaults.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`enabled-${config.agentType}`} className="text-xs text-gray-500">Enabled</Label>
            <Switch
              id={`enabled-${config.agentType}`}
              checked={config.isEnabled}
              onCheckedChange={(checked) => onUpdate('isEnabled', checked)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Basic Settings ──────────────────────── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Custom Name</Label>
              <Input
                value={config.name}
                onChange={(e) => onUpdate('name', e.target.value)}
                placeholder={defaults.name}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Custom Icon (emoji)</Label>
              <Input
                value={config.icon}
                onChange={(e) => onUpdate('icon', e.target.value)}
                placeholder={defaults.icon}
                className="text-sm"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => onUpdate('color', e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={config.color}
                  onChange={(e) => onUpdate('color', e.target.value)}
                  placeholder={defaults.color}
                  className="text-sm flex-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <select
                value={config.language}
                onChange={(e) => onUpdate('language', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="en">English</option>
                <option value="am">አማርኛ (Amharic)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Custom Greeting</Label>
            <Textarea
              value={config.greeting}
              onChange={(e) => onUpdate('greeting', e.target.value)}
              placeholder={defaults.greeting}
              className="text-sm min-h-[60px]"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Custom Instructions</Label>
            <Textarea
              value={config.customInstructions || ''}
              onChange={(e) => onUpdate('customInstructions', e.target.value || null)}
              placeholder="Extra instructions specific to your restaurant (tone, special rules, menu knowledge, etc.)"
              className="text-sm min-h-[80px]"
            />
            <p className="text-[10px] text-gray-400">
              These instructions are injected into the AI's system prompt. Use them to add restaurant-specific knowledge, tone guidelines, or operational rules.
            </p>
          </div>
        </div>

        <Separator />

        {/* ── Model Parameters ───────────────────── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Model Parameters</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperature (Creativity)</Label>
                <span className="text-xs text-gray-500 font-mono">{config.temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[config.temperature]}
                onValueChange={([v]) => onUpdate('temperature', v)}
                min={0}
                max={1}
                step={0.1}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Precise (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Max Tool Iterations</Label>
                <Input
                  type="number"
                  value={config.maxToolIterations}
                  onChange={(e) => onUpdate('maxToolIterations', parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Response Tokens</Label>
                <Input
                  type="number"
                  value={config.maxTokens}
                  onChange={(e) => onUpdate('maxTokens', parseInt(e.target.value) || 2048)}
                  min={256}
                  max={4096}
                  step={256}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Tool Permissions ───────────────────── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Tool Permissions</h4>
          <p className="text-xs text-gray-400 mb-3">
            Disable tools you don't want this agent to use. All tools are enabled by default.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableTools.map(toolName => {
              const isDisabled = config.disabledTools.includes(toolName);
              return (
                <label
                  key={toolName}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isDisabled
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isDisabled}
                    onChange={() => onToggleTool(toolName)}
                    className="rounded"
                  />
                  <code className="font-mono text-[11px]">{toolName}</code>
                </label>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ── Suggestion Categories ──────────────── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Suggestion Categories</h4>
          <p className="text-xs text-gray-400 mb-3">
            Choose which types of proactive suggestions this agent can generate.
          </p>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(category => {
              const isActive = config.suggestionCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => onToggleCategory(category)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {category.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ── Auto-Suggest ───────────────────────── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Auto-Suggest</h4>
          <div className="flex items-center gap-3">
            <Switch
              id={`autoSuggest-${config.agentType}`}
              checked={config.autoSuggest}
              onCheckedChange={(checked) => onUpdate('autoSuggest', checked)}
            />
            <Label htmlFor={`autoSuggest-${config.agentType}`} className="text-sm">
              Automatically generate suggestions on schedule
            </Label>
          </div>
          {config.autoSuggest && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Interval (minutes)</Label>
              <Input
                type="number"
                value={config.autoSuggestInterval}
                onChange={(e) => onUpdate('autoSuggestInterval', parseInt(e.target.value) || 60)}
                min={15}
                max={1440}
                className="text-sm w-32"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* ── Actions ────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={saving || !config.hasCustomConfig}
            className="text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || !isDirty}
            className="text-xs"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
