// ============================================================
// Yene QR — Notification Service
// ============================================================
// Unified notification dispatch: in-app (DB), push (Web Push),
// SMS (Ethio Telecom / Twilio), and email (SMTP / SendGrid).

import { db } from '@/lib/db'
import { emitEvent } from '@/lib/realtime'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface NotificationPayload {
  restaurantId: string
  branchId?: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  channels: ('in_app' | 'push' | 'sms' | 'email')[]
  recipientPhone?: string
  recipientEmail?: string
  recipientUserId?: string
}

// -------------------------------------------------------
// Main Dispatcher
// -------------------------------------------------------

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { channels, restaurantId, branchId, type, title, message, data, recipientUserId } = payload

  // Always create in-app notification in DB
  if (channels.includes('in_app')) {
    try {
      const notification = await db.notification.create({
        data: {
          restaurantId,
          branchId: branchId || null,
          userId: recipientUserId || null,
          type,
          channel: 'in_app',
          title,
          message,
          data: data ? JSON.stringify(data) : null,
        },
      })

      // Emit real-time notification event so SSE / Socket.IO clients update instantly.
      // Phase 3.7: include branchId so the SSE endpoint can filter by branch.
      // (Previously dropped here — a Branch A order fired a notification SSE
      // event that reached every staff member at Branch B.)
      emitEvent({
        type: 'notification',
        restaurantId,
        branchId: branchId || undefined,
        notificationId: notification.id,
        notificationType: type,
        title,
        message,
      })
    } catch (err) {
      console.error('[NOTIFICATION_IN_APP_ERROR]', err)
    }
  }

  // Send push notification
  if (channels.includes('push')) {
    try {
      await sendPushToUser(restaurantId, recipientUserId, {
        title,
        body: message,
        data: data || {},
      })
    } catch (err) {
      console.error('[NOTIFICATION_PUSH_ERROR]', err)
    }
  }

  // Send SMS
  if (channels.includes('sms') && payload.recipientPhone) {
    try {
      await sendSMS(payload.recipientPhone, message)
    } catch (err) {
      console.error('[NOTIFICATION_SMS_ERROR]', err)
    }
  }

  // Send Email
  if (channels.includes('email') && payload.recipientEmail) {
    try {
      await sendEmail(payload.recipientEmail, title, message)
    } catch (err) {
      console.error('[NOTIFICATION_EMAIL_ERROR]', err)
    }
  }
}

// -------------------------------------------------------
// Push — Web Push API
// -------------------------------------------------------

