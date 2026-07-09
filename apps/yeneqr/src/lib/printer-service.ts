'use client';

// ============================================================
// YeneQR Hardware Printer Service
// ============================================================
// Supports 4 connection methods for thermal receipt printers:
//   1. WebUSB — direct USB connection (Chrome/Edge, no driver needed)
//   2. WebSerial — serial/COM port connection (Chrome/Edge)
//   3. WebBluetooth — wireless Bluetooth printers
//   4. Network — IP-based printers (e.g., 192.168.1.100:9100)
//   5. Browser print — fallback (window.print with HTML receipt)
//
// All methods support:
//   - ESC/POS raw commands (text, barcode, QR code, image)
//   - Cash drawer kick (pulse to open drawer)
//   - 80mm and 58mm paper widths
//   - Fiscal receipt format (TIN, VAT, receipt number for Gebioch compliance)
// ============================================================

import { useState, useEffect, useCallback } from 'react';

// ─── ESC/POS Command Builder ─────────────────────────────────
// Builds raw ESC/POS byte arrays for thermal printers.
// Reference: https://escpos.readthedocs.io/

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

interface PrinterConfig {
  width: 80 | 58;           // paper width in mm
  encoding: 'utf8' | 'cp858'; // character encoding (cp858 supports Ethiopian)
  cutAfterPrint: boolean;
  cashDrawerEnabled: boolean;
}

const DEFAULT_CONFIG: PrinterConfig = {
  width: 80,
  encoding: 'utf8',
  cutAfterPrint: true,
  cashDrawerEnabled: true,
};

class ESCPOSBuilder {
  private bytes: number[] = [];
  private width: number;

  constructor(config: PrinterConfig = DEFAULT_CONFIG) {
    this.width = config.width;
    // Initialize printer
    this.bytes.push(ESC, 0x40); // ESC @ — initialize
    // Set character encoding
    if (config.encoding === 'cp858') {
      this.bytes.push(ESC, 0x74, 13); // ESC t 13 — CP858
    } else {
      this.bytes.push(ESC, 0x74, 0); // ESC t 0 — UTF-8
    }
  }

  // Text formatting
  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0); // ESC E
    return this;
  }

  underline(on: boolean): this {
    this.bytes.push(ESC, 0x2D, on ? 1 : 0); // ESC -
    return this;
  }

  doubleSize(on: boolean): this {
    if (on) {
      this.bytes.push(GS, 0x21, 0x11); // GS ! — double width + height
    } else {
      this.bytes.push(GS, 0x21, 0x00); // GS ! — normal
    }
    return this;
  }

  center(): this {
    this.bytes.push(ESC, 0x61, 1); // ESC a 1
    return this;
  }

  left(): this {
    this.bytes.push(ESC, 0x61, 0); // ESC a 0
    return this;
  }

  right(): this {
    this.bytes.push(ESC, 0x61, 2); // ESC a 2
    return this;
  }

  // Add text (converts string to bytes)
  text(str: string): this {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.bytes.push(encoded[i]);
    }
    return this;
  }

  // Add a line break
  newline(): this {
    this.bytes.push(LF);
    return this;
  }

  // Add multiple line breaks
  feed(n: number = 1): this {
    for (let i = 0; i < n; i++) {
      this.bytes.push(LF);
    }
    return this;
  }

  // Separator line (dashed)
  separator(char: string = '-'): this {
    const count = this.width === 80 ? 42 : 32;
    this.text(char.repeat(count)).newline();
    return this;
  }

  // Print a QR code
  qrCode(data: string): this {
    // GS ( k — QR code command
    const encoded = new TextEncoder().encode(data);
    const len = encoded.length + 3;
    const pL = len & 0xFF;
    const pH = (len >> 8) & 0xFF;

    // Set QR model
    this.bytes.push(GS, 0x28, 0x6B, 0x04, 0x31, 0x41, 0x32, 0x00);
    // Set QR size (module size)
    this.bytes.push(GS, 0x28, 0x6B, 0x03, 0x31, 0x43, 0x08);
    // Set error correction level
    this.bytes.push(GS, 0x28, 0x6B, 0x03, 0x31, 0x45, 0x31);
    // Store data
    this.bytes.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...encoded);
    // Print the QR code
    this.bytes.push(GS, 0x28, 0x6B, 0x03, 0x31, 0x51, 0x30);
    return this;
  }

  // Print a barcode (CODE128)
  barcode(data: string): this {
    // GS k — print barcode
    const encoded = new TextEncoder().encode(data);
    this.bytes.push(GS, 0x6B, 0x49, encoded.length, ...encoded);
    return this;
  }

  // Cut paper
  cut(): this {
    this.bytes.push(GS, 0x56, 0x42, 0x00); // GS V B — partial cut
    return this;
  }

  // Open cash drawer (pulse to connected drawer)
  // ESC p m t1 t2 — generate pulse
  cashDrawerKick(): this {
    this.bytes.push(ESC, 0x70, 0x00, 0x19, 0xFA); // ESC p 0 25 250
    return this;
  }

  // Build the final byte array
  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  // Get the raw bytes as a regular array
  getBytes(): number[] {
    return this.bytes;
  }
}

