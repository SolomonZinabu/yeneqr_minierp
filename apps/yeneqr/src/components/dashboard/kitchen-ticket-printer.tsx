'use client';

// ============================================================
// Yene QR — Kitchen Ticket Printer (Phase R5, Gap 2.14)
// ============================================================
// Generates a thermal-printer-formatted kitchen ticket and sends it
// to the browser's print dialog. Designed for 80mm thermal receipt
// printers (standard in Ethiopian restaurants).
//
// Kitchen tickets differ from customer receipts:
//   - NO prices (kitchen doesn't need them)
//   - Shows modifiers, removed ingredients, special instructions
//   - Shows allergen warnings
//   - Larger fonts for readability in a busy kitchen
//   - Includes order number, table, timestamp, round number
// ============================================================

import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface KitchenTicketItem {
  id: string;
  name: string;
  nameAm?: string | null;
  quantity: number;
  specialInstructions?: string | null;
  removedIngredients?: string | null;
  modifierSelections?: { name: string }[];
  kitchenStatus?: string;
  roundNumber?: number;
}

interface KitchenTicketOrder {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  tableId?: string | null;
  table?: { number: string | number } | null;
  branch?: { name: string } | null;
  items: KitchenTicketItem[];
  createdAt: string;
  guestCount?: number;
  priority?: string;
}

export function useKitchenTicketPrinter(restaurantId: string) {
  const printTicket = useCallback(async (orderId: string) => {
    try {
      // Fetch the full order with items (API wraps in { data: ... })
      const res = await api.get<{ data: KitchenTicketOrder }>(
        `/api/restaurants/${restaurantId}/orders/${orderId}`
      );
      const order = res.data;

      if (!order || !order.items || order.items.length === 0) {
        toast.error('No items to print');
        return;
      }

      const ticketHtml = generateKitchenTicketHtml(order);
      printHtml(ticketHtml);
      toast.success('Kitchen ticket sent to printer');
    } catch (err) {
      console.error('[KITCHEN_TICKET_PRINT]', err);
      toast.error('Failed to print kitchen ticket');
    }
  }, [restaurantId]);

  return { printTicket };
}

function generateKitchenTicketHtml(order: KitchenTicketOrder): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const tableLabel = order.table?.number ? `Table ${order.table.number}` : (order.type === 'takeaway' ? 'TAKEAWAY' : '—');
  const priorityBadge = order.priority === 'vip' ? ' ⭐ VIP' : order.priority === 'rush' ? ' 🔥 RUSH' : '';

  const itemsHtml = order.items
    .filter((item) => item.kitchenStatus !== 'cancelled')
    .map((item) => {
      const mods = item.modifierSelections?.length
        ? item.modifierSelections.map((m) => m.name).join(', ')
        : '';

      let removedIngs = '';
      if (item.removedIngredients) {
        try {
          const parsed = JSON.parse(item.removedIngredients);
          if (Array.isArray(parsed) && parsed.length > 0) {
            removedIngs = parsed.map((r: { name: string }) => `NO ${r.name}`).join(', ');
          }
        } catch { /* ignore */ }
      }

      const roundBadge = item.roundNumber && item.roundNumber > 1 ? ` [R${item.roundNumber}]` : '';

      return `
        <div class="item">
          <div class="item-header">
            <span class="qty">${item.quantity}×</span>
            <span class="name">${escapeHtml(item.name)}${roundBadge}</span>
          </div>
          ${mods ? `<div class="modifiers">+ ${escapeHtml(mods)}</div>` : ''}
          ${removedIngs ? `<div class="removed">${escapeHtml(removedIngs)}</div>` : ''}
          ${item.specialInstructions ? `<div class="instructions">⚠ ${escapeHtml(item.specialInstructions)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kitchen Ticket #${order.orderNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      padding: 4mm 3mm;
      font-size: 13px;
      line-height: 1.4;
      color: #000;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .header .title {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .header .subtitle {
      font-size: 12px;
      margin-top: 2px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .meta .order-num {
      font-weight: bold;
      font-size: 16px;
    }
    .table-line {
      font-size: 20px;
      font-weight: bold;
      text-align: center;
      margin: 6px 0;
      border: 1px solid #000;
      padding: 4px;
    }
    .items {
      border-top: 1px dashed #000;
      padding-top: 6px;
    }
    .item {
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .item-header {
      display: flex;
      gap: 6px;
      font-size: 14px;
      font-weight: bold;
    }
    .qty {
      min-width: 28px;
    }
    .modifiers {
      font-size: 12px;
      margin-left: 34px;
      margin-top: 2px;
    }
    .removed {
      font-size: 12px;
      margin-left: 34px;
      margin-top: 2px;
      text-decoration: line-through;
      font-weight: bold;
    }
    .instructions {
      font-size: 12px;
      margin-left: 34px;
      margin-top: 2px;
      font-weight: bold;
    }
    .footer {
      border-top: 2px dashed #000;
      padding-top: 6px;
      margin-top: 8px;
      text-align: center;
      font-size: 11px;
    }
    .priority {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin: 4px 0;
    }
    @media print {
      body { width: 80mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">🍳 KITCHEN ORDER</div>
    <div class="subtitle">${escapeHtml(order.branch?.name || '')}</div>
  </div>

  <div class="meta">
    <span class="order-num">#${escapeHtml(order.orderNumber)}</span>
    <span>${dateStr} ${timeStr}</span>
  </div>

  ${order.priority === 'vip' || order.priority === 'rush' ? `<div class="priority">${priorityBadge}</div>` : ''}

  <div class="table-line">${escapeHtml(tableLabel)}${order.guestCount ? ` · ${order.guestCount} guests` : ''}</div>

  <div class="items">
    ${itemsHtml}
  </div>

  <div class="footer">
    ${order.items.filter((i) => i.kitchenStatus !== 'cancelled').length} item(s) · Printed ${timeStr}
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printHtml(html: string) {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    toast.error('Please allow popups to print kitchen tickets');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