export async function sendPushNotification(subscription: PushSubscriptionJSON, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('[PUSH] VAPID keys not configured, skipping push notification')
    return
  }

  try {
    // Dynamic import to avoid bundling web-push on client
    const webPush = await import('web-push')

    webPush.default.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'support@yeneqr.com'}`,
      vapidPublicKey,
      vapidPrivateKey
    )

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys as { p256dh: string; auth: string },
    }

    await webPush.default.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    )
  } catch (err) {
    console.error('[PUSH_SEND_ERROR]', err)
  }
}

/**
 * Send push to all subscribed devices for a user (or all staff in a restaurant)
 */
async function sendPushToUser(
  restaurantId: string,
  userId: string | undefined,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  try {
    // Find push subscriptions for this user or all users in the restaurant
    const where = userId
      ? { userId }
      : { userId: { not: undefined } } // all users — we need restaurantId filter

    // Only query if PushSubscription table exists (will be added by migration)
    // Use a try/catch in case the table doesn't exist yet
    const subscriptions = await db.pushSubscription.findMany(
      userId
        ? { where: { userId } }
        : { where: {} } // If no specific user, we'll send to all restaurant staff
    ).catch(() => [] as never[])

    for (const sub of subscriptions) {
      // Filter by restaurant if we have the info
      if (!userId && restaurantId) {
        // Check if user belongs to this restaurant
        const user = await db.restaurantUser.findUnique({ where: { id: sub.userId } })
        if (!user || user.restaurantId !== restaurantId) continue
      }

      await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    }
  } catch (err) {
    console.error('[PUSH_TO_USER_ERROR]', err)
  }
}

// -------------------------------------------------------
// SMS — Ethio Telecom / Twilio
// -------------------------------------------------------

export async function sendSMS(phone: string, message: string): Promise<void> {
  const smsProvider = process.env.SMS_PROVIDER || 'none' // 'ethio_telecom' | 'twilio' | 'none'

  if (smsProvider === 'none') {
    console.log('[SMS] Would send to:', phone, 'Message:', message)
    return
  }

  // Ethio Telecom SMS API
  if (smsProvider === 'ethio_telecom') {
    try {
      const apiKey = process.env.ETHIO_TELECOM_SMS_API_KEY
      const senderId = process.env.ETHIO_TELECOM_SMS_SENDER_ID || 'YeneQR'

      if (!apiKey) {
        console.log('[SMS] Ethio Telecom API key not configured')
        return
      }

      const response = await fetch('https://api.ethiotelecom.et/sms/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: senderId,
          to: phone,
          text: message,
        }),
      })

      if (!response.ok) {
        console.error('[SMS] Ethio Telecom API error:', response.status, await response.text())
      }
    } catch (err) {
      console.error('[SMS] Ethio Telecom send error:', err)
    }
  }

  // Twilio SMS API
  if (smsProvider === 'twilio') {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_PHONE_NUMBER

      if (!accountSid || !authToken || !fromNumber) {
        console.log('[SMS] Twilio credentials not configured')
        return
      }

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: phone,
            Body: message,
          }),
        }
      )

      if (!response.ok) {
        console.error('[SMS] Twilio API error:', response.status, await response.text())
      }
    } catch (err) {
      console.error('[SMS] Twilio send error:', err)
    }
  }
}

// -------------------------------------------------------
// Email — SMTP / SendGrid
// -------------------------------------------------------

export async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
  const emailProvider = process.env.EMAIL_PROVIDER || 'none' // 'smtp' | 'sendgrid' | 'none'

  if (emailProvider === 'none') {
    console.log('[EMAIL] Would send to:', to, 'Subject:', subject)
    return
  }

  // SMTP via nodemailer
  if (emailProvider === 'smtp') {
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      })

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Yene QR <noreply@yeneqr.com>',
        to,
        subject,
        text: body,
        html: html || `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">${subject}</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">${body}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">This is an automated message from Yene QR.</p>
        </div>`,
      })
    } catch (err) {
      console.error('[EMAIL] SMTP send error:', err)
    }
  }

  // SendGrid
  if (emailProvider === 'sendgrid') {
    try {
      const apiKey = process.env.SENDGRID_API_KEY
      if (!apiKey) {
        console.log('[EMAIL] SendGrid API key not configured')
        return
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || 'noreply@yeneqr.com', name: 'Yene QR' },
          subject,
          content: [
            { type: 'text/plain', value: body },
            {
              type: 'text/html',
              value: html || `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">${subject}</h2>
                <p style="color: #4a4a4a; line-height: 1.6;">${body}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">This is an automated message from Yene QR.</p>
              </div>`,
            },
          ],
        }),
      })

      if (!response.ok) {
        console.error('[EMAIL] SendGrid API error:', response.status, await response.text())
      }
    } catch (err) {
      console.error('[EMAIL] SendGrid send error:', err)
    }
  }
}

// -------------------------------------------------------
// Convenience: Event-driven notifications
// -------------------------------------------------------

/**
 * Send a notification for a new order — Push to kitchen staff
 */
export async function notifyNewOrder(restaurantId: string, orderNumber: string, tableNumber: string, branchId?: string): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'new_order',
    title: 'New Order',
    message: `Order ${orderNumber} from Table ${tableNumber}`,
    data: { orderNumber, tableNumber },
    channels: ['in_app', 'push'],
  })
}

/**
 * Send a notification for a waiter call — Push to waiters.
 * Phase 3.6: branchId is now required so the notification is scoped to
 * the branch where the call originated. Previously broadcast to all
 * branches' waiters.
 */
export async function notifyWaiterCall(restaurantId: string, tableNumber: string, requestType: string, _targetUserIds?: string[], branchId?: string): Promise<void> {
  // Note: _targetUserIds is used by the waiter-calls API route to create per-waiter
  // notifications directly. This function handles the broadcast push notification.
  await sendNotification({
    restaurantId,
    branchId,
    type: 'waiter_call',
    title: requestType === 'call_waiter' ? 'Waiter Called' : 'Customer Request',
    message: `Table ${tableNumber}: ${requestType.replace(/_/g, ' ')}`,
    data: { tableNumber, requestType },
    channels: ['push'], // in_app notifications are created per-waiter in the API route
  })
}

/**
 * Send a notification when an order is ready — Push/SMS to customer.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyOrderReady(restaurantId: string, orderNumber: string, customerPhone?: string, branchId?: string): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'order_ready',
    title: 'Order Ready',
    message: `Your order ${orderNumber} is ready for pickup!`,
    data: { orderNumber },
    channels: ['in_app', 'push', ...(customerPhone ? ['sms' as const] : [])],
    recipientPhone: customerPhone,
  })
}

/**
 * Send a notification when payment is received — Push to manager
 */
export async function notifyPaymentReceived(restaurantId: string, orderNumber: string, amount: number, method: string, branchId?: string): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'payment_success',
    title: 'Payment Received',
    message: `ETB ${amount.toLocaleString()} via ${method} for order ${orderNumber}`,
    data: { orderNumber, amount, method },
    channels: ['in_app', 'push'],
  })
}

/**
 * Notify ALL assigned waiters that an order is ready for pickup.
 * Finds all waiters assigned to the table and sends targeted push notifications.
 * Returns array of waiter user IDs that were notified.
 *
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyWaiterOrderReady(
  restaurantId: string,
  orderId: string,
  orderNumber: string,
  tableId: string,
  tableNumber: string,
  branchId?: string
): Promise<string[]> {
  const waiterUserIds: string[] = []

  try {
    // Find ALL waiters assigned to this table
    const allWaiterAssignments = await db.staffAssignment.findMany({
      where: {
        branch: { restaurantId },
        role: 'waiter',
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    // Filter to waiters whose assignedTables include this tableId
    const assignedWaiters = allWaiterAssignments.filter((assignment) => {
      if (!assignment.assignedTables) return false
      try {
        const assignedTableIds: string[] = JSON.parse(assignment.assignedTables)
        return assignedTableIds.includes(tableId)
      } catch {
        return false
      }
    })

    // Collect user IDs of assigned waiters
    for (const waiter of assignedWaiters) {
      waiterUserIds.push(waiter.user.id)
    }

    // If no specific assignment found, notify all waiters in the branch (fallback)
    if (waiterUserIds.length === 0) {
      for (const assignment of allWaiterAssignments) {
        waiterUserIds.push(assignment.user.id)
      }
    }
  } catch (err) {
    console.error('[FIND_WAITERS_ERROR]', err)
  }

  // Send notification targeted to the first assigned waiter (for push notifications)
  // and a general notification for all waiters
  await sendNotification({
    restaurantId,
    branchId,
    type: 'waiter_order_ready',
    title: '🚀 Order Ready for Pickup!',
    message: `Order ${orderNumber} for Table ${tableNumber} is ready. Please pick up and deliver!`,
    data: { orderId, orderNumber, tableId, tableNumber },
    channels: ['in_app', 'push'],
    recipientUserId: waiterUserIds[0] || undefined,
  })

  // Send additional targeted notifications to other assigned waiters
  for (let i = 1; i < waiterUserIds.length; i++) {
    await sendNotification({
      restaurantId,
      branchId,
      type: 'waiter_order_ready',
      title: '🚀 Order Ready for Pickup!',
      message: `Order ${orderNumber} for Table ${tableNumber} is ready. Please pick up and deliver!`,
      data: { orderId, orderNumber, tableId, tableNumber },
      channels: ['push'],
      recipientUserId: waiterUserIds[i],
    }).catch((err) =>
      console.error('[NOTIFY_ADDITIONAL_WAITER_ERROR]', err)
    )
  }

  return waiterUserIds
}

/**
 * Notify staff when a customer cancels their order.
 * Sends in-app + push to all restaurant staff.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyOrderCancelledByCustomer(
  restaurantId: string,
  orderNumber: string,
  tableNumber: string,
  reason?: string,
  branchId?: string
): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'order_cancelled',
    title: 'Order Cancelled by Customer',
    message: `Order ${orderNumber} (Table ${tableNumber}) was cancelled by the customer${reason ? `: ${reason}` : ''}`,
    data: { orderNumber, tableNumber, cancelledBy: 'customer', reason: reason || null },
    channels: ['in_app', 'push'],
  })
}

/**
 * Notify customer when the restaurant cancels their order.
 * Sends in-app notification (customer will see it via SSE) + SMS if phone available.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyOrderCancelledByRestaurant(
  restaurantId: string,
  orderNumber: string,
  tableNumber: string,
  reason: string,
  customerPhone?: string,
  customerEmail?: string,
  branchId?: string
): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'order_cancelled',
    title: 'Order Cancelled',
    message: `Your order ${orderNumber} (Table ${tableNumber}) has been cancelled. Reason: ${reason}`,
    data: { orderNumber, tableNumber, cancelledBy: 'restaurant', reason },
    channels: ['in_app', 'push', ...(customerPhone ? ['sms' as const] : []), ...(customerEmail ? ['email' as const] : [])],
    recipientPhone: customerPhone,
    recipientEmail: customerEmail,
  })
}

/**
 * Notify staff when a customer cancels their reservation.
 * Sends in-app + push to all restaurant staff.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyReservationCancelledByCustomer(
  restaurantId: string,
  reservationId: string,
  customerName: string,
  reservedDate: string,
  reservedTime: string,
  partySize: number,
  reason?: string,
  branchId?: string
): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'reservation_cancelled',
    title: 'Reservation Cancelled by Customer',
    message: `${customerName}'s reservation for ${partySize} on ${reservedDate} at ${reservedTime} was cancelled${reason ? `: ${reason}` : ''}`,
    data: { reservationId, customerName, cancelledBy: 'customer', reason: reason || null },
    channels: ['in_app', 'push'],
  })
}

