'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  CheckSquare,
  Square,
  X,
  ChevronDown,
  ChevronUp,
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
  // Trivia-specific
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

export function EntertainmentView() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('fact');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Preview panel
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  // ==================== Data Fetching ====================

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (activeTab) params.type = activeTab;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (search) params.search = search;

      const res = await api.get<{
        data: ContentItem[];
        pagination: { total: number };
      }>('/api/admin/entertainment', params);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load content';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, categoryFilter, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset selection on tab change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

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
    setFormData({ ...emptyForm, type: activeTab });
    setFormOpen(true);
  };

  const openEditDialog = (item: ContentItem) => {
    setEditingItem(item);

    const trivia = parseTriviaContent(item.content);
    let triviaMeta: Record<string, unknown> = {};
    try {
      triviaMeta = item.metadata ? JSON.parse(item.metadata) : {};
    } catch { /* empty */ }

    setFormData({
      type: item.type,
      category: item.category || 'general',
      title: item.title || '',
      titleAm: (() => {
        try {
          const i18n = item.titleI18n ? JSON.parse(item.titleI18n) : {};
          return i18n.am || '';
        } catch { return ''; }
      })(),
      content: item.type === 'trivia_question' && trivia ? trivia.question : item.content,
      contentAm: (() => {
        try {
          const i18n = item.contentI18n ? JSON.parse(item.contentI18n) : {};
          return i18n.am || '';
        } catch { return ''; }
      })(),
      imageUrl: item.imageUrl || '',
      metadata: item.metadata ? JSON.stringify(triviaMeta, null, 2) : '',
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
    setFormLoading(true);
    try {
      // Build content based on type
      let contentStr = formData.content;
      let metadata: Record<string, unknown> = {};

      if (formData.metadata) {
        try {
          metadata = JSON.parse(formData.metadata);
        } catch { /* keep empty */ }
      }

      if (formData.type === 'trivia_question') {
        const triviaData = {
          question: formData.triviaQuestion,
          options: formData.triviaOptions.filter((o) => o.trim() !== ''),
          correctIndex: formData.triviaCorrectIndex,
          explanation: formData.triviaExplanation || undefined,
        };
        contentStr = JSON.stringify(triviaData);
        metadata = { ...metadata, difficulty: formData.triviaDifficulty };
      }

      // Build i18n
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
        await api.put(`/api/admin/entertainment/${editingItem.id}`, payload);
        toast.success('Content updated');
      } else {
        await api.post('/api/admin/entertainment', payload);
        toast.success('Content created');
      }

      setFormOpen(false);
      await fetchItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save content';
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ==================== Toggle Active ====================

  const handleToggleActive = async (item: ContentItem) => {
    setToggleLoadingId(item.id);
    try {
      await api.put(`/api/admin/entertainment/${item.id}`, {
        isActive: !item.isActive,
      });
      toast.success(`Content ${item.isActive ? 'deactivated' : 'activated'}`);
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setToggleLoadingId(null);
    }
  };

  // ==================== Delete ====================

  const handleDelete = async () => {
    const { item } = deleteDialog;
    if (!item) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/entertainment/${item.id}`);
      toast.success('Content deleted');
      setDeleteDialog({ open: false, item: null });
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ==================== Bulk Actions ====================

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkToggle = async (activate: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.put(`/api/admin/entertainment/${id}`, { isActive: activate })
        )
      );
      toast.success(`${selectedIds.size} items ${activate ? 'activated' : 'deactivated'}`);
      setSelectedIds(new Set());
      await fetchItems();
    } catch (err: unknown) {
      toast.error('Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // ==================== Render ====================

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchItems}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Platform Entertainment</h2>
          <p className="text-sm text-muted-foreground">
            Manage default content shown to all restaurants
          </p>
        </div>
        <Button className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          New Content
        </Button>
      </div>

      {/* Tabs + Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
            {CONTENT_TYPES.map((ct) => (
              <TabsTrigger
                key={ct.value}
                value={ct.value}
                className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-3 py-2"
              >
                <ct.icon className="h-3.5 w-3.5" />
                {ct.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2 ml-auto">
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
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 mb-4">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleBulkToggle(true)}
              disabled={bulkLoading}
            >
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleBulkToggle(false)}
              disabled={bulkLoading}
            >
              Deactivate
            </Button>
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )}

        {/* Content per tab */}
        {CONTENT_TYPES.map((ct) => (
          <TabsContent key={ct.value} value={ct.value} className="mt-0">
            <ContentList
              items={items}
              loading={loading}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              allSelected={selectedIds.size === items.length && items.length > 0}
              onEdit={openEditDialog}
              onToggle={handleToggleActive}
              onDelete={(item) => setDeleteDialog({ open: true, item })}
              onPreview={setPreviewItem}
              toggleLoadingId={toggleLoadingId}
              getTypeIcon={getTypeIcon}
              getCategoryColor={getCategoryColor}
              parseTriviaContent={parseTriviaContent}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* ==================== Create/Edit Dialog ==================== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Content' : 'Create Content'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? `Update ${editingItem.type.replace('_', ' ')} content`
                : 'Add new entertainment content for the platform'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Type & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Content Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title with i18n */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Content title (optional)"
              />
              <Input
                value={formData.titleAm}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, titleAm: e.target.value }))
                }
                placeholder="Title in Amharic (optional)"
                className="text-sm"
              />
            </div>

            {/* Content / Trivia Editor */}
            {formData.type === 'trivia_question' ? (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Trivia Editor
                </h4>
                <div className="space-y-2">
                  <Label>Question *</Label>
                  <Textarea
                    value={formData.triviaQuestion}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        triviaQuestion: e.target.value,
                      }))
                    }
                    placeholder="Enter the trivia question..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Options</Label>
                  {formData.triviaOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold cursor-pointer shrink-0 ${
                          formData.triviaCorrectIndex === i
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            triviaCorrectIndex: i,
                          }))
                        }
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...formData.triviaOptions];
                          newOpts[i] = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            triviaOptions: newOpts,
                          }));
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className="flex-1"
                      />
                      {formData.triviaCorrectIndex === i && (
                        <Badge variant="default" className="text-[10px] shrink-0">
                          Correct
                        </Badge>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Click the letter circle to mark the correct answer
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Explanation</Label>
                  <Textarea
                    value={formData.triviaExplanation}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        triviaExplanation: e.target.value,
                      }))
                    }
                    placeholder="Explanation shown after answering..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={formData.triviaDifficulty}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, triviaDifficulty: v }))
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Enter content text..."
                  rows={5}
                />
                <Input
                  value={formData.contentAm}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contentAm: e.target.value }))
                  }
                  placeholder="Content in Amharic (optional)"
                  className="text-sm"
                />
              </div>
            )}

            {/* Image URL */}
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            {/* Metadata (for non-trivia) */}
            {formData.type !== 'trivia_question' && (
              <div className="space-y-2">
                <Label>Metadata (JSON)</Label>
                <Textarea
                  value={formData.metadata}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metadata: e.target.value }))
                  }
                  placeholder='{"key": "value"}'
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sortOrder: e.target.value }))
                  }
                  min="0"
                />
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Switch
                  id="content-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <Label htmlFor="content-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={handleFormSubmit} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Dialog ==================== */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Content</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.item?.title || 'this content'}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, item: null })}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Preview Panel ==================== */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          {previewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  {React.createElement(getTypeIcon(previewItem.type), {
                    className: 'h-4 w-4',
                  })}
                  {previewItem.title || previewItem.type.replace('_', ' ')}
                </DialogTitle>
                <DialogDescription>
                  <Badge
                    variant="outline"
                    className={`text-[10px] mr-2 ${getCategoryColor(previewItem.category)}`}
                  >
                    {previewItem.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      previewItem.isActive
                        ? 'text-emerald-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {previewItem.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {previewItem.imageUrl && (
                  <img
                    src={previewItem.imageUrl}
                    alt={previewItem.title || 'Content preview'}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                {previewItem.type === 'trivia_question' ? (
                  <div className="space-y-3">
                    {(() => {
                      const trivia = parseTriviaContent(previewItem.content);
                      if (!trivia) return <p className="text-sm">{previewItem.content}</p>;
                      return (
                        <>
                          <p className="text-sm font-medium">{trivia.question}</p>
                          <div className="space-y-1.5">
                            {trivia.options.map((opt, i) => (
                              <div
                                key={i}
                                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                                  i === trivia.correctIndex
                                    ? 'bg-emerald-500/10 border border-emerald-200'
                                    : 'bg-muted/50'
                                }`}
                              >
                                <span className="font-mono text-xs">
                                  {String.fromCharCode(65 + i)}.
                                </span>
                                <span>{opt}</span>
                                {i === trivia.correctIndex && (
                                  <Badge className="ml-auto text-[10px] bg-emerald-600">
                                    Correct
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          {trivia.explanation && (
                            <p className="text-xs text-muted-foreground italic">
                              {trivia.explanation}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
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

// ==================== Content List Sub-component ====================

function ContentList({
  items,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  onEdit,
  onToggle,
  onDelete,
  onPreview,
  toggleLoadingId,
  getTypeIcon,
  getCategoryColor,
  parseTriviaContent,
}: {
  items: ContentItem[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  onEdit: (item: ContentItem) => void;
  onToggle: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  onPreview: (item: ContentItem) => void;
  toggleLoadingId: string | null;
  getTypeIcon: (type: string) => React.ElementType;
  getCategoryColor: (cat: string | null) => string;
  parseTriviaContent: (content: string) => {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  } | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No content found. Create your first item.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Select All */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
        <span className="text-xs text-muted-foreground">
          Select all ({items.length} items)
        </span>
      </div>

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
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className={`overflow-hidden ${!item.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => onToggleSelect(item.id)}
                        className="mt-1"
                      />

                      {/* Icon */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">
                            {item.title || item.content.slice(0, 60)}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${getCategoryColor(item.category)}`}
                          >
                            {item.category}
                          </Badge>
                          {!item.isActive && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.type === 'trivia_question'
                            ? (() => {
                                const trivia = parseTriviaContent(item.content);
                                return trivia?.question || item.content.slice(0, 80);
                              })()
                            : item.content.slice(0, 80)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onPreview(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${
                            item.isActive
                              ? 'text-amber-600 hover:text-amber-700'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                          onClick={() => onToggle(item)}
                          disabled={toggleLoadingId === item.id}
                        >
                          {toggleLoadingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
