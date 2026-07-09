'use client';

// ============================================================
// Yene QR — Audit Logs Dashboard View
// ============================================================
// Allows restaurant owners and managers to view a filterable,
// paginated list of audit log entries showing who did what,
// when, and what changed.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  Clock,
  FileText,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';

// ─── Types ──────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userType: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  previousData: string | null;
  newData: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogFilters {
  entityTypes: string[];
  actions: string[];
}

// ─── Action/Entity styling ──────────────────────────────────────

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  status_change: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  order_cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  refund_created: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  role_change: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  settings_updated: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  bulk_import_menu_items: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  bulk_update_availability: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  bulk_update_prices: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  bulk_delete_menu_items: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const entityIcons: Record<string, string> = {
  menuItem: '🍽️',
  order: '📋',
  promotion: '🏷️',
  restaurant_user: '👤',
  restaurant: '🏪',
  refund: '💰',
  ingredient: '🧂',
  inventoryItem: '📦',
  table: '🪑',
  customer: '👥',
};

function getActionColor(action: string): string {
  return actionColors[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300';
}

function getEntityIcon(entityType: string): string {
  return entityIcons[entityType] || '📄';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEntityType(entityType: string): string {
  return entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function tryParseJSON(str: string | null): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// ─── Component ──────────────────────────────────────────────────

export function AuditLogsView() {
  const { t } = useI18n();
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>({ entityTypes: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLogsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[AuditLogsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setLogs([]);
    fetchLogsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Filter state
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchEntityId, setSearchEntityId] = useState('');

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (branchId) params.set('branchId', branchId);
      if (filterEntityType && filterEntityType !== 'all') params.set('entityType', filterEntityType);
      if (filterAction && filterAction !== 'all') params.set('action', filterAction);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (searchEntityId) params.set('entityId', searchEntityId);

      const res = await api.get(`/api/restaurants/${restaurantId}/audit-logs?${params.toString()}`);
      if (res) {
        setLogs((res as any).data || []);
        setTotal((res as any).pagination?.total || 0);
        setTotalPages((res as any).pagination?.totalPages || 0);
        if ((res as any).filters) {
          setFilters((res as any).filters);
        }
      }
    } catch (err) {
      console.error('[AUDIT_LOGS_FETCH]', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, page, filterEntityType, filterAction, filterDateFrom, filterDateTo, searchEntityId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, selectedBranchId, branchChangeVersion]);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setLoading(true);
    }
  }, [selectedBranchId]);

  const handleExport = () => {
    if (!logs.length) return;
    const csv = [
      ['Timestamp', 'User', 'User Type', 'Action', 'Entity Type', 'Entity ID', 'IP Address'].join(','),
      ...logs.map((log) =>
        [
          new Date(log.createdAt).toISOString(),
          log.userId || 'system',
          log.userType || '',
          log.action,
          log.entityType,
          log.entityId || '',
          log.ipAddress || '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('dashboard.audit_logs', 'Audit Logs')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('dashboard.audit_logs_desc', 'Track all changes and actions across your restaurant')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!logs.length}>
              <Download className="h-4 w-4 mr-1" />
              {t('dashboard.export', 'Export')}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              <Filter className="h-3 w-3 inline mr-1" />
              {t('dashboard.entity_type', 'Entity Type')}
            </Label>
            <Select value={filterEntityType} onValueChange={(v) => { setFilterEntityType(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.all', 'All')}</SelectItem>
                {filters.entityTypes.map((et) => (
                  <SelectItem key={et} value={et}>{formatEntityType(et)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t('dashboard.action', 'Action')}
            </Label>
            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.all', 'All')}</SelectItem>
                {filters.actions.map((a) => (
                  <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('dashboard.from', 'From')}</Label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="h-8 w-[140px] text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('dashboard.to', 'To')}</Label>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
              className="h-8 w-[140px] text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              <Search className="h-3 w-3 inline mr-1" />
              {t('dashboard.entity_id', 'Entity ID')}
            </Label>
            <Input
              value={searchEntityId}
              onChange={(e) => setSearchEntityId(e.target.value)}
              placeholder="cuid..."
              className="h-8 w-[160px] text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchLogs(); } }}
            />
          </div>
        </div>
      </div>

      {/* Log List */}
      <ScrollArea className="flex-1">
        <div className="px-4 sm:px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t('dashboard.no_audit_logs', 'No audit logs found')}</p>
              <p className="text-sm">{t('dashboard.adjust_filters', 'Try adjusting your filters')}</p>
            </div>
          ) : (
            logs.map((log) => (
              <Card
                key={log.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedLog(log)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-lg shrink-0">{getEntityIcon(log.entityType)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${getActionColor(log.action)} border-0 text-[10px] font-bold`}>
                            {formatAction(log.action)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {formatEntityType(log.entityType)}
                          </span>
                          {log.entityId && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                              {log.entityId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.userType || 'system'}
                          </span>
                          {log.ipAddress && (
                            <span className="hidden sm:inline">{log.ipAddress}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t px-4 sm:px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {total} {t('dashboard.entries', 'entries')} • {t('dashboard.page', 'Page')} {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('dashboard.audit_log_detail', 'Audit Log Detail')}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.action', 'Action')}</p>
                  <Badge className={`${getActionColor(selectedLog.action)} border-0 text-xs font-bold mt-1`}>
                    {formatAction(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.entity_type', 'Entity Type')}</p>
                  <p className="font-medium mt-1">{getEntityIcon(selectedLog.entityType)} {formatEntityType(selectedLog.entityType)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.performed_by', 'Performed By')}</p>
                  <p className="font-medium mt-1">{selectedLog.userType || 'system'} {selectedLog.userId ? `(${selectedLog.userId.slice(0, 8)}...)` : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.timestamp', 'Timestamp')}</p>
                  <p className="font-medium mt-1">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('dashboard.ip_address', 'IP Address')}</p>
                    <p className="font-mono text-xs mt-1">{selectedLog.ipAddress}</p>
                  </div>
                )}
                {selectedLog.entityId && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('dashboard.entity_id', 'Entity ID')}</p>
                    <p className="font-mono text-xs mt-1">{selectedLog.entityId}</p>
                  </div>
                )}
              </div>

              {/* Previous Data */}
              {selectedLog.previousData && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboard.previous_data', 'Previous Data')}</p>
                  <pre className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs overflow-x-auto max-h-40">
                    {JSON.stringify(tryParseJSON(selectedLog.previousData), null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.newData && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboard.new_data', 'New Data')}</p>
                  <pre className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs overflow-x-auto max-h-40">
                    {JSON.stringify(tryParseJSON(selectedLog.newData), null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboard.user_agent', 'User Agent')}</p>
                  <p className="text-[10px] text-muted-foreground break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