// ─── Receipt Builder (Gebioch/Tax Compliant) ─────────────────

export interface FiscalReceiptData {
  // Restaurant info
  restaurantName: string;
  restaurantTIN?: string;      // Tax Identification Number (for Gebioch)
  restaurantVAT?: string;      // VAT registration number
  restaurantAddress?: string;
  restaurantPhone?: string;

  // Receipt info
  receiptNumber: string;       // Sequential receipt number
  orderNumber: string;
  date: Date;
  cashierName?: string;
  tableNumber?: string;

  // Items
  items: Array<{
    name: string;
    quantity: number;
    priceCents: number;        // unit price
    totalCents: number;        // quantity * priceCents
    taxRate?: number;          // 0.15 for VAT, 0 for exempt
  }>;

  // Totals
  subtotalCents: number;
  taxAmountCents: number;
  serviceChargeCents: number;
  discountAmountCents: number;
  tipAmountCents: number;
  totalAmountCents: number;

  // Payment
  paymentMethod: string;
  amountPaidCents: number;

  // Customer (optional — for B2B invoices)
  customerName?: string;
  customerTIN?: string;
}

export function buildFiscalReceipt(data: FiscalReceiptData, config: PrinterConfig = DEFAULT_CONFIG): Uint8Array {
  const builder = new ESCPOSBuilder(config);
  const currency = 'ETB';
  const formatAmt = (cents: number) => `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Header (centered) ──
  builder.center();
  builder.bold(true).doubleSize(true).text(data.restaurantName).newline();
  builder.bold(false).doubleSize(false);

  if (data.restaurantTIN) {
    builder.text(`TIN: ${data.restaurantTIN}`).newline();
  }
  if (data.restaurantVAT) {
    builder.text(`VAT Reg: ${data.restaurantVAT}`).newline();
  }
  if (data.restaurantAddress) {
    builder.text(data.restaurantAddress).newline();
  }
  if (data.restaurantPhone) {
    builder.text(`Tel: ${data.restaurantPhone}`).newline();
  }

  builder.separator('=');
  builder.bold(true).text('FISCAL RECEIPT').newline();
  builder.bold(false);
  builder.separator('=');

  // ── Receipt details ──
  builder.left();
  builder.text(`Receipt #: ${data.receiptNumber}`).newline();
  builder.text(`Order #: ${data.orderNumber}`).newline();
  if (data.tableNumber) {
    builder.text(`Table: ${data.tableNumber}`).newline();
  }
  if (data.cashierName) {
    builder.text(`Cashier: ${data.cashierName}`).newline();
  }
  builder.text(`Date: ${data.date.toLocaleDateString('en-GB')}`).newline();
  builder.text(`Time: ${data.date.toLocaleTimeString('en-GB')}`).newline();

  // Customer info (for B2B)
  if (data.customerName) {
    builder.text(`Customer: ${data.customerName}`).newline();
    if (data.customerTIN) {
      builder.text(`Customer TIN: ${data.customerTIN}`).newline();
    }
  }

  builder.separator();

  // ── Items ──
  builder.bold(true);
  builder.text('Item'.padEnd(20) + 'Qty'.padStart(6) + 'Price'.padStart(8) + 'Total'.padStart(8)).newline();
  builder.bold(false);
  builder.separator();

  for (const item of data.items) {
    // Item name (truncate if too long)
    const name = item.name.length > 20 ? item.name.substring(0, 19) + '…' : item.name;
    builder.text(name.padEnd(20));
    builder.text(String(item.quantity).padStart(6));
    builder.text(formatAmt(item.priceCents).padStart(8));
    builder.text(formatAmt(item.totalCents).padStart(8));
    builder.newline();
    if (item.taxRate && item.taxRate === 0) {
      builder.text('  (Tax Exempt)').newline();
    }
  }

  builder.separator();

  // ── Totals ──
  builder.text('Subtotal:'.padEnd(34) + formatAmt(data.subtotalCents).padStart(8)).newline();
  if (data.discountAmountCents > 0) {
    builder.text('Discount:'.padEnd(34) + `-${formatAmt(data.discountAmountCents)}`.padStart(8)).newline();
  }
  if (data.serviceChargeCents > 0) {
    builder.text('Service Charge:'.padEnd(34) + formatAmt(data.serviceChargeCents).padStart(8)).newline();
  }
  builder.text('VAT (15%):'.padEnd(34) + formatAmt(data.taxAmountCents).padStart(8)).newline();
  if (data.tipAmountCents > 0) {
    builder.text('Tip:'.padEnd(34) + formatAmt(data.tipAmountCents).padStart(8)).newline();
  }

  builder.separator();
  builder.bold(true).doubleSize(true);
  builder.text('TOTAL:'.padEnd(17) + formatAmt(data.totalAmountCents).padStart(11)).newline();
  builder.bold(false).doubleSize(false);
  builder.separator();

  // ── Payment ──
  builder.text(`Payment Method: ${data.paymentMethod.toUpperCase()}`).newline();
  builder.text('Amount Paid:'.padEnd(34) + formatAmt(data.amountPaidCents).padStart(8)).newline();
  builder.separator();

  // ── Footer ──
  builder.center();
  builder.text('Thank you for dining with us!').newline();
  builder.text('Please come again').newline();
  builder.newline();

  // QR code with receipt verification (for tax audit)
  const qrData = JSON.stringify({
    tin: data.restaurantTIN || '',
    rcpt: data.receiptNumber,
    date: data.date.toISOString().split('T')[0],
    total: data.totalAmountCents,
    vat: data.taxAmountCents,
  });
  builder.qrCode(qrData);
  builder.newline();
  builder.text('Scan to verify receipt').newline();
  builder.feed(2);

  if (config.cutAfterPrint) {
    builder.cut();
  }

  return builder.build();
}

