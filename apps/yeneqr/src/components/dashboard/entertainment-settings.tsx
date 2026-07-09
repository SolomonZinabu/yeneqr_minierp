'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  BookOpen,
  Lightbulb,
  BookText,
  HelpCircle,
  Gamepad2,
  Eye,
  ToggleLeft,
  Settings,
  Save,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== Types ====================

interface ContentItem {
  id: string;
  restaurantId: string | null;
  type: string;
  category: string | null;
  title: string | null;
  titleI18n: string | null;
  content: string;
  contentI18n: string | null;
  imageUrl: string | null;
  metadata: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EntSettings {
  hubEnabled: boolean;
  games: { snake: boolean; '2048': boolean; memory: boolean; trivia: boolean };
  contentTypes: { facts: boolean; stories: boolean; reads: boolean };
}

interface ContentFormData {
  type: string;
  category: string;
  title: string;
  titleAm: string;
  content: string;
  contentAm: string;
  imageUrl: string;
  metadata: string;
  isActive: boolean;
  sortOrder: string;
  triviaQuestion: string;
  triviaOptions: string[];
  triviaCorrectIndex: number;
  triviaExplanation: string;
  triviaDifficulty: string;
}

const CONTENT_TYPES = [
  { value: 'fact', label: 'Facts', icon: Lightbulb },
  { value: 'story', label: 'Stories', icon: BookOpen },
  { value: 'read', label: 'Reads', icon: BookText },
  { value: 'trivia_question', label: 'Trivia', icon: HelpCircle },
  { value: 'game_config', label: 'Game Config', icon: Gamepad2 },
];

const CATEGORIES = ['food', 'culture', 'science', 'history', 'general'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const defaultSettings: EntSettings = {
  hubEnabled: true,
  games: { snake: true, '2048': true, memory: true, trivia: true },
  contentTypes: { facts: true, stories: true, reads: true },
};

const emptyForm: ContentFormData = {
  type: 'fact',
  category: 'general',
  title: '',
  titleAm: '',
  content: '',
  contentAm: '',
  imageUrl: '',
  metadata: '',
  isActive: true,
  sortOrder: '0',
  triviaQuestion: '',
  triviaOptions: ['', '', '', ''],
  triviaCorrectIndex: 0,
  triviaExplanation: '',
  triviaDifficulty: 'medium',
};

// ==================== Component ====================

export function EntertainmentSettings() {
  const { user } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [contentTab, setContentTab] = useState('fact');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Entertainment settings state
  const [entSettings, setEntSettings] = useState<EntSettings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [formData, setFormData] = useState<ContentFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ContentItem | null }>({
    open: false,
    item: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggle loading
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // Preview
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  // ==================== Data Fetching ====================

  const fetchItems = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (contentTab) params.type = contentTab;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (search) params.search = search;

      const res = await api.get<{
        data: ContentItem[];
        pagination: { total: number };
      }>(`/api/restaurants/${restaurantId}/entertainment/manage`, params);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load content';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, contentTab, categoryFilter, search]);

  const fetchSettings = useCallback(async () => {
    if (!restaurantId) return;
    setSettingsLoading(true);
    try {
      const res = await api.get<{
        data: { settings: Record<string, unknown> | null };
      }>(`/api/restaurants/${restaurantId}/settings`);

      const rawSettings = res.data?.settings as Record<string, unknown> | null;
      const entConfig = (rawSettings?.entertainment as Record<string, unknown>) || {};

      setEntSettings({
        hubEnabled: entConfig.hubEnabled !== false,
        games: {
          snake: (entConfig.games as Record<string, boolean>)?.snake !== false,
          '2048': (entConfig.games as Record<string, boolean>)?.['2048'] !== false,
          memory: (entConfig.games as Record<string, boolean>)?.memory !== false,
          trivia: (entConfig.games as Record<string, boolean>)?.trivia !== false,
        },
        contentTypes: {
          facts: (entConfig.contentTypes as Record<string, boolean>)?.facts !== false,
          stories: (entConfig.contentTypes as Record<string, boolean>)?.stories !== false,
          reads: (entConfig.contentTypes as Record<string, boolean>)?.reads !== false,
        },
      });
    } catch {
      // Use defaults
    } finally {
      setSettingsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ==================== Settings Save ====================

  const handleSaveSettings = async () => {
    if (!restaurantId) return;
    setSettingsSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        settings: {
          entertainment: entSettings,
        },
      });
      toast.success('Entertainment settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ==================== Helpers ====================

  const parseTriviaContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as { question: string; options: string[]; correctIndex: number; explanation?: string };
      }
    } catch { /* not trivia JSON */ }
    return null;
  };

  const getTypeIcon = (type: string) => {
    const found = CONTENT_TYPES.find((t) => t.value === type);
    return found ? found.icon : BookOpen;
  };

  const getCategoryColor = (cat: string | null) => {
    const colors: Record<string, string> = {
      food: 'bg-orange-500/10 text-orange-700 border-orange-200',
      culture: 'bg-purple-500/10 text-purple-700 border-purple-200',
      science: 'bg-teal-500/10 text-teal-700 border-teal-200',
      history: 'bg-amber-500/10 text-amber-700 border-amber-200',
      general: 'bg-gray-500/10 text-gray-700 border-gray-200',
    };
    return colors[cat || 'general'] || colors.general;
  };

  // ==================== Form Handlers ====================

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({ ...emptyForm, type: contentTab });
    setFormOpen(true);
  };

  const openEditDialog = (item: ContentItem) => {
    setEditingItem(item);
    const trivia = parseTriviaContent(item.content);
    let triviaMeta: Record<string, unknown> = {};
    try { triviaMeta = item.metadata ? JSON.parse(item.metadata) : {}; } catch { /* empty */ }

    setFormData({
      type: item.type,
      category: item.category || 'general',
      title: item.title || '',
      titleAm: (() => { try { const i = item.titleI18n ? JSON.parse(item.titleI18n) : {}; return i.am || ''; } catch { return ''; } })(),
      content: item.type === 'trivia_question' && trivia ? trivia.question : item.content,
      contentAm: (() => { try { const i = item.contentI18n ? JSON.parse(item.contentI18n) : {}; return i.am || ''; } catch { return ''; } })(),
      imageUrl: item.imageUrl || '',
      metadata: item.metadata || '',
      isActive: item.isActive,
      sortOrder: String(item.sortOrder),
      triviaQuestion: trivia?.question || '',
      triviaOptions: trivia?.options || ['', '', '', ''],
      triviaCorrectIndex: trivia?.correctIndex ?? 0,
      triviaExplanation: trivia?.explanation || '',
      triviaDifficulty: (triviaMeta as Record<string, unknown>)?.difficulty as string || 'medium',
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!restaurantId) return;
    setFormLoading(true);
    try {
      let contentStr = formData.content;
      let metadata: Record<string, unknown> = {};
      if (formData.metadata) { try { metadata = JSON.parse(formData.metadata); } catch { /* empty */ } }

      if (formData.type === 'trivia_question') {
        contentStr = JSON.stringify({
          question: formData.triviaQuestion,
          options: formData.triviaOptions.filter((o) => o.trim()),
          correctIndex: formData.triviaCorrectIndex,
          explanation: formData.triviaExplanation || undefined,
        });
        metadata = { ...metadata, difficulty: formData.triviaDifficulty };
      }

      const titleI18n: Record<string, string> = {};
      if (formData.titleAm) titleI18n.am = formData.titleAm;
      const contentI18n: Record<string, string> = {};
      if (formData.contentAm) contentI18n.am = formData.contentAm;

      const payload: Record<string, unknown> = {
        type: formData.type,
        category: formData.category || null,
        title: formData.title || null,
        titleI18n: Object.keys(titleI18n).length > 0 ? titleI18n : undefined,
        content: contentStr,
        contentI18n: Object.keys(contentI18n).length > 0 ? contentI18n : undefined,
        imageUrl: formData.imageUrl || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        isActive: formData.isActive,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };

      if (editingItem) {
        await api.put(
          `/api/restaurants/${restaurantId}/entertainment/manage/${editingItem.id}`,
          payload
        );
        toast.success('Content updated');
      } else {
        await api.post(
          `/api/restaurants/${restaurantId}/entertainment/manage`,
          payload
        );
        toast.success('Content created');
      }

      setFormOpen(false);
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (item: ContentItem) => {
    if (!restaurantId) return;
    setToggleLoadingId(item.id);
    try {
      await api.put(
        `/api/restaurants/${restaurantId}/entertainment/manage/${item.id}`,
        { isActive: !item.isActive }
      );
      toast.success(`Content ${item.isActive ? 'deactivated' : 'activated'}`);
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleDelete = async () => {
    const { item } = deleteDialog;
    if (!item || !restaurantId) return;
    setDeleteLoading(true);
    try {
      await api.delete(
        `/api/restaurants/${restaurantId}/entertainment/manage/${item.id}`
      );
      toast.success('Content deleted');
      setDeleteDialog({ open: false, item: null });
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ==================== Render ====================

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center py-12">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">No restaurant selected</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Entertainment Hub
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure entertainment content and settings for your restaurant
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="content"
            className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-3 py-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Content
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-3 py-2"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ==================== Content Tab ==================== */}
        <TabsContent value="content" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Button className="gap-1.5" size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              New Content
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-48"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub-tabs for content types */}
          <div className="flex flex-wrap gap-1">
            {CONTENT_TYPES.map((ct) => (
              <Button
                key={ct.value}
                size="sm"
                variant={contentTab === ct.value ? 'default' : 'outline'}
                onClick={() => setContentTab(ct.value)}
                className="h-8 text-xs gap-1"
              >
                <ct.icon className="h-3 w-3" />
                {ct.label}
              </Button>
            ))}
          </div>

          {/* Content List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchItems}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No content yet. Create your first item.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {items.map((item) => {
                    const Icon = getTypeIcon(item.type);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className={`overflow-hidden ${!item.isActive ? 'opacity-60' : ''}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium truncate">
                                    {item.title || item.content.slice(0, 50)}
                                  </h4>
                                  <Badge variant="outline" className={`text-[10px] shrink-0 ${getCategoryColor(item.category)}`}>
                                    {item.category}
                                  </Badge>
                                  {!item.isActive && (
                                    <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {item.type === 'trivia_question'
                                    ? (() => { const t = parseTriviaContent(item.content); return t?.question || item.content.slice(0, 60); })()
                                    : item.content.slice(0, 60)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewItem(item)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 ${item.isActive ? 'text-amber-600' : 'text-emerald-600'}`}
                                  onClick={() => handleToggleActive(item)}
                                  disabled={toggleLoadingId === item.id}
                                >
                                  {toggleLoadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDialog({ open: true, item })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ==================== Settings Tab ==================== */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Hub Toggle */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Entertainment Hub
                  </CardTitle>
                  <CardDescription>
                    Enable or disable the entire entertainment hub for your customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable Entertainment Hub</p>
                      <p className="text-xs text-muted-foreground">
                        Customers will see games and content while waiting
                      </p>
                    </div>
                    <Switch
                      checked={entSettings.hubEnabled}
                      onCheckedChange={(checked) =>
                        setEntSettings((prev) => ({ ...prev, hubEnabled: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Games */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    Available Games
                  </CardTitle>
                  <CardDescription>
                    Choose which games customers can play
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: 'snake' as const, label: 'Snake', desc: 'Classic snake game' },
                    { key: '2048' as const, label: '2048', desc: 'Number puzzle game' },
                    { key: 'memory' as const, label: 'Memory', desc: 'Card matching game' },
                    { key: 'trivia' as const, label: 'Trivia', desc: 'Question & answer game' },
                  ].map((game) => (
                    <div key={game.key} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{game.label}</p>
                        <p className="text-xs text-muted-foreground">{game.desc}</p>
                      </div>
                      <Switch
                        checked={entSettings.games[game.key]}
                        onCheckedChange={(checked) =>
                          setEntSettings((prev) => ({
                            ...prev,
                            games: { ...prev.games, [game.key]: checked },
                          }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Content Types */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Content Types
                  </CardTitle>
                  <CardDescription>
                    Toggle which content types appear in the hub
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: 'facts' as const, label: 'Fun Facts', desc: 'Interesting food and culture facts', icon: Lightbulb },
                    { key: 'stories' as const, label: 'Stories', desc: 'Short stories and anecdotes', icon: BookOpen },
                    { key: 'reads' as const, label: 'Reads', desc: 'Articles and longer reads', icon: BookText },
                  ].map((ct) => (
                    <div key={ct.key} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          <ct.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ct.label}</p>
                          <p className="text-xs text-muted-foreground">{ct.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={entSettings.contentTypes[ct.key]}
                        onCheckedChange={(checked) =>
                          setEntSettings((prev) => ({
                            ...prev,
                            contentTypes: { ...prev.contentTypes, [ct.key]: checked },
                          }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex justify-end">
                <Button className="gap-1.5" onClick={handleSaveSettings} disabled={settingsSaving}>
                  {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== Create/Edit Dialog ==================== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Content' : 'Create Content'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update entertainment content' : 'Add new entertainment content for your restaurant'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Content Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((ct) => (<SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Content title (optional)" />
              <Input value={formData.titleAm} onChange={(e) => setFormData((p) => ({ ...p, titleAm: e.target.value }))} placeholder="Title in Amharic" className="text-sm" />
            </div>

            {formData.type === 'trivia_question' ? (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trivia Editor</h4>
                <div className="space-y-2">
                  <Label>Question *</Label>
                  <Textarea value={formData.triviaQuestion} onChange={(e) => setFormData((p) => ({ ...p, triviaQuestion: e.target.value }))} placeholder="Enter the trivia question..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Options</Label>
                  {formData.triviaOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold cursor-pointer shrink-0 ${
                          formData.triviaCorrectIndex === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                        onClick={() => setFormData((p) => ({ ...p, triviaCorrectIndex: i }))}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <Input value={opt} onChange={(e) => { const o = [...formData.triviaOptions]; o[i] = e.target.value; setFormData((p) => ({ ...p, triviaOptions: o })); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1" />
                      {formData.triviaCorrectIndex === i && <Badge variant="default" className="text-[10px] shrink-0">Correct</Badge>}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Click the letter circle to mark the correct answer</p>
                </div>
                <div className="space-y-2">
                  <Label>Explanation</Label>
                  <Textarea value={formData.triviaExplanation} onChange={(e) => setFormData((p) => ({ ...p, triviaExplanation: e.target.value }))} placeholder="Explanation shown after answering..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={formData.triviaDifficulty} onValueChange={(v) => setFormData((p) => ({ ...p, triviaDifficulty: v }))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{DIFFICULTIES.map((d) => (<SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea value={formData.content} onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))} placeholder="Enter content text..." rows={5} />
                <Input value={formData.contentAm} onChange={(e) => setFormData((p) => ({ ...p, contentAm: e.target.value }))} placeholder="Content in Amharic" className="text-sm" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={formData.imageUrl} onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>

            {formData.type !== 'trivia_question' && (
              <div className="space-y-2">
                <Label>Metadata (JSON)</Label>
                <Textarea value={formData.metadata} onChange={(e) => setFormData((p) => ({ ...p, metadata: e.target.value }))} placeholder='{"key": "value"}' rows={3} className="font-mono text-xs" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={formData.sortOrder} onChange={(e) => setFormData((p) => ({ ...p, sortOrder: e.target.value }))} min="0" />
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Switch id="r-content-active" checked={formData.isActive} onCheckedChange={(c) => setFormData((p) => ({ ...p, isActive: c }))} />
                <Label htmlFor="r-content-active" className="cursor-pointer">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button onClick={handleFormSubmit} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Dialog ==================== */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Content</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.item?.title || 'this content'}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, item: null })} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Preview ==================== */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          {previewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  {React.createElement(getTypeIcon(previewItem.type), { className: 'h-4 w-4' })}
                  {previewItem.title || previewItem.type.replace('_', ' ')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {previewItem.imageUrl && (
                  <img src={previewItem.imageUrl} alt={previewItem.title || 'Preview'} className="w-full h-48 object-cover rounded-lg" />
                )}
                {previewItem.type === 'trivia_question' ? (
                  (() => {
                    const t = parseTriviaContent(previewItem.content);
                    if (!t) return <p className="text-sm">{previewItem.content}</p>;
                    return (
                      <>
                        <p className="text-sm font-medium">{t.question}</p>
                        <div className="space-y-1.5">
                          {t.options.map((opt, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 rounded-md text-sm ${i === t.correctIndex ? 'bg-emerald-500/10 border border-emerald-200' : 'bg-muted/50'}`}>
                              <span className="font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
                              <span>{opt}</span>
                              {i === t.correctIndex && <Badge className="ml-auto text-[10px] bg-emerald-600">Correct</Badge>}
                            </div>
                          ))}
                        </div>
                        {t.explanation && <p className="text-xs text-muted-foreground italic">{t.explanation}</p>}
                      </>
                    );
                  })()
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{previewItem.content}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
