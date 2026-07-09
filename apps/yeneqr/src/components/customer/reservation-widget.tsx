'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  MessageSquare,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

// ─── i18n helpers (mirrors the page pattern) ────────────────
// We import tuiGlobal from the page's global context —
// but since this is a separate file, we replicate a lightweight version
// that the parent will provide via props.

interface ReservationWidgetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  branchId: string
  sessionToken: string | null
  restaurantName?: string
  /** Translation helper — the parent page's tuiGlobal function */
  t: (key: string, fallback: string) => string
}

// ─── Generate time slots from 08:00 to 22:00 in 30-min intervals ──
function generateTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = []
  for (let h = 8; h < 22; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const value = `${hh}:${mm}`
      const period = h < 12 ? 'AM' : 'PM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      const label = `${displayH}:${mm} ${period}`
      slots.push({ value, label })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

type ReservationStep = 'form' | 'submitting' | 'success' | 'error'

export default function ReservationWidget({
  open,
  onOpenChange,
  restaurantId,
  branchId,
  sessionToken,
  restaurantName = 'Restaurant',
  t,
}: ReservationWidgetProps) {
  // Form state — pre-fill phone/name from localStorage if available
  const [reservedDate, setReservedDate] = useState('')
  const [reservedTime, setReservedTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const saved = localStorage.getItem(`yeneqr_reservation_name_${restaurantId}`)
      return saved || ''
    } catch { return '' }
  })
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const saved = localStorage.getItem(`yeneqr_reservation_phone_${restaurantId}`)
      return saved || ''
    } catch { return '' }
  })
  const [customerEmail, setCustomerEmail] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const saved = localStorage.getItem(`yeneqr_reservation_email_${restaurantId}`)
      return saved || ''
    } catch { return '' }
  })
  const [specialRequests, setSpecialRequests] = useState('')

  // UI state
  const [step, setStep] = useState<ReservationStep>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // ── Validation ──
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const minDateStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }, [])

  const maxDateStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30) // Allow reservations up to 30 days ahead
    return d.toISOString().split('T')[0]
  }, [])

  // Filter out past time slots for today
  const availableTimeSlots = useMemo(() => {
    if (!reservedDate) return TIME_SLOTS
    const now = new Date()
    const selectedDate = new Date(reservedDate + 'T00:00:00')
    const isToday =
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()

    if (!isToday) return TIME_SLOTS

    // Filter out slots that are in the past (add 30min buffer)
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30
    return TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.value.split(':').map(Number)
      return h * 60 + m > currentMinutes
    })
  }, [reservedDate])

  const isDateValid = useMemo(() => {
    if (!reservedDate) return false
    const d = new Date(reservedDate + 'T00:00:00')
    return d >= today
  }, [reservedDate, today])

  const isFormValid = useMemo(() => {
    return (
      isDateValid &&
      reservedTime !== '' &&
      partySize >= 1 &&
      customerName.trim().length >= 2 &&
      customerPhone.trim().length >= 7
    )
  }, [isDateValid, reservedTime, partySize, customerName, customerPhone])

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setReservedDate('')
    setReservedTime('')
    setPartySize(2)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setSpecialRequests('')
    setStep('form')
    setErrorMessage('')
    setReservationId(null)
    setCancelling(false)
  }, [])

  // ── Handle drawer close ──
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && step === 'submitting') return // Don't close while submitting
      onOpenChange(isOpen)
      // Reset after close animation
      if (!isOpen) {
        setTimeout(resetForm, 300)
      }
    },
    [onOpenChange, step, resetForm]
  )

  // ── Submit reservation ──
  const handleSubmit = useCallback(async () => {
    if (!sessionToken || !isFormValid) return

    setStep('submitting')
    setErrorMessage('')

    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          branchId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          partySize,
          reservedDate,
          reservedTime,
          specialRequests: specialRequests.trim() || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setReservationId(data.data?.id || null)
        setStep('success')

        // Persist customer info to localStorage for reservation recovery
        if (typeof window !== 'undefined' && customerPhone.trim()) {
          try {
            localStorage.setItem(`yeneqr_reservation_phone_${restaurantId}`, customerPhone.trim())
            localStorage.setItem(`yeneqr_reservation_name_${restaurantId}`, customerName.trim())
            if (customerEmail.trim()) {
              localStorage.setItem(`yeneqr_reservation_email_${restaurantId}`, customerEmail.trim())
            }
            // Also add to the global list of reservation phones
            const phonesKey = 'yeneqr_reservation_phones'
            const existing = JSON.parse(localStorage.getItem(phonesKey) || '{}')
            existing[restaurantId] = customerPhone.trim()
            localStorage.setItem(phonesKey, JSON.stringify(existing))
          } catch { /* ignore */ }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(
          data.error || t('reservation.error_default', 'Failed to create reservation. Please try again.')
        )
        setStep('error')
      }
    } catch {
      setErrorMessage(t('reservation.error_network', 'Network error. Please check your connection and try again.'))
      setStep('error')
    }
  }, [
    sessionToken,
    isFormValid,
    restaurantId,
    branchId,
    customerName,
    customerPhone,
    customerEmail,
    partySize,
    reservedDate,
    reservedTime,
    specialRequests,
    t,
  ])

  // ── Format date for display ──
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto max-h-[85vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand" />
              {t('reservation.title', 'Reserve a Table')}
            </DrawerTitle>
            <DrawerDescription>
              {step === 'success'
                ? t('reservation.success_desc', 'Your reservation request has been submitted!')
                : t('reservation.desc', `Book a table at ${restaurantName}`)
              }
            </DrawerDescription>
          </DrawerHeader>

          <AnimatePresence mode="wait">
            {/* ─── Success State ─── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center px-6 py-10 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                  className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </motion.div>

                <h3 className="text-xl font-bold mb-2">
                  {t('reservation.success_title', 'Reservation Submitted!')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {t('reservation.success_message', 'We\'ll confirm your reservation shortly. You\'ll receive a confirmation via phone.')}
                </p>

                {/* Reservation Summary */}
                <div className="w-full max-w-xs bg-muted/50 rounded-2xl p-4 text-left space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-brand shrink-0" />
                    <span>{formatDateDisplay(reservedDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-brand shrink-0" />
                    <span>
                      {TIME_SLOTS.find((s) => s.value === reservedTime)?.label || reservedTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-brand shrink-0" />
                    <span>
                      {partySize} {partySize === 1 ? t('reservation.guest', 'guest') : t('reservation.guests', 'guests')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-brand shrink-0" />
                    <span>{customerName}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleOpenChange(false)}
                  className="w-full max-w-xs h-12 rounded-2xl bg-brand hover:bg-brand-dark text-white font-semibold"
                >
                  {t('reservation.done', 'Done')}
                </Button>

                {/* Cancel Reservation Button */}
                {reservationId && (
                  <button
                    onClick={async () => {
                      if (!sessionToken || !reservationId || !restaurantId) return
                      if (!confirm(t('reservation.confirm_cancel', 'Are you sure you want to cancel this reservation?'))) return
                      setCancelling(true)
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
                          setCancelling(false)
                          handleOpenChange(false)
                        } else {
                          setCancelling(false)
                          const data = await res.json().catch(() => ({}))
                          alert(data.error || 'Failed to cancel reservation')
                        }
                      } catch {
                        setCancelling(false)
                        alert('Network error. Please try again.')
                      }
                    }}
                    disabled={cancelling}
                    className="mt-3 text-sm text-red-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    {cancelling ? t('reservation.cancelling', 'Cancelling...') : t('reservation.cancel_reservation', 'Cancel this reservation')}
                  </button>
                )}
              </motion.div>
            )}

            {/* ─── Error State ─── */}
            {step === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center px-6 py-10 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-5">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {t('reservation.error_title', 'Reservation Failed')}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  {errorMessage}
                </p>
                <div className="flex gap-3 w-full max-w-xs">
                  <Button
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    className="flex-1 rounded-xl"
                  >
                    {t('reservation.close', 'Close')}
                  </Button>
                  <Button
                    onClick={() => setStep('form')}
                    className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white"
                  >
                    {t('reservation.try_again', 'Try Again')}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ─── Form State ─── */}
            {(step === 'form' || step === 'submitting') && (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 py-4 space-y-5"
              >
                {/* Date Picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-brand" />
                    {t('reservation.date', 'Date')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <input
                      type="date"
                      value={reservedDate}
                      onChange={(e) => {
                        setReservedDate(e.target.value)
                        setReservedTime('') // Reset time when date changes
                      }}
                      min={minDateStr}
                      max={maxDateStr}
                      className="w-full h-11 px-4 rounded-xl bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                  {reservedDate && !isDateValid && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {t('reservation.date_past', 'Please select a future date')}
                    </p>
                  )}
                </div>

                {/* Time Slot Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand" />
                    {t('reservation.time', 'Time')} <span className="text-red-500">*</span>
                  </Label>
                  {reservedDate ? (
                    availableTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto rounded-xl bg-muted/50 p-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {availableTimeSlots.map((slot) => (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => setReservedTime(slot.value)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                              reservedTime === slot.value
                                ? 'bg-brand text-white shadow-sm'
                                : 'bg-card border border-border hover:border-brand/30'
                            }`}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30">
                        <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                          {t('reservation.no_slots', 'No available time slots for today. Please select another date.')}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {t('reservation.select_date_first', 'Please select a date first')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Party Size */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand" />
                    {t('reservation.party_size', 'Party Size')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPartySize(Math.max(1, partySize - 1))}
                      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <span className="text-lg font-bold">−</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold w-10 text-center">{partySize}</span>
                      <span className="text-xs text-muted-foreground">
                        {partySize === 1
                          ? t('reservation.guest', 'guest')
                          : t('reservation.guests', 'guests')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPartySize(Math.min(20, partySize + 1))}
                      className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <span className="text-lg font-bold">+</span>
                    </button>
                  </div>
                </div>

                {/* Customer Name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <User className="w-4 h-4 text-brand" />
                    {t('reservation.name', 'Your Name')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder={t('reservation.name_placeholder', 'e.g. Abebe Kebede')}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-brand/30"
                    maxLength={100}
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-brand" />
                    {t('reservation.phone', 'Phone Number')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder={t('reservation.phone_placeholder', 'e.g. +251 912 345 678')}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-brand/30"
                    maxLength={20}
                  />
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-brand" />
                    {t('reservation.email', 'Email')}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({t('reservation.optional', 'optional')})
                    </span>
                  </Label>
                  <Input
                    type="email"
                    placeholder={t('reservation.email_placeholder', 'e.g. abebe@email.com')}
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-brand/30"
                    maxLength={200}
                  />
                </div>

                {/* Special Requests */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-brand" />
                    {t('reservation.special_requests', 'Special Requests')}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({t('reservation.optional', 'optional')})
                    </span>
                  </Label>
                  <Textarea
                    placeholder={t('reservation.special_requests_placeholder', 'e.g. High chair needed, birthday celebration...')}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="min-h-[80px] rounded-xl bg-muted border-0 resize-none focus-visible:ring-brand/30"
                    maxLength={500}
                  />
                </div>

                {/* Submit Button */}
                <div className="pb-4 pt-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={!isFormValid || step === 'submitting'}
                    className="w-full h-14 rounded-2xl bg-brand hover:bg-brand-dark text-white font-semibold text-base shadow-lg shadow-brand/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
                  >
                    {step === 'submitting' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('reservation.submitting', 'Submitting...')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        {t('reservation.submit', 'Reserve Table')}
                      </span>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    {t('reservation.disclaimer', 'Reservation is subject to confirmation by the restaurant.')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