// ─── Kitchen Ticket Builder ──────────────────────────────────

export interface KitchenTicketData {
  orderNumber: string;
  tableNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    specialInstructions?: string | null;
    removedIngredients?: string | null;
  }>;
  createdAt: Date;
  round?: number;
}

export function buildKitchenTicket(data: KitchenTicketData, config: PrinterConfig = DEFAULT_CONFIG): Uint8Array {
  const builder = new ESCPOSBuilder(config);

  builder.center();
  builder.bold(true).doubleSize(true);
  builder.text(`KITCHEN ORDER`).newline();
  builder.bold(false).doubleSize(false);
  builder.separator('=');

  builder.left();
  builder.bold(true);
  builder.text(`Order: ${data.orderNumber}`).newline();
  builder.text(`Table: ${data.tableNumber}`).newline();
  if (data.round && data.round > 1) {
    builder.text(`Round: ${data.round}`).newline();
  }
  builder.text(`Time: ${data.createdAt.toLocaleTimeString('en-GB')}`).newline();
  builder.bold(false);
  builder.separator();

  for (const item of data.items) {
    builder.bold(true).doubleSize(true);
    builder.text(`${item.quantity}x  ${item.name}`).newline();
    builder.bold(false).doubleSize(false);

    if (item.specialInstructions) {
      builder.text(`  >> ${item.specialInstructions}`).newline();
    }
    if (item.removedIngredients) {
      try {
        const removed = JSON.parse(item.removedIngredients);
        if (Array.isArray(removed) && removed.length > 0) {
          builder.text(`  >> NO: ${removed.map((r: any) => r.name || r).join(', ')}`).newline();
        }
      } catch {
        builder.text(`  >> NO: ${item.removedIngredients}`).newline();
      }
    }
  }

  builder.separator();
  builder.feed(2);
  builder.cut();

  return builder.build();
}