/**
 * Notify customer when the restaurant cancels their reservation.
 * Sends in-app notification + SMS/email if available.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyReservationCancelledByRestaurant(
  restaurantId: string,
  reservationId: string,
  customerName: string,
  reservedDate: string,
  reservedTime: string,
  reason?: string,
  customerPhone?: string,
  customerEmail?: string,
  branchId?: string
): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'reservation_cancelled',
    title: 'Reservation Cancelled',
    message: `Your reservation on ${reservedDate} at ${reservedTime} has been cancelled${reason ? `. Reason: ${reason}` : ''}. We apologize for the inconvenience.`,
    data: { reservationId, customerName, cancelledBy: 'restaurant', reason: reason || null },
    channels: ['in_app', 'push', ...(customerPhone ? ['sms' as const] : []), ...(customerEmail ? ['email' as const] : [])],
    recipientPhone: customerPhone,
    recipientEmail: customerEmail,
  })
}

/**
 * Notify staff when a new reservation is created by a customer.
 * Phase 3.6: added branchId param for branch-scoped routing.
 */
export async function notifyReservationCreated(
  restaurantId: string,
  customerName: string,
  reservedDate: string,
  reservedTime: string,
  partySize: number,
  branchId?: string
): Promise<void> {
  await sendNotification({
    restaurantId,
    branchId,
    type: 'reservation_created',
    title: 'New Reservation',
    message: `${customerName} reserved for ${partySize} on ${reservedDate} at ${reservedTime}`,
    data: { customerName, reservedDate, reservedTime, partySize },
    channels: ['in_app', 'push'],
  })
}

