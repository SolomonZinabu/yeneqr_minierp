'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Clock,
  Users,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  X,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Types ─────────────────────────────────────────────────
interface ReservationInfo {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  partySize: number
  reservedDate: string
  reservedTime: string
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  specialRequests: string | null
  table?: { id: string; number: string; capacity: number } | null
  branch?: { id: string; name: string } | null
  createdAt: string
}

interface MyReservationsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  sessionToken: string | null
  t: (key: string, fallback: string) => string
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  no_show: { label: 'No Show', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: AlertCircle },
}

export default function MyReservations({
  open,
  onOpenChange,
  restaurantId,
  sessionToken,
  t,
}: MyReservationsProps) {
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Get saved phone from localStorage
  const getSavedPhone = useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(`yeneqr_reservation_phone_${restaurantId}`)
    } catch { return null }
  }, [restaurantId])

  // Fetch reservations
  // Phase 5.5 note: intentionally fetches ALL the customer's reservations across
  // all branches of this restaurant (not scoped to the current branch). A customer
  // may book at different branches and wants to see all their upcoming reservations
  // in one list. Each row shows branch.name so the customer can distinguish them.
  // The API endpoint (GET /api/restaurants/[id]/reservations/my) DOES support
  // ?branchId= filtering if a future UX decision wants a branch filter chip.
  const fetchReservations = useCallback(async () => {
    const phone = getSavedPhone()
    if (!phone || !sessionToken || !restaurantId) {
      setReservations([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `/api/restaurants/${restaurantId}/reservations/my?phone=${encodeURIComponent(phone)}`,
        {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        }
      )
      if (res.ok) {
        const data = await res.json()
        setReservations(data.data || [])
      } else {
        setReservations([])
      }
    } catch {
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [restaurantId, sessionToken, getSavedPhone])

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchReservations()
    }
  }, [open, fetchReservations])

  // Cancel a reservation
  const handleCancel = async (reservationId: string) => {
    if (!sessionToken || !restaurantId) return
    if (!confirm(t('reservation.confirm_cancel', 'Are you sure you want to cancel this reservation?'))) return

    setCancellingId(reservationId)
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/reservations/${reservationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ status: 'cancelled', cancellationReason: 'Cancelled by customer' }),
      })
      if (res.ok) {
        // Update local state
        setReservations(prev =>
          prev.map(r => r.id === reservationId ? { ...r, status: 'cancelled' as const } : r)
        )
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to cancel reservation')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const period = h < 12 ? 'AM' : 'PM'
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`
  }

  // Separate active and past reservations
  const now = new Date()
  const activeReservations = reservations.filter(r =>
    ['pending', 'confirmed'].includes(r.status) &&
    new Date(r.reservedDate) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const pastReservations = reservations.filter(r =>
    !activeReservations.includes(r)
  )

  const hasSavedPhone = !!getSavedPhone()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false)
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-brand" />
                <h2 className="text-lg font-bold">
                  {t('my_reservations.title', 'My Reservations')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchReservations}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {!hasSavedPhone ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('my_reservations.no_phone', 'No reservations found. Make a reservation first and it will appear here.')}
                  </p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {t('my_reservations.loading', 'Loading...')}
                  </span>
                </div>
              ) : reservations.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('my_reservations.empty', 'You don\'t have any reservations yet.')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Active Reservations */}
                  {activeReservations.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('my_reservations.upcoming', 'Upcoming')}
                      </h3>
                      {activeReservations.map((reservation) => {
                        const config = statusConfig[reservation.status] || statusConfig.pending
                        return (
                          <motion.div
                            key={reservation.id}
                            layout
                            className="rounded-2xl border border-border bg-card p-4 space-y-3"
                          >
                            {/* Status Badge */}
                            <div className="flex items-center justify-between">
                              <Badge className={`${config.bgColor} ${config.color} border-0 text-xs`}>
                                <config.icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(reservation.createdAt)}
                              </span>
                            </div>

                            {/* Reservation Details */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-1.5 text-sm">
                                <CalendarDays className="w-3.5 h-3.5 text-brand shrink-0" />
                                <span>{formatDate(reservation.reservedDate)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
                                <span>{formatTime(reservation.reservedTime)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Users className="w-3.5 h-3.5 text-brand shrink-0" />
                                <span>{reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}</span>
                              </div>
                              {reservation.table && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <span className="text-xs text-muted-foreground">Table {reservation.table.number}</span>
                                </div>
                              )}
                            </div>

                            {reservation.specialRequests && (
                              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
                                <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">Special Requests</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">{reservation.specialRequests}</p>
                              </div>
                            )}

                            {/* Cancel Button */}
                            {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                              <button
                                onClick={() => handleCancel(reservation.id)}
                                disabled={cancellingId === reservation.id}
                                className="text-xs text-red-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50"
                              >
                                {cancellingId === reservation.id
                                  ? t('reservation.cancelling', 'Cancelling...')
                                  : t('reservation.cancel_reservation', 'Cancel this reservation')
                                }
                              </button>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )}

                  {/* Past Reservations */}
                  {pastReservations.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('my_reservations.past', 'Past')}
                      </h3>
                      {pastReservations.slice(0, 10).map((reservation) => {
                        const config = statusConfig[reservation.status] || statusConfig.pending
                        return (
                          <div
                            key={reservation.id}
                            className="rounded-xl border border-border bg-card/50 p-3 opacity-70"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span>{formatDate(reservation.reservedDate)}</span>
                                <span className="text-muted-foreground">at</span>
                                <span>{formatTime(reservation.reservedTime)}</span>
                              </div>
                              <Badge className={`${config.bgColor} ${config.color} border-0 text-[10px] px-1.5 py-0`}>
                                {config.label}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border">
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold"
              >
                {t('my_reservations.close', 'Close')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
