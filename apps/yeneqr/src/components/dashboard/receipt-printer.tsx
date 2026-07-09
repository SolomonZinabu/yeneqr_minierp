'use client';

import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { Printer } from 'lucide-react';

interface ReceiptOrder {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  tableId: string;
  subtotalCents: number;
  taxAmountCents: number;
  serviceChargeCents: number;
  discountAmountCents: number;
  tipAmountCents: number;
  totalAmountCents: number;
  createdAt: string;
  items?: {
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    specialInstructions?: string | null;
    modifierSelections?: { name: string; priceDeltaCents: number }[];
  }[];
  table?: { id: string; number: number | string; status: string } | null;
  customer?: { id: string; name: string } | null;
}

interface ReceiptRestaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRate?: number;
  currency?: string;
  logo?: string;
}

function generateReceiptHTML(order: ReceiptOrder, restaurant: ReceiptRestaurant): string {
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const items = order.items || [];
  const currency = restaurant.currency || 'ETB';

  const formatAmt = (cents: number) =>
    `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsHTML = items
    .map((item) => {
      const itemTotalCents = item.priceCents * item.quantity;
      const modifiersHTML =
        item.modifierSelections && item.modifierSelections.length > 0
          ? `<div style="font-size:11px;color:#666;margin-left:12px;">${item.modifierSelections.map((m) => m.name).join(', ')}</div>`
          : '';
      const notesHTML = item.specialInstructions
        ? `<div style="font-size:10px;color:#999;margin-left:12px;font-style:italic;">Note: ${item.specialInstructions}</div>`
        : '';
      return `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #eee;">
          <div style="flex:1;">
            <div style="font-size:13px;">${item.name}</div>
            ${modifiersHTML}
            ${notesHTML}
            <div style="font-size:11px;color:#888;">${formatAmt(item.priceCents)} × ${item.quantity}</div>
          </div>
          <div style="font-size:13px;font-weight:500;min-width:70px;text-align:right;">${formatAmt(itemTotalCents)}</div>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      max-width: 320px;
      margin: 0 auto;
      padding: 16px;
      color: #000;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .restaurant-name { font-size: 18px; font-weight: bold; }
    .restaurant-info { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.4; }
    .divider { border-top: 1px dashed #999; margin: 8px 0; }
    .order-info { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
    .totals-section { margin-top: 8px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
    .total-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #666; }
    .powered-by { font-size: 9px; color: #aaa; margin-top: 8px; }
    @media print {
      body { margin: 0; padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${restaurant.logo ? `<img src="${restaurant.logo}" alt="${restaurant.name}" style="height:48px;margin-bottom:8px;" />` : ''}
    <div class="restaurant-name">${restaurant.name}</div>
    <div class="restaurant-info">
      ${restaurant.address || ''}
      ${restaurant.phone ? `<br/>${restaurant.phone}` : ''}
      ${restaurant.email ? `<br/>${restaurant.email}` : ''}
    </div>
  </div>

  <div class="divider"></div>

  <div class="order-info">
    <span><strong>Order:</strong> ${order.orderNumber}</span>
    <span><strong>Table:</strong> ${order.table ? `Table ${order.table.number}` : 'N/A'}</span>
  </div>
  <div class="order-info">
    <span><strong>Date:</strong> ${dateStr}</span>
    <span><strong>Time:</strong> ${timeStr}</span>
  </div>
  ${order.customer ? `<div class="order-info"><span><strong>Customer:</strong> ${order.customer.name}</span></div>` : ''}
  <div class="order-info">
    <span><strong>Type:</strong> ${order.type?.replace('_', ' ') || 'Dine In'}</span>
  </div>

  <div class="divider"></div>

  <div class="items">
    ${itemsHTML || '<div style="text-align:center;padding:8px;color:#999;">No items</div>'}
  </div>

  <div class="divider"></div>

  <div class="totals-section">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${formatAmt(order.subtotalCents)}</span>
    </div>
    <div class="total-row">
      <span>Tax</span>
      <span>${formatAmt(order.taxAmountCents)}</span>
    </div>
    ${order.serviceChargeCents > 0 ? `<div class="total-row"><span>Service Charge</span><span>${formatAmt(order.serviceChargeCents)}</span></div>` : ''}
    ${order.discountAmountCents > 0 ? `<div class="total-row"><span>Discount</span><span>-${formatAmt(order.discountAmountCents)}</span></div>` : ''}
    ${order.tipAmountCents > 0 ? `<div class="total-row"><span>Tip</span><span>${formatAmt(order.tipAmountCents)}</span></div>` : ''}
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>${formatAmt(order.totalAmountCents)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <div class="footer">
    <div>Thank you for dining with us!</div>
    <div style="margin-top:4px;">We hope to see you again soon</div>
  </div>

  <div class="powered-by">Powered by Repux Technologies PLC</div>
</body>
</html>`;
}

export function ReceiptPrinter({
  order,
  restaurant,
}: {
  order: ReceiptOrder;
  restaurant: ReceiptRestaurant;
}) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(generateReceiptHTML(order, restaurant));
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  };

  return (
    <Button variant="outline" onClick={handlePrint} className="h-10 text-sm gap-2">
      <Printer className="h-4 w-4" />
      Print Receipt
    </Button>
  );
}
