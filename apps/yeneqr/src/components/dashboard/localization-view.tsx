'use client';

// ============================================================
// BRANCH SCOPING NOTE (Phase 4.5 of multi-branch audit)
// ============================================================
// This view intentionally does NOT use `useBranchChange` or pass
// `?branchId=` to API calls. UI strings, languages, and translations
// are restaurant-level — all branches of a restaurant share the same
// UI language set and translation strings. Menu-content translations
// are also restaurant-level (the Menu model has no branchId).
// If a future product decision makes translations branch-scoped
// (e.g., different branches serving different cuisines with different
// menu translations), add branchId to the relevant translation models
// and update this view + the i18n API routes.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { clearI18nCache } from '@/hooks/useI18n';
import { api } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import { parseI18nJson, type I18nJson, type LanguageConfig } from '@/lib/i18n';
import {
  Globe,
  Search,
  Plus,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Edit3,
  AlertCircle,
  Loader2,
  Languages,
  FileText,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Filter,
  Star,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  GripVertical,
  ChevronUp,
  Eye,
  Zap,
  Rocket,
  MapPin,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface UIStringEntry {
  id: string;
  key: string;
  group: string;
  description: string | null;
  defaultValue: string;
  translations: I18nJson;
  isActive: boolean;
}

interface LanguageEntry {
  code: string;
  name: string;
  nameLocal: string;
  direction: 'ltr' | 'rtl';
  fontFamily: string | null;
  flagEmoji: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface MenuContentData {
  restaurant: {
    id: string;
    name: string;
    nameI18n: I18nJson;
    description: string;
    descriptionI18n: I18nJson;
    defaultLanguage: string;
    enabledLanguages: string[];
  };
  categories: Array<{
    id: string;
    name: string;
    nameI18n: I18nJson;
    description: string | null;
    descriptionI18n: I18nJson;
    menuId: string;
    sortOrder: number;
  }>;
  items: Array<{
    id: string;
    name: string;
    nameI18n: I18nJson;
    description: string | null;
    descriptionI18n: I18nJson;
    categoryId: string;
    priceCents: number;
    sortOrder: number;
  }>;
  stats: Record<string, {
    categories: { total: number; translated: number };
    items: { total: number; translated: number };
    restaurant: { total: number; translated: number };
  }>;
}

interface RestaurantLanguage {
  languageCode: string;
  isDefault: boolean;
  isActive: boolean;
  isRequired: boolean;
  sortOrder: number;
  language?: LanguageEntry;
  completionPct?: number;
}

// ============================================================
// Regional Language Presets
// ============================================================

const REGIONAL_PRESETS = [
  {
    id: 'ethiopian',
    name: 'Ethiopian Languages',
    description: 'Amharic, Oromo, Tigrinya, Somali, Afar, Sidamo',
    icon: '🇪🇹',
    codes: ['am', 'om', 'ti', 'so', 'aa', 'sid'],
    color: 'from-green-500/10 to-yellow-500/10 border-green-200 dark:border-green-800',
  },
  {
    id: 'middle-eastern',
    name: 'Middle Eastern',
    description: 'Arabic (RTL support included)',
    icon: '🌍',
    codes: ['ar'],
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800',
  },
  {
    id: 'european',
    name: 'European',
    description: 'Italian, French',
    icon: '🇪🇺',
    codes: ['it', 'fr'],
    color: 'from-violet-500/10 to-purple-500/10 border-violet-200 dark:border-violet-800',
  },
  {
    id: 'asian',
    name: 'Asian',
    description: 'Chinese, Hindi, Malayalam',
    icon: '🌏',
    codes: ['zh', 'hi', 'ml'],
    color: 'from-orange-500/10 to-red-500/10 border-orange-200 dark:border-orange-800',
  },
];

// ============================================================
// Main Component
// ============================================================

export function LocalizationView() {
  const { user } = useAppStore();
  const { t } = useI18n(user?.restaurantId);
  const restaurantId = user?.restaurantId || '';

  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [uiStrings, setUiStrings] = useState<UIStringEntry[]>([]);
  const [menuContent, setMenuContent] = useState<MenuContentData | null>(null);
  const [restaurantLangs, setRestaurantLangs] = useState<RestaurantLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('languages');

  // Load all data
  const loadLanguages = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/i18n/languages');
      const langs = res.languages || (Array.isArray(res) ? res : []);
      setLanguages(langs);
    } catch (err) {
      console.error('Failed to load languages:', err);
    }
  }, []);

  const loadUIStrings = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/i18n/ui-strings');
      setUiStrings(res.strings || []);
    } catch (err) {
      console.error('Failed to load UI strings:', err);
    }
  }, []);

  const loadMenuContent = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<MenuContentData>(`/api/restaurants/${restaurantId}/i18n/menu-content`);
      setMenuContent(res as any);
    } catch (err) {
      console.error('Failed to load menu content:', err);
    }
  }, [restaurantId]);

  const loadRestaurantLangs = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<any>(`/api/restaurants/${restaurantId}/i18n/languages`);
      const enabledLangs = res.enabledLanguages || [];
      const rl: RestaurantLanguage[] = enabledLangs.map((l: any) => ({
        languageCode: l.code,
        isDefault: l.isDefault || false,
        isActive: l.isActive !== false,
        isRequired: l.isRequired || false,
        sortOrder: l.sortOrder || 0,
        language: l,
        completionPct: l.completionPct || 0,
      }));
      setRestaurantLangs(rl);
    } catch (err) {
      console.error('Failed to load restaurant languages:', err);
    }
  }, [restaurantId]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([loadLanguages(), loadUIStrings(), loadMenuContent(), loadRestaurantLangs()]);
      setLoading(false);
    }
    loadAll();
  }, [loadLanguages, loadUIStrings, loadMenuContent, loadRestaurantLangs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-3 text-muted-foreground">{t('dashboard.loading_dashboard') || 'Loading localization...'}</span>
      </div>
    );
  }

  // Get groups from UI strings
  const groups = [...new Set(uiStrings.map(s => s.group))].sort();

  // Get enabled language codes
  const enabledLangCodes = restaurantLangs
    .filter(rl => rl.isActive)
    .map(rl => rl.languageCode);

  // Filter platform languages to only those enabled for this restaurant
  const enabledLanguages = languages.filter(l => enabledLangCodes.includes(l.code));

  // Calculate overall translation completion
  const getCompletionPct = (langCode: string) => {
    if (langCode === 'en') return 100;
    const total = uiStrings.length;
    if (total === 0) return 0;
    const translated = uiStrings.filter(s => s.translations?.[langCode]).length;
    return Math.round((translated / total) * 100);
  };

  // Check if getting started banner should show
  const showGettingStarted = enabledLangCodes.length <= 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            {t('dashboard.localization') || 'Localization'}
          </h2>
          <p className="text-muted-foreground">
            Manage languages, translations, and content for your restaurant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setLoading(true);
              clearI18nCache();
              await Promise.all([loadLanguages(), loadUIStrings(), loadMenuContent(), loadRestaurantLangs()]);
              setLoading(false);
              toast.success('Data refreshed');
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Getting Started Banner */}
      {showGettingStarted && (
        <GettingStartedBanner
          languages={languages}
          enabledLangCodes={enabledLangCodes}
          restaurantId={restaurantId}
          onSetupComplete={loadRestaurantLangs}
        />
      )}

      {/* Main Tabs — Languages first! */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="languages" className="gap-1.5">
            <Languages className="h-4 w-4" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ui-strings" className="gap-1.5">
            <FileText className="h-4 w-4" />
            UI Strings
          </TabsTrigger>
          <TabsTrigger value="menu-content" className="gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            Menu Content
          </TabsTrigger>
        </TabsList>

        {/* ── Languages Tab (FIRST) ────────────────────────── */}
        <TabsContent value="languages" className="space-y-4">
          <LanguageManager
            languages={languages}
            restaurantLangs={restaurantLangs}
            restaurantId={restaurantId}
            onUpdate={loadRestaurantLangs}
          />
        </TabsContent>

        {/* ── Overview Tab ────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <LanguageOverviewCards
            languages={enabledLanguages}
            enabledLangCodes={enabledLangCodes}
            getCompletionPct={getCompletionPct}
            uiStringsCount={uiStrings.length}
            menuContent={menuContent}
          />
        </TabsContent>

        {/* ── UI Strings Tab ──────────────────────────────── */}
        <TabsContent value="ui-strings" className="space-y-4">
          <UIStringsEditor
            uiStrings={uiStrings}
            languages={enabledLanguages}
            enabledLangCodes={enabledLangCodes}
            groups={groups}
            onUpdate={() => { loadUIStrings(); clearI18nCache(); }}
          />
        </TabsContent>

        {/* ── Menu Content Tab ────────────────────────────── */}
        <TabsContent value="menu-content" className="space-y-4">
          <MenuContentEditor
            menuContent={menuContent}
            languages={enabledLanguages}
            enabledLangCodes={enabledLangCodes}
            restaurantId={restaurantId}
            onUpdate={loadMenuContent}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Getting Started Banner
// ============================================================

function GettingStartedBanner({
  languages,
  enabledLangCodes,
  restaurantId,
  onSetupComplete,
}: {
  languages: LanguageEntry[];
  enabledLangCodes: string[];
  restaurantId: string;
  onSetupComplete: () => void;
}) {
  const [applying, setApplying] = useState<string | null>(null);

  const handleQuickEnable = async (preset: typeof REGIONAL_PRESETS[0]) => {
    setApplying(preset.id);
    try {
      // Build the full language config: existing enabled + new preset codes
      const existingCodes = new Set(enabledLangCodes);
      const allCodes = new Set([...existingCodes, ...preset.codes]);

      const langConfigs = Array.from(allCodes).map((code, index) => ({
        code,
        isDefault: code === 'en',
        isActive: true,
        isRequired: code === 'en',
        sortOrder: index,
      }));

      await api.put(`/api/restaurants/${restaurantId}/i18n/languages`, {
        defaultLanguage: 'en',
        languages: langConfigs,
      });

      toast.success(`${preset.name} enabled! Your customers can now see the menu in these languages.`);
      onSetupComplete();
    } catch (err) {
      toast.error('Failed to enable languages. Please try again.');
    } finally {
      setApplying(null);
    }
  };

  const steps = [
    { num: 1, title: 'Enable Languages', desc: 'Choose languages your customers speak', icon: <Globe className="h-4 w-4" /> },
    { num: 2, title: 'Translate Menu', desc: 'Add translations for categories & items', icon: <UtensilsCrossed className="h-4 w-4" /> },
    { num: 3, title: 'Translate UI', desc: 'Translate buttons, labels & messages', icon: <FileText className="h-4 w-4" /> },
    { num: 4, title: 'Go Live!', desc: 'Customers see the menu in their language', icon: <Rocket className="h-4 w-4" /> },
  ];

  const currentStep = enabledLangCodes.length <= 1 ? 1 : enabledLangCodes.length > 1 ? 2 : 1;

  return (
    <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 px-6 py-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 shrink-0">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Get Started with Multilingual Menu</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reach more customers by offering your menu in multiple languages. Follow these steps to go multilingual.
            </p>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 shrink-0 transition-all ${
                step.num <= currentStep
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-muted/50 border border-transparent'
              }`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                  step.num <= currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.num <= currentStep ? <Check className="h-3.5 w-3.5" /> : step.num}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${step.num <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate hidden sm:block">{step.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Regional Presets */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick Enable — One click to add regional language groups
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REGIONAL_PRESETS.map((preset) => {
              const allAlreadyEnabled = preset.codes.every(c => enabledLangCodes.includes(c));
              const someEnabled = preset.codes.some(c => enabledLangCodes.includes(c));

              return (
                <button
                  key={preset.id}
                  onClick={() => !allAlreadyEnabled && handleQuickEnable(preset)}
                  disabled={applying !== null || allAlreadyEnabled}
                  className={`relative rounded-xl border p-4 text-left transition-all duration-200 bg-gradient-to-br ${preset.color} ${
                    allAlreadyEnabled
                      ? 'opacity-60 cursor-default'
                      : 'hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{preset.icon}</span>
                    <span className="font-semibold text-sm">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{preset.description}</p>
                  <div className="flex items-center gap-1.5">
                    {allAlreadyEnabled ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Enabled
                      </Badge>
                    ) : someEnabled ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Zap className="h-3 w-3" />
                        Add remaining
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] gap-1">
                        <Plus className="h-3 w-3" />
                        Enable all
                      </Badge>
                    )}
                  </div>
                  {applying === preset.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          <span>You can also add individual languages from the Languages tab below</span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Language Overview Cards
// ============================================================

function LanguageOverviewCards({
  languages,
  enabledLangCodes,
  getCompletionPct,
  uiStringsCount,
  menuContent,
}: {
  languages: LanguageEntry[];
  enabledLangCodes: string[];
  getCompletionPct: (code: string) => number;
  uiStringsCount: number;
  menuContent: MenuContentData | null;
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Languages</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledLangCodes.length}</div>
            <p className="text-xs text-muted-foreground">of {languages.length} available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">UI Strings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uiStringsCount}</div>
            <p className="text-xs text-muted-foreground">translation keys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Menu Items</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{menuContent?.items.length || 0}</div>
            <p className="text-xs text-muted-foreground">{menuContent?.categories.length || 0} categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enabledLangCodes.length > 1
                ? Math.round(
                    enabledLangCodes
                      .filter(c => c !== 'en')
                      .reduce((sum, c) => sum + getCompletionPct(c), 0) /
                    (enabledLangCodes.length - 1)
                  )
                : 100}%
            </div>
            <p className="text-xs text-muted-foreground">across all languages</p>
          </CardContent>
        </Card>
      </div>

      {/* Language Progress Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Translation Progress</CardTitle>
          <CardDescription>Completion percentage for each enabled language</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enabledLangCodes.map(code => {
              const lang = languages.find(l => l.code === code);
              if (!lang) return null;
              const pct = getCompletionPct(code);
              const menuStats = menuContent?.stats?.[code];
              const menuPct = menuStats
                ? Math.round(
                    ((menuStats.restaurant.translated + menuStats.categories.translated + menuStats.items.translated) /
                      (menuStats.restaurant.total + menuStats.categories.total + menuStats.items.total)) *
                      100
                  )
                : code === 'en' ? 100 : 0;

              return (
                <div key={code} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{lang.flagEmoji}</span>
                      <div>
                        <p className="font-medium text-sm">{lang.name}</p>
                        <p className="text-xs text-muted-foreground">{lang.nameLocal}</p>
                      </div>
                    </div>
                    <Badge variant={pct === 100 ? 'default' : pct >= 50 ? 'secondary' : 'outline'}>
                      {code === 'en' ? 'Source' : `${pct}%`}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">UI Strings</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  {menuStats && code !== 'en' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Menu Content</span>
                        <span>{menuPct}%</span>
                      </div>
                      <Progress value={menuPct} className="h-1.5" />
                    </div>
                  )}

                  {lang.direction === 'rtl' && (
                    <Badge variant="outline" className="text-[10px]">RTL</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// UI Strings Editor
// ============================================================

function UIStringsEditor({
  uiStrings,
  languages,
  enabledLangCodes,
  groups,
  onUpdate,
}: {
  uiStrings: UIStringEntry[];
  languages: LanguageEntry[];
  enabledLangCodes: string[];
  groups: string[];
  onUpdate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTranslations, setEditTranslations] = useState<I18nJson>({});
  const [editDefaultValue, setEditDefaultValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newDefaultValue, setNewDefaultValue] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Filter strings
  const filteredStrings = uiStrings.filter(s => {
    const matchesSearch = !searchQuery ||
      s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.defaultValue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || s.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleEdit = (entry: UIStringEntry) => {
    setEditingKey(entry.key);
    setEditTranslations({ ...entry.translations });
    setEditDefaultValue(entry.defaultValue);
  };

  const handleSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      await api.put('/api/i18n/ui-strings', {
        key: editingKey,
        translations: editTranslations,
      });
      toast.success(`Translation saved for "${editingKey}"`);
      setEditingKey(null);
      onUpdate();
    } catch (err) {
      toast.error('Failed to save translation');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditTranslations({});
    setEditDefaultValue('');
  };

  const handleAddNew = async () => {
    if (!newKey || !newGroup || !newDefaultValue) {
      toast.error('Key, group, and default value are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/i18n/ui-strings', {
        key: newKey,
        group: newGroup,
        defaultValue: newDefaultValue,
        description: newDescription || null,
        translations: {},
      });
      toast.success(`UI string "${newKey}" created`);
      setShowAddDialog(false);
      setNewKey('');
      setNewGroup('');
      setNewDefaultValue('');
      setNewDescription('');
      onUpdate();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create UI string');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete UI string "${key}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/i18n/ui-strings/${encodeURIComponent(key)}`);
      toast.success(`UI string "${key}" deleted`);
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete UI string');
    }
  };

  // Non-English enabled languages for the translation columns
  const translatableLangs = enabledLangCodes.filter(c => c !== 'en');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strings..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[160px] h-9">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Filter group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add String
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New UI String</DialogTitle>
              <DialogDescription>
                Create a new translation key for the application UI
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key (dot notation)</label>
                <Input
                  placeholder="e.g., dashboard.new_feature"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group</label>
                <div className="flex gap-2">
                  <Select value={newGroup} onValueChange={setNewGroup}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                      <SelectItem value="__new__">New group...</SelectItem>
                    </SelectContent>
                  </Select>
                  {newGroup === '__new__' && (
                    <Input
                      placeholder="New group name"
                      onChange={e => setNewGroup(e.target.value)}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Value (English)</label>
                <Input
                  placeholder="English text"
                  value={newDefaultValue}
                  onChange={e => setNewDefaultValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  placeholder="Context for translators"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddNew} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* String Count */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredStrings.length} of {uiStrings.length} strings
        {searchQuery && ` matching "${searchQuery}"`}
        {selectedGroup !== 'all' && ` in group "${selectedGroup}"`}
      </div>

      {/* String List / Editor */}
      <div className="rounded-lg border">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Key</TableHead>
                <TableHead className="w-[80px]">Group</TableHead>
                <TableHead className="min-w-[200px]">English (Source)</TableHead>
                {translatableLangs.slice(0, 4).map(code => {
                  const lang = languages.find(l => l.code === code);
                  return (
                    <TableHead key={code} className="min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <span>{lang?.flagEmoji}</span>
                        <span>{lang?.name || code}</span>
                      </div>
                    </TableHead>
                  );
                })}
                {translatableLangs.length > 4 && (
                  <TableHead className="w-[80px]">+{translatableLangs.length - 4} more</TableHead>
                )}
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStrings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5 + Math.min(translatableLangs.length, 4) + (translatableLangs.length > 4 ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                    No UI strings found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStrings.map(entry => {
                  const isEditing = editingKey === entry.key;

                  if (isEditing) {
                    return (
                      <TableRow key={entry.key} className="bg-primary/5">
                        <TableCell className="font-mono text-xs">{entry.key}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{entry.group}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editDefaultValue}
                            onChange={e => setEditDefaultValue(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        {translatableLangs.slice(0, 4).map(code => {
                          const lang = languages.find(l => l.code === code);
                          return (
                            <TableCell key={code}>
                              <Input
                                value={editTranslations[code] || ''}
                                onChange={e =>
                                  setEditTranslations(prev => ({
                                    ...prev,
                                    [code]: e.target.value,
                                  }))
                                }
                                placeholder={entry.defaultValue}
                                className="h-8 text-sm"
                                dir={lang?.direction === 'rtl' ? 'rtl' : 'ltr'}
                              />
                            </TableCell>
                          );
                        })}
                        {translatableLangs.length > 4 && (
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              +{translatableLangs.length - 4}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSave} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={entry.key} className="hover:bg-accent/50 cursor-pointer" onClick={() => handleEdit(entry)}>
                      <TableCell className="font-mono text-xs">{entry.key}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{entry.group}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.defaultValue}</TableCell>
                      {translatableLangs.slice(0, 4).map(code => {
                        const translated = entry.translations?.[code];
                        return (
                          <TableCell key={code}>
                            <div className="flex items-center gap-1.5">
                              {translated ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                  <span className="text-sm truncate max-w-[140px]">{translated}</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span className="text-xs text-muted-foreground italic">Missing</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      {translatableLangs.length > 4 && (
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            +{translatableLangs.length - 4}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={e => { e.stopPropagation(); handleDelete(entry.key); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Full Edit Dialog for many languages */}
      <FullEditDialog
        editingKey={editingKey}
        editTranslations={editTranslations}
        editDefaultValue={editDefaultValue}
        languages={languages}
        enabledLangCodes={enabledLangCodes}
        saving={saving}
        onSetEditTranslations={setEditTranslations}
        onSetEditDefaultValue={setEditDefaultValue}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}

// ============================================================
// Full Edit Dialog — for editing all language translations
// ============================================================

function FullEditDialog({
  editingKey,
  editTranslations,
  editDefaultValue,
  languages,
  enabledLangCodes,
  saving,
  onSetEditTranslations,
  onSetEditDefaultValue,
  onSave,
  onCancel,
}: {
  editingKey: string | null;
  editTranslations: I18nJson;
  editDefaultValue: string;
  languages: LanguageEntry[];
  enabledLangCodes: string[];
  saving: boolean;
  onSetEditTranslations: (t: I18nJson) => void;
  onSetEditDefaultValue: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={!!editingKey} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Translation: {editingKey}</DialogTitle>
          <DialogDescription>
            Update translations for this UI string across all enabled languages
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4 py-4">
            {/* English source */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <span>{languages.find(l => l.code === 'en')?.flagEmoji}</span>
                English (Source)
                <Badge variant="default" className="text-[10px]">Source</Badge>
              </label>
              <Input
                value={editDefaultValue}
                onChange={e => onSetEditDefaultValue(e.target.value)}
                className="h-9"
              />
            </div>

            <Separator />

            {/* Other languages */}
            {enabledLangCodes.filter(c => c !== 'en').map(code => {
              const lang = languages.find(l => l.code === code);
              if (!lang) return null;
              return (
                <div key={code} className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span>{lang.flagEmoji}</span>
                    {lang.name}
                    <span className="text-muted-foreground text-xs">({lang.nameLocal})</span>
                    {lang.direction === 'rtl' && <Badge variant="outline" className="text-[10px]">RTL</Badge>}
                    {editTranslations[code] ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </label>
                  <Input
                    value={editTranslations[code] || ''}
                    onChange={e =>
                      onSetEditTranslations({
                        ...editTranslations,
                        [code]: e.target.value,
                      })
                    }
                    placeholder={editDefaultValue}
                    dir={lang.direction === 'rtl' ? 'rtl' : 'ltr'}
                    className="h-9"
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            Save Translation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Menu Content Editor
// ============================================================

function MenuContentEditor({
  menuContent,
  languages,
  enabledLangCodes,
  restaurantId,
  onUpdate,
}: {
  menuContent: MenuContentData | null;
  languages: LanguageEntry[];
  enabledLangCodes: string[];
  restaurantId: string;
  onUpdate: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: 'restaurant' | 'category' | 'item'; id: string; field: string; lang: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Bulk AI Translate state ──
  // (declared before any early return to respect React's Rules of Hooks)
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  // selectedTargetLangs is initialized lazily from translatableLangs below;
  // we keep it as a separate state so the user can deselect languages in the dialog.
  const [selectedTargetLangs, setSelectedTargetLangs] = useState<string[]>([]);

  if (!menuContent) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No menu content found. Add menu items first.</p>
        </CardContent>
      </Card>
    );
  }

  const translatableLangs = enabledLangCodes.filter(c => c !== 'en');
  // If user hasn't picked any langs yet, default to all enabled non-English langs
  const effectiveTargetLangs = selectedTargetLangs.length > 0 ? selectedTargetLangs : translatableLangs;

  // ── Bulk AI Translate handler ──
  // Uses /api/restaurants/{id}/i18n/bulk-translate to batch-translate
  // all menu items into the enabled languages. Skips items that already
  // have translations unless overwrite is checked.
  const handleBulkTranslate = async () => {
    if (effectiveTargetLangs.length === 0) {
      toast.error('Select at least one target language');
      return;
    }
    setBulkTranslating(true);
    try {
      const res = await api.post<{
        translated: number;
        skipped: number;
        errors: string[];
      }>(`/api/restaurants/${restaurantId}/i18n/bulk-translate`, {
        targetLanguages: effectiveTargetLangs,
        overwrite: overwriteExisting,
      });
      const { translated = 0, skipped = 0, errors = [] } = res || {};
      let msg = `Translated ${translated} item${translated !== 1 ? 's' : ''}`;
      if (skipped > 0) msg += `, skipped ${skipped} (already had translations)`;
      toast.success(msg);
      if (errors.length > 0) {
        toast.warning(`${errors.length} error(s) — check server logs`);
      }
      setShowBulkDialog(false);
      setSelectedTargetLangs([]);
      onUpdate();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || 'Bulk translate failed — make sure AI is configured in Settings');
    } finally {
      setBulkTranslating(false);
    }
  };

  const toggleTargetLang = (code: string) => {
    setSelectedTargetLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/i18n/menu-content`, {
        entityType: editingItem.type,
        entityId: editingItem.id,
        field: editingItem.field,
        language: editingItem.lang,
        value: editingItem.value,
      });
      toast.success('Translation saved');
      setEditingItem(null);
      onUpdate();
    } catch (err) {
      toast.error('Failed to save translation');
    } finally {
      setSaving(false);
    }
  };

  // Restaurant info
  const restaurant = menuContent.restaurant;

  // Filter items by category
  const displayItems = selectedCategory
    ? menuContent.items.filter(i => i.categoryId === selectedCategory)
    : menuContent.items;

  return (
    <div className="space-y-4">
      {/* ── Bulk AI Translate Banner ── */}
      {translatableLangs.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Bulk AI Translate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Auto-translate all {menuContent.items.length} menu items into {translatableLangs.length} enabled language{translatableLangs.length !== 1 ? 's' : ''} using your configured AI provider.
                    Skips items that already have translations unless you choose to overwrite.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setShowBulkDialog(true)}
                disabled={bulkTranslating}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Bulk Translate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Info Translation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Restaurant Info
          </CardTitle>
          <CardDescription>Translate your restaurant name and description</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Field</TableHead>
                <TableHead className="min-w-[200px]">English (Source)</TableHead>
                {translatableLangs.slice(0, 5).map(code => {
                  const lang = languages.find(l => l.code === code);
                  return (
                    <TableHead key={code} className="min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <span>{lang?.flagEmoji}</span>
                        <span className="text-xs">{lang?.name || code}</span>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Restaurant Name */}
              <TableRow>
                <TableCell className="font-medium text-sm">Name</TableCell>
                <TableCell className="text-sm">{restaurant.name}</TableCell>
                {translatableLangs.slice(0, 5).map(code => {
                  const translated = restaurant.nameI18n[code];
                  const isEditing = editingItem?.type === 'restaurant' && editingItem?.id === restaurant.id && editingItem?.field === 'nameI18n' && editingItem?.lang === code;
                  return (
                    <TableCell key={code}>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingItem.value}
                            onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                            className="h-8 text-sm"
                            dir={languages.find(l => l.code === code)?.direction === 'rtl' ? 'rtl' : 'ltr'}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingItem(null); }}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 shrink-0" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingItem(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm text-left min-h-[32px] w-full px-2 py-1 rounded hover:bg-muted transition-colors"
                          onClick={() => setEditingItem({ type: 'restaurant', id: restaurant.id, field: 'nameI18n', lang: code, value: translated || '' })}
                        >
                          {translated ? (
                            <span>{translated}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Click to translate</span>
                          )}
                        </button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
              {/* Restaurant Description */}
              <TableRow>
                <TableCell className="font-medium text-sm">Description</TableCell>
                <TableCell className="text-sm">{restaurant.description}</TableCell>
                {translatableLangs.slice(0, 5).map(code => {
                  const translated = restaurant.descriptionI18n[code];
                  const isEditing = editingItem?.type === 'restaurant' && editingItem?.id === restaurant.id && editingItem?.field === 'descriptionI18n' && editingItem?.lang === code;
                  return (
                    <TableCell key={code}>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingItem.value}
                            onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                            className="h-8 text-sm"
                            dir={languages.find(l => l.code === code)?.direction === 'rtl' ? 'rtl' : 'ltr'}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingItem(null); }}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 shrink-0" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingItem(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm text-left min-h-[32px] w-full px-2 py-1 rounded hover:bg-muted transition-colors"
                          onClick={() => setEditingItem({ type: 'restaurant', id: restaurant.id, field: 'descriptionI18n', lang: code, value: translated || '' })}
                        >
                          {translated ? (
                            <span>{translated}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Click to translate</span>
                          )}
                        </button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All Items ({menuContent.items.length})
        </Button>
        {menuContent.categories.map(cat => {
          const count = menuContent.items.filter(i => i.categoryId === cat.id).length;
          return (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name} ({count})
            </Button>
          );
        })}
      </div>

      {/* Menu Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Menu Items</CardTitle>
          <CardDescription>Translate names and descriptions for each menu item</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Item</TableHead>
                  <TableHead className="w-[80px]">Price</TableHead>
                  {translatableLangs.slice(0, 3).map(code => {
                    const lang = languages.find(l => l.code === code);
                    return (
                      <TableHead key={code} className="min-w-[160px]">
                        <div className="flex items-center gap-1">
                          <span>{lang?.flagEmoji}</span>
                          <span className="text-xs">{lang?.name || code}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatCents(item.priceCents)}</TableCell>
                    {translatableLangs.slice(0, 3).map(code => {
                      const translated = item.nameI18n[code];
                      const isEditing = editingItem?.type === 'item' && editingItem?.id === item.id && editingItem?.field === 'nameI18n' && editingItem?.lang === code;
                      return (
                        <TableCell key={code}>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Input
                                value={editingItem.value}
                                onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                                className="h-8 text-sm"
                                dir={languages.find(l => l.code === code)?.direction === 'rtl' ? 'rtl' : 'ltr'}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingItem(null); }}
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 shrink-0" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingItem(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="text-sm text-left min-h-[32px] w-full px-2 py-1 rounded hover:bg-muted transition-colors"
                              onClick={() => setEditingItem({ type: 'item', id: item.id, field: 'nameI18n', lang: code, value: translated || '' })}
                            >
                              {translated ? (
                                <span>{translated}</span>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Click to translate</span>
                              )}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Bulk AI Translate Dialog ── */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Bulk AI Translate
            </DialogTitle>
            <DialogDescription>
              Translate all {menuContent.items.length} menu items using your configured AI provider.
              This may take a minute for large menus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Target Languages</Label>
              <p className="text-xs text-muted-foreground">
                Uncheck any language you don&apos;t want to translate into right now.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {translatableLangs.map((code) => {
                  const lang = languages.find((l) => l.code === code);
                  const selected = effectiveTargetLangs.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleTargetLang(code)}
                      className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <span className="text-base">{lang?.flagEmoji || '🌐'}</span>
                      <span className="text-xs font-medium">{lang?.name || code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Overwrite existing translations</p>
                <p className="text-xs text-muted-foreground">
                  Replace translations that already exist for these languages.
                </p>
              </div>
              <Switch
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
              />
            </div>

            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              Requires AI to be configured in <span className="font-medium">Settings → AI Configuration</span>.
              Each request uses your own API key (YeneQR doesn&apos;t pay for AI).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button
              onClick={handleBulkTranslate}
              disabled={bulkTranslating || effectiveTargetLangs.length === 0}
            >
              {bulkTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Translate Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Language Manager
// ============================================================

function LanguageManager({
  languages,
  restaurantLangs,
  restaurantId,
  onUpdate,
}: {
  languages: LanguageEntry[];
  restaurantLangs: RestaurantLanguage[];
  restaurantId: string;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(
    new Set(restaurantLangs.filter(rl => rl.isActive).map(rl => rl.languageCode))
  );
  const [defaultCode, setDefaultCode] = useState<string>(
    restaurantLangs.find(rl => rl.isDefault)?.languageCode || 'en'
  );
  const [orderedCodes, setOrderedCodes] = useState<string[]>(
    restaurantLangs
      .filter(rl => rl.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(rl => rl.languageCode)
  );
  const [addDialogLang, setAddDialogLang] = useState<LanguageEntry | null>(null);
  const [addAsDefault, setAddAsDefault] = useState(false);

  // Sync state when props change
  useEffect(() => {
    const active = restaurantLangs.filter(rl => rl.isActive);
    setEnabledCodes(new Set(active.map(rl => rl.languageCode)));
    setDefaultCode(restaurantLangs.find(rl => rl.isDefault)?.languageCode || 'en');
    setOrderedCodes(
      active.sort((a, b) => a.sortOrder - b.sortOrder).map(rl => rl.languageCode)
    );
  }, [restaurantLangs]);

  // Computed: available (not yet enabled) and enabled languages
  const availableLangs = languages.filter(l => !enabledCodes.has(l.code));
  const enabledLangs = orderedCodes
    .map(code => languages.find(l => l.code === code))
    .filter(Boolean) as LanguageEntry[];

  const getCompletionPct = (code: string) => {
    const rl = restaurantLangs.find(r => r.languageCode === code);
    return rl?.completionPct ?? 0;
  };

  // ── Handlers ──

  const handleAddLanguage = (lang: LanguageEntry) => {
    setAddDialogLang(lang);
    setAddAsDefault(false);
  };

  const confirmAddLanguage = () => {
    if (!addDialogLang) return;
    const code = addDialogLang.code;
    const nextEnabled = new Set(enabledCodes);
    nextEnabled.add(code);
    setEnabledCodes(nextEnabled);
    setOrderedCodes(prev => [...prev, code]);
    if (addAsDefault) {
      setDefaultCode(code);
    }
    setAddDialogLang(null);
    setAddAsDefault(false);
  };

  const handleToggle = (code: string) => {
    if (enabledCodes.has(code)) {
      if (code === defaultCode) {
        toast.error('Cannot disable the default language. Change default first.');
        return;
      }
      const next = new Set(enabledCodes);
      next.delete(code);
      setEnabledCodes(next);
      setOrderedCodes(prev => prev.filter(c => c !== code));
    }
  };

  const handleSetDefault = (code: string) => {
    setDefaultCode(code);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setOrderedCodes(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedCodes.length - 1) return;
    setOrderedCodes(prev => {
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const langConfigs = orderedCodes.map((code, index) => ({
        code,
        isDefault: code === defaultCode,
        isActive: true,
        isRequired: code === 'en' || code === defaultCode,
        sortOrder: index,
      }));

      await api.put(`/api/restaurants/${restaurantId}/i18n/languages`, {
        defaultLanguage: defaultCode,
        languages: langConfigs,
      });

      toast.success('Language settings saved');
      onUpdate();
    } catch (err) {
      toast.error('Failed to save language settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    const originalActive = new Set(restaurantLangs.filter(rl => rl.isActive).map(rl => rl.languageCode));
    const originalDefault = restaurantLangs.find(rl => rl.isDefault)?.languageCode || 'en';
    const originalOrder = restaurantLangs
      .filter(rl => rl.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(rl => rl.languageCode)
      .join(',');
    if (defaultCode !== originalDefault) return true;
    if (enabledCodes.size !== originalActive.size) return true;
    for (const code of enabledCodes) {
      if (!originalActive.has(code)) return true;
    }
    if (orderedCodes.join(',') !== originalOrder) return true;
    return false;
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Quick Enable Presets at the top of Language Manager */}
      {availableLangs.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Enable
            </CardTitle>
            <CardDescription>Enable regional language groups with one click</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {REGIONAL_PRESETS.map((preset) => {
                const newCodes = preset.codes.filter(c => !enabledCodes.has(c));
                if (newCodes.length === 0) return null;
                return (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9"
                    onClick={() => {
                      const nextEnabled = new Set(enabledCodes);
                      for (const code of newCodes) {
                        nextEnabled.add(code);
                      }
                      setEnabledCodes(nextEnabled);
                      setOrderedCodes(prev => [...prev, ...newCodes]);
                      toast.success(`Added ${preset.name}: ${newCodes.map(c => languages.find(l => l.code === c)?.name || c).join(', ')}`);
                    }}
                  >
                    <span>{preset.icon}</span>
                    {preset.name}
                    <Badge variant="secondary" className="text-[10px] ml-1">+{newCodes.length}</Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-Section Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: Available Languages ── */}
        <Card className="rounded-xl shadow-sm border-0 overflow-hidden">
          <div className="bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/30 dark:to-background px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50">
                <Globe className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Available Languages</h3>
                <p className="text-xs text-muted-foreground">
                  {availableLangs.length} of {languages.length} not yet enabled
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <ScrollArea className="h-[520px]">
              <div className="grid gap-3 sm:grid-cols-2 pr-3">
                {availableLangs.map(lang => {
                  const completion = getCompletionPct(lang.code);
                  return (
                    <div
                      key={lang.code}
                      className="group rounded-xl border bg-card p-4 space-y-3 transition-all duration-200 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none mt-0.5">{lang.flagEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{lang.name}</p>
                            {lang.direction === 'rtl' && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                                RTL
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{lang.nameLocal}</p>
                        </div>
                      </div>

                      {/* Completion indicator for previously enabled languages */}
                      {completion > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Previously translated</span>
                            <span className={completion >= 80 ? 'text-green-600' : completion >= 40 ? 'text-amber-600' : 'text-red-500'}>
                              {completion}%
                            </span>
                          </div>
                          <Progress value={completion} className="h-1" />
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5 text-xs h-8 transition-all group-hover:bg-violet-50 group-hover:border-violet-300 group-hover:text-violet-700 dark:group-hover:bg-violet-950/50 dark:group-hover:border-violet-700 dark:group-hover:text-violet-300"
                        onClick={() => handleAddLanguage(lang)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Language
                      </Button>
                    </div>
                  );
                })}
                {availableLangs.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">All languages enabled</p>
                    <p className="text-xs mt-1">Every available language is already active for your restaurant</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ── Right: Your Languages ── */}
        <Card className="rounded-xl shadow-sm border-0 overflow-hidden">
          <div className="bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Your Languages</h3>
                <p className="text-xs text-muted-foreground">
                  {enabledLangs.length} language{enabledLangs.length !== 1 ? 's' : ''} enabled
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <ScrollArea className="h-[520px]">
              <div className="space-y-3 pr-3">
                {enabledLangs.map((lang, index) => {
                  const isDefault = defaultCode === lang.code;
                  const completion = getCompletionPct(lang.code);
                  const isSource = lang.code === 'en';

                  return (
                    <div
                      key={lang.code}
                      className={`rounded-xl border p-4 space-y-3 transition-all duration-200 group/card ${
                        isDefault
                          ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 shadow-sm'
                          : 'bg-card hover:shadow-sm'
                      }`}
                    >
                      {/* Top row: Flag, name, badges, reorder */}
                      <div className="flex items-center gap-3">
                        {/* Reorder controls */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-50 hover:opacity-100"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-50 hover:opacity-100"
                            disabled={index === enabledLangs.length - 1}
                            onClick={() => handleMoveDown(index)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Flag emoji — large and prominent */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50 shrink-0">
                          <span className="text-2xl leading-none">{lang.flagEmoji}</span>
                        </div>

                        {/* Name + native name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{lang.name}</p>
                            {isDefault && (
                              <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800">
                                <Star className="h-3 w-3 fill-current" />
                                Default
                              </Badge>
                            )}
                            {isSource && (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <Sparkles className="h-3 w-3" />
                                Source
                              </Badge>
                            )}
                            {lang.direction === 'rtl' && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                RTL
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">{lang.nameLocal}</p>
                        </div>

                        {/* Toggle switch */}
                        <Switch
                          checked={true}
                          onCheckedChange={() => handleToggle(lang.code)}
                          className="data-[state=checked]:bg-green-500"
                        />
                      </div>

                      {/* Completion Progress */}
                      <div className="ml-[68px] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Translation progress</span>
                          <span className={`font-medium ${
                            completion === 100 || isSource
                              ? 'text-green-600'
                              : completion >= 60
                                ? 'text-amber-600'
                                : 'text-red-500'
                          }`}>
                            {isSource ? '100%' : `${completion}%`}
                          </span>
                        </div>
                        <Progress
                          value={isSource ? 100 : completion}
                          className={`h-1.5 ${
                            completion === 100 || isSource
                              ? '[&>div]:bg-green-500'
                              : completion >= 60
                                ? '[&>div]:bg-amber-500'
                                : '[&>div]:bg-red-400'
                          }`}
                        />
                      </div>

                      {/* Action row — Set as Default + Translate */}
                      <div className="ml-[68px] flex items-center gap-2">
                        {!isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                            onClick={() => handleSetDefault(lang.code)}
                          >
                            <Star className="h-3 w-3" />
                            Set as Default
                          </Button>
                        )}
                        {lang.code !== 'en' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              toast.info(`Switch to the UI Strings or Menu Content tab to translate ${lang.name}`);
                            }}
                          >
                            <ArrowRight className="h-3 w-3" />
                            Translate
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {enabledLangs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Globe className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">No languages enabled</p>
                    <p className="text-xs mt-1">Add languages from the panel on the left</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── Save Bar ── */}
      {hasChanges() && (
        <div className="flex items-center gap-3 p-4 rounded-xl border bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center gap-2 flex-1">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">You have unsaved language changes</span>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Language Settings
          </Button>
        </div>
      )}

      {/* ── Add Language Confirmation Dialog ── */}
      <Dialog open={!!addDialogLang} onOpenChange={(open) => { if (!open) setAddDialogLang(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{addDialogLang?.flagEmoji}</span>
              Enable {addDialogLang?.name}
            </DialogTitle>
            <DialogDescription>
              Add {addDialogLang?.name} ({addDialogLang?.nameLocal}) as an available language for your restaurant. Customers will be able to view the menu in this language.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Language Preview */}
            <div className="rounded-xl border p-4 bg-muted/30 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{addDialogLang?.flagEmoji}</span>
                <div>
                  <p className="font-semibold">{addDialogLang?.name}</p>
                  <p className="text-sm text-muted-foreground">{addDialogLang?.nameLocal}</p>
                </div>
              </div>
              {addDialogLang?.direction === 'rtl' && (
                <Badge variant="outline" className="text-xs">Right-to-Left (RTL)</Badge>
              )}
            </div>

            {/* Set as Default Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Set as default language
                </label>
                <p className="text-xs text-muted-foreground">
                  This will replace the current default ({languages.find(l => l.code === defaultCode)?.name})
                </p>
              </div>
              <Switch
                checked={addAsDefault}
                onCheckedChange={setAddAsDefault}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddDialogLang(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAddLanguage} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Language
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
