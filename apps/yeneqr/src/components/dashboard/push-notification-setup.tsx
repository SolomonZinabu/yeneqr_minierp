'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff, Loader2, Check, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

type PermissionStatus = 'default' | 'granted' | 'denied'

export function PushNotificationSetup() {
  const [permission, setPermission] = useState<PermissionStatus>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Read actual permission after hydration to avoid SSR/client mismatch
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission as PermissionStatus)
    }
  }, [])

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Your browser does not support push notifications')
      return
    }

    if (!('serviceWorker' in navigator)) {
      toast.error('Service workers are not supported in your browser')
      return
    }

    setLoading(true)
    try {
      // Request notification permission
      const result = await Notification.requestPermission()
      setPermission(result as PermissionStatus)

      if (result !== 'granted') {
        toast.error('Notification permission was denied')
        return
      }

      // Register service worker (use existing or create registration)
      const registration = await navigator.serviceWorker.ready

      // Get VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        // If no VAPID key, just mark as subscribed (demo mode)
        setSubscribed(true)
        toast.success('Push notifications enabled (demo mode)')
        return
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      // Send subscription to backend
      const subJson = subscription.toJSON()
      await api.post('/api/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: (subJson.keys as Record<string, string>)?.p256dh,
        auth: (subJson.keys as Record<string, string>)?.auth,
      })

      setSubscribed(true)
      toast.success('Push notifications enabled successfully!')
    } catch (err) {
      console.error('[PUSH_SETUP_ERROR]', err)
      toast.error('Failed to enable push notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const subJson = subscription.toJSON()
        await subscription.unsubscribe()

        // Remove from backend
        await api.delete('/api/push/subscribe', {
          endpoint: subJson.endpoint,
        })
      }

      setSubscribed(false)
      toast.success('Push notifications disabled')
    } catch (err) {
      console.error('[PUSH_UNSUBSCRIBE_ERROR]', err)
      toast.error('Failed to disable push notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive instant push notifications for new orders, waiter calls, and payment alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status</span>
              {permission === 'granted' || subscribed ? (
                <Badge variant="default" className="text-xs gap-1">
                  <Check className="h-3 w-3" /> Enabled
                </Badge>
              ) : permission === 'denied' ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <BellOff className="h-3 w-3" /> Blocked
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Not configured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {permission === 'denied'
                ? 'Push notifications are blocked by your browser. Please update your browser settings to allow notifications.'
                : subscribed
                  ? 'You will receive push notifications for critical events.'
                  : 'Enable push notifications to get real-time alerts for orders and waiter calls.'}
            </p>
          </div>
          <Button
            size="sm"
            variant={subscribed ? 'outline' : 'default'}
            className="gap-1.5"
            disabled={loading || permission === 'denied'}
            onClick={subscribed ? unsubscribe : requestPermissionAndSubscribe}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : subscribed ? (
              <BellOff className="h-3.5 w-3.5" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            {subscribed ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