// ============================================================
// Invoice / Billing Notifications
// ============================================================

interface InvoiceEventPayload {
  invoiceNumber: string
  amountCents: number
  dueDate: string
  description?: string
}

function formatCents(cents: number): string {
  return `ETB ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Notify the restaurant owner that a new invoice has been generated.
 * Triggered on: plan change, recurring invoice, manual creation.
 */
export async function sendInvoiceNotification(
  restaurantId: string,
  event: InvoiceEventPayload & { type: 'invoice_created' }
): Promise<void> {
  const dueStr = new Date(event.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  await sendNotification({
    restaurantId,
    type: 'invoice_created',
    title: 'New Invoice Generated',
    message: `Invoice ${event.invoiceNumber} for ${formatCents(event.amountCents)} is due ${dueStr}.`,
    data: {
      invoiceNumber: event.invoiceNumber,
      amountCents: event.amountCents,
      dueDate: event.dueDate,
      description: event.description,
    },
    channels: ['in_app', 'push'],
  })
}

/**
 * Notify the restaurant owner that an invoice has been marked overdue.
 */
export async function sendInvoiceOverdueNotification(
  restaurantId: string,
  event: InvoiceEventPayload
): Promise<void> {
  await sendNotification({
    restaurantId,
    type: 'invoice_overdue',
    title: 'Invoice Overdue',
    message: `Invoice ${event.invoiceNumber} for ${formatCents(event.amountCents)} is now overdue. Please pay to avoid service suspension.`,
    data: {
      invoiceNumber: event.invoiceNumber,
      amountCents: event.amountCents,
      dueDate: event.dueDate,
    },
    channels: ['in_app', 'push'],
  })
}

/**
 * Notify the restaurant owner that an invoice has been paid.
 */
export async function sendInvoicePaidNotification(
  restaurantId: string,
  event: InvoiceEventPayload
): Promise<void> {
  await sendNotification({
    restaurantId,
    type: 'invoice_paid',
    title: 'Invoice Paid',
    message: `Invoice ${event.invoiceNumber} (${formatCents(event.amountCents)}) has been marked as paid. Thank you!`,
    data: {
      invoiceNumber: event.invoiceNumber,
      amountCents: event.amountCents,
    },
    channels: ['in_app', 'push'],
  })
}