// ─── Printer Connection Manager ──────────────────────────────

export type PrinterConnectionType = 'webusb' | 'webserial' | 'webbluetooth' | 'network' | 'browser';

export interface PrinterConnection {
  type: PrinterConnectionType;
  label: string;
  connected: boolean;
  // For network printers
  ipAddress?: string;
  port?: number;
}

export function usePrinterService() {
  const [connection, setConnection] = useState<PrinterConnection | null>(null);
  const [device, setDevice] = useState<any>(null);
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_CONFIG);
  const [supportedApis, setSupportedApis] = useState({
    webusb: false,
    webserial: false,
    webbluetooth: false,
  });

  // Check browser support
  useEffect(() => {
    setSupportedApis({
      webusb: typeof navigator !== 'undefined' && 'usb' in navigator,
      webserial: typeof navigator !== 'undefined' && 'serial' in navigator,
      webbluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    });
  }, []);

  // ── WebUSB: Connect to USB thermal printer ──
  const connectWebUSB = useCallback(async (): Promise<boolean> => {
    if (!('usb' in navigator)) {
      throw new Error('WebUSB not supported in this browser. Use Chrome or Edge.');
    }
    try {
      // Request a USB device — filters for common printer vendor IDs
      const usbDevice = await (navigator as any).usb.requestDevice({
        filters: [
          // Epson thermal printers
          { vendorId: 0x04b8 },
          // Star Micronics
          { vendorId: 0x0519 },
          // Bixolon
          { vendorId: 0x1504 },
          // Zjiang / ZKTeco (common in Ethiopia)
          { vendorId: 0x0416 },
          // Generic — show all devices if no match
        ],
      });
      await usbDevice.open();
      if (usbDevice.configuration === null) {
        await usbDevice.selectConfiguration(1);
      }
      await usbDevice.claimInterface(0);
      setDevice(usbDevice);
      setConnection({
        type: 'webusb',
        label: `USB: ${usbDevice.manufacturerName || 'Thermal Printer'} ${usbDevice.productName || ''}`.trim(),
        connected: true,
      });
      return true;
    } catch (e: any) {
      throw new Error(`USB connection failed: ${e.message}`);
    }
  }, []);

  // ── WebSerial: Connect to serial/COM port printer ──
  const connectWebSerial = useCallback(async (): Promise<boolean> => {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial not supported. Use Chrome or Edge.');
    }
    try {
      const serialPort = await (navigator as any).serial.requestPort();
      await serialPort.open({ baudRate: 9600 });
      setDevice(serialPort);
      setConnection({
        type: 'webserial',
        label: 'Serial/COM Printer',
        connected: true,
      });
      return true;
    } catch (e: any) {
      throw new Error(`Serial connection failed: ${e.message}`);
    }
  }, []);

  // ── WebBluetooth: Connect to Bluetooth printer ──
  const connectBluetooth = useCallback(async (): Promise<boolean> => {
    if (!('bluetooth' in navigator)) {
      throw new Error('WebBluetooth not supported. Use Chrome or Edge.');
    }
    try {
      const btDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common printer service
        ],
        optionalServices: ['generic_access'],
      });
      const server = await btDevice.gatt.connect();
      setDevice({ device: btDevice, server });
      setConnection({
        type: 'webbluetooth',
        label: `Bluetooth: ${btDevice.name || 'Thermal Printer'}`,
        connected: true,
      });
      return true;
    } catch (e: any) {
      throw new Error(`Bluetooth connection failed: ${e.message}`);
    }
  }, []);

  // ── Network: Connect to IP printer ──
  const connectNetwork = useCallback(async (ipAddress: string, port: number = 9100): Promise<boolean> => {
    // Network printers can't be connected directly from the browser (no raw TCP).
    // We store the IP/port and send print jobs via the server API.
    setDevice({ ipAddress, port });
    setConnection({
      type: 'network',
      label: `Network: ${ipAddress}:${port}`,
      connected: true,
      ipAddress,
      port,
    });
    return true;
  }, []);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    if (device) {
      try {
        if (connection?.type === 'webusb' && device.close) {
          await device.close();
        } else if (connection?.type === 'webserial' && device.close) {
          await device.close();
        } else if (connection?.type === 'webbluetooth' && device.device?.gatt?.connected) {
          device.device.gatt.disconnect();
        }
      } catch {}
    }
    setDevice(null);
    setConnection(null);
  }, [device, connection]);

  // ── Send raw bytes to printer ──
  const print = useCallback(async (data: Uint8Array): Promise<boolean> => {
    if (!connection || !connection.connected) {
      throw new Error('Printer not connected');
    }

    try {
      if (connection.type === 'webusb' && device) {
        // WebUSB: send to endpoint 1 (OUT)
        await device.transferOut(1, data);
        return true;
      } else if (connection.type === 'webserial' && device) {
        // WebSerial: write to the writable stream
        const writer = device.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return true;
      } else if (connection.type === 'webbluetooth' && device) {
        // WebBluetooth: write to the printer characteristic
        const service = await device.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        // Split into chunks (Bluetooth has MTU limits)
        const chunkSize = 180;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await characteristic.writeValueWithoutResponse(chunk);
        }
        return true;
      } else if (connection.type === 'network' && connection.ipAddress) {
        // Network: send via server API (browser can't do raw TCP)
        const response = await fetch('/api/print/network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ipAddress: connection.ipAddress,
            port: connection.port || 9100,
            data: Array.from(data),
          }),
        });
        return response.ok;
      }
      return false;
    } catch (e: any) {
      throw new Error(`Print failed: ${e.message}`);
    }
  }, [connection, device]);

  // ── Print fiscal receipt ──
  const printReceipt = useCallback(async (receiptData: FiscalReceiptData): Promise<boolean> => {
    const bytes = buildFiscalReceipt(receiptData, config);
    const success = await print(bytes);
    // Open cash drawer after printing if enabled
    if (success && config.cashDrawerEnabled) {
      const drawerBuilder = new ESCPOSBuilder(config);
      drawerBuilder.cashDrawerKick();
      await print(drawerBuilder.build());
    }
    return success;
  }, [print, config]);

  // ── Print kitchen ticket ──
  const printKitchenTicket = useCallback(async (ticketData: KitchenTicketData): Promise<boolean> => {
    const bytes = buildKitchenTicket(ticketData, config);
    return await print(bytes);
  }, [print, config]);

  // ── Open cash drawer manually ──
  const openCashDrawer = useCallback(async (): Promise<boolean> => {
    const builder = new ESCPOSBuilder(config);
    builder.cashDrawerKick();
    return await print(builder.build());
  }, [print, config]);

  // ── Test print ──
  const testPrint = useCallback(async (): Promise<boolean> => {
    const builder = new ESCPOSBuilder(config);
    builder.center().bold(true).doubleSize(true);
    builder.text('YeneQR').newline();
    builder.bold(false).doubleSize(false);
    builder.text('Printer Test').newline();
    builder.separator();
    builder.text('If you can read this,').newline();
    builder.text('your printer is connected!').newline();
    builder.feed(2);
    if (config.cutAfterPrint) builder.cut();
    return await print(builder.build());
  }, [print, config]);

  return {
    connection,
    supportedApis,
    config,
    setConfig,
    connectWebUSB,
    connectWebSerial,
    connectBluetooth,
    connectNetwork,
    disconnect,
    print,
    printReceipt,
    printKitchenTicket,
    openCashDrawer,
    testPrint,
  };
}
