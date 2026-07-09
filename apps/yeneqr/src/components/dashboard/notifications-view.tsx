'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { api, getTimeAgo } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  Bell,
  ShoppingCart,
  CreditCard,
  Headphones,
  Star,
  CheckCheck,
  Settings,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type NotificationType = 'order' | 'payment' | 'system' | 'waiter_call' | 'review';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bgColor: string }> = {
  order: { icon: ShoppingCart, color: 'text-primary', bgColor: 'bg-primary/10' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  system: { icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  waiter_call: { icon: Headphones, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  review: { icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
};

export function NotificationsView() {
  const { user, selectedBranchId, unreadNotificationCount, setUnreadNotificationCount, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificationsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[NotificationsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setNotifications([]);
    fetchNotificationsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  const fetchNotifications = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await api.get<{ data: NotificationData[] }>(`/api/restaurants/${restaurantId}/notifications`, params);
      const data = res.data || [];
      setNotifications(data);
      const unread = data.filter((n) => !n.isRead).length;
      setUnreadNotificationCount(unread);
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId, setUnreadNotificationCount]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, selectedBranchId, branchChangeVersion]);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setLoading(true);
    }
  }, [selectedBranchId]);

  const handleMarkAllRead = async () => {
    try {
      // Mark all as read locally (immediate UI feedback)
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);

      // Phase R2: Use the bulk mark-all-read endpoint (1 API call instead of N)
      const branchId = useAppStore.getState().selectedBranchId;
      await api.post(`/api/restaurants/${restaurantId}/notifications/mark-all-read`, {
        ...(branchId ? { branchId } : {}),
      });
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkRead = async (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    const newCount = notifications.filter((n) => !n.isRead && n.id !== id).length;
    setUnreadNotificationCount(newCount);

    // Update on server
    api.put(`/api/restaurants/${restaurantId}/notifications/${id}`, { isRead: true }).catch(() => {});
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/restaurants/${restaurantId}/notifications/${id}`);
      setNotifications(notifications.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleMarkAllRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((notification) => {
          const config = typeConfig[notification.type] || typeConfig.system;
          return (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-all hover:shadow-sm ${!notification.isRead ? 'border-l-4 border-l-primary bg-primary/[0.02]' : ''}`}
              onClick={() => handleMarkRead(notification.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                    <config.icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                      </span>
                      {!notification.isRead && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{getTimeAgo(notification.createdAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notification.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {notifications.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
