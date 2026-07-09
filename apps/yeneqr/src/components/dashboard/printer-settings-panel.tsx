'use client';

// ============================================================
// Printer Settings Panel
// ============================================================
// Staff can:
//   1. Connect a thermal printer (USB / Serial / Bluetooth / Network)
//   2. Configure paper width (80mm / 58mm)
//   3. Test the printer
//   4. Open the cash drawer
//   5. Enable/disable auto-print + cash drawer kick
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Usb, Bluetooth, Wifi, Cable, CheckCircle2, XCircle, Loader2, Settings, RefreshCw, DollarSign, FileText } from 'lucide-react';
import { usePrinterService, type FiscalReceiptData, type KitchenTicketData } from '@/lib/printer-service';
import { toast } from 'sonner';

export function PrinterSettingsPanel({ restaurantId }: { restaurantId: string }) {
  const {
    connection,
    supportedApis,
    config,
    setConfig,
    connectWebUSB,
    connectWebSerial,
    connectBluetooth,
    connectNetwork,
    disconnect,
    printReceipt,
    printKitchenTicket,
    openCashDrawer,
    testPrint,
  } = usePrinterService();

  const [connecting, setConnecting] = useState<string | null>(null);
  const [showNetworkForm, setShowNetworkForm] = useState(false);
  const [networkIp, setNetworkIp] = useState('');
  const [networkPort, setNetworkPort] = useState('9100');

  const handleConnect = async (type: 'webusb' | 'webserial' | 'webbluetooth') => {
    setConnecting(type);
    try {
      let success = false;
      if (type === 'webusb') success = await connectWebUSB();
      else if (type === 'webserial') success = await connectWebSerial();
      else if (type === 'webbluetooth') success = await connectBluetooth();

      if (success) {
        toast.success('Printer connected successfully!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect printer');
    } finally {
      setConnecting(null);
    }
  };

  const handleNetworkConnect = async () => {
    if (!networkIp) {
      toast.error('Please enter the printer IP address');
      return;
    }
    setConnecting('network');
    try {
      await connectNetwork(networkIp, parseInt(networkPort) || 9100);
      toast.success('Network printer connected!');
      setShowNetworkForm(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect');
    } finally {
      setConnecting(null);
    }
  };

  const handleTestPrint = async () => {
    try {
      await testPrint();
      toast.success('Test print sent!');
    } catch (e: any) {
      toast.error(e.message || 'Test print failed');
    }
  };

  const handleOpenDrawer = async () => {
    try {
      await openCashDrawer();
      toast.success('Cash drawer opened');
    } catch (e: any) {
      toast.error(e.message || 'Failed to open cash drawer');
    }
  };

  const handleSampleReceipt = async () => {
    const sampleReceipt: FiscalReceiptData = {
      restaurantName: 'Habesha Maebel',
      restaurantTIN: '0012345678',
      restaurantVAT: 'VAT-1234567890',
      restaurantAddress: 'Bole Road, Addis Ababa',
      restaurantPhone: '+251 11 234 5678',
      receiptNumber: 'RCP-000001',
      orderNumber: '#0001',
      date: new Date(),
      cashierName: 'Test Cashier',
      tableNumber: '5',
      items: [
        { name: 'Doro Wot', quantity: 2, priceCents: 45000, totalCents: 90000, taxRate: 0.15 },
        { name: 'Injera', quantity: 4, priceCents: 500, totalCents: 2000, taxRate: 0.15 },
        { name: 'Tej (Glass)', quantity: 1, priceCents: 8000, totalCents: 8000, taxRate: 0.15 },
      ],
      subtotalCents: 100000,
      taxAmountCents: 15000,
      serviceChargeCents: 10000,
      discountAmountCents: 0,
      tipAmountCents: 5000,
      totalAmountCents: 130000,
      paymentMethod: 'cash',
      amountPaidCents: 130000,
    };
    try {
      await printReceipt(sampleReceipt);
      toast.success('Sample receipt printed!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to print receipt');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Hardware Printer
          </h3>
          <p className="text-xs text-muted-foreground">
            Connect a thermal receipt printer for fiscal receipts + cash drawer
          </p>
        </div>
        {connection?.connected && (
          <button
            onClick={disconnect}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}
      </div>

      {/* Connection Status */}
      {connection?.connected ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-sm text-green-700 dark:text-green-400">
                {connection.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Connected — ready to print
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Select your printer connection method:
          </p>

          {/* Connection options */}
          <div className="grid grid-cols-2 gap-3">
            {/* WebUSB */}
            <button
              onClick={() => handleConnect('webusb')}
              disabled={!supportedApis.webusb || connecting !== null}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-brand/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting === 'webusb' ? (
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
              ) : (
                <Usb className="w-6 h-6 text-brand" />
              )}
              <span className="text-xs font-medium">USB Printer</span>
              <span className="text-[10px] text-muted-foreground">
                {supportedApis.webusb ? 'Direct USB' : 'Not supported'}
              </span>
            </button>

            {/* WebSerial */}
            <button
              onClick={() => handleConnect('webserial')}
              disabled={!supportedApis.webserial || connecting !== null}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-brand/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting === 'webserial' ? (
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
              ) : (
                <Cable className="w-6 h-6 text-brand" />
              )}
              <span className="text-xs font-medium">Serial (COM)</span>
              <span className="text-[10px] text-muted-foreground">
                {supportedApis.webserial ? 'RS232 / COM port' : 'Not supported'}
              </span>
            </button>

            {/* Bluetooth */}
            <button
              onClick={() => handleConnect('webbluetooth')}
              disabled={!supportedApis.webbluetooth || connecting !== null}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-brand/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting === 'webbluetooth' ? (
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
              ) : (
                <Bluetooth className="w-6 h-6 text-brand" />
              )}
              <span className="text-xs font-medium">Bluetooth</span>
              <span className="text-[10px] text-muted-foreground">
                {supportedApis.webbluetooth ? 'Wireless' : 'Not supported'}
              </span>
            </button>

            {/* Network */}
            <button
              onClick={() => setShowNetworkForm(!showNetworkForm)}
              disabled={connecting !== null}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-brand/30 transition-all disabled:opacity-40"
            >
              <Wifi className="w-6 h-6 text-brand" />
              <span className="text-xs font-medium">Network (IP)</span>
              <span className="text-[10px] text-muted-foreground">WiFi / Ethernet</span>
            </button>
          </div>

          {/* Network form */}
          <AnimatePresence>
            {showNetworkForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border-2 border-brand/20 p-4 space-y-3"
              >
                <p className="text-xs font-medium">Network Printer Settings</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-muted-foreground">IP Address</label>
                    <input
                      type="text"
                      value={networkIp}
                      onChange={(e) => setNetworkIp(e.target.value)}
                      placeholder="192.168.1.100"
                      className="w-full px-2 py-1.5 text-xs rounded-lg border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Port</label>
                    <input
                      type="text"
                      value={networkPort}
                      onChange={(e) => setNetworkPort(e.target.value)}
                      placeholder="9100"
                      className="w-full px-2 py-1.5 text-xs rounded-lg border bg-background"
                    />
                  </div>
                </div>
                <button
                  onClick={handleNetworkConnect}
                  disabled={connecting !== null}
                  className="w-full bg-brand text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {connecting === 'network' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                  ) : (
                    <>Connect Network Printer</>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Browser support note */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              💡 USB/Serial/Bluetooth require Chrome or Edge browser. For Firefox/Safari,
              use Network printer (works on all browsers via server proxy).
            </p>
          </div>
        </div>
      )}

      {/* Configuration (only when connected) */}
      {connection?.connected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              Printer Configuration
            </h4>

            {/* Paper width */}
            <div>
              <label className="text-xs font-medium mb-1.5 block">Paper Width</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfig({ ...config, width: 80 })}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                    config.width === 80
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border'
                  }`}
                >
                  80mm (Standard)
                </button>
                <button
                  onClick={() => setConfig({ ...config, width: 58 })}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                    config.width === 58
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border'
                  }`}
                >
                  58mm (Compact)
                </button>
              </div>
            </div>

            {/* Auto-cut */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Auto-cut after print</label>
              <button
                onClick={() => setConfig({ ...config, cutAfterPrint: !config.cutAfterPrint })}
                className={`w-10 h-5 rounded-full transition-colors ${config.cutAfterPrint ? 'bg-brand' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.cutAfterPrint ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Cash drawer */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Auto-open cash drawer (cash payments)</label>
              <button
                onClick={() => setConfig({ ...config, cashDrawerEnabled: !config.cashDrawerEnabled })}
                className={`w-10 h-5 rounded-full transition-colors ${config.cashDrawerEnabled ? 'bg-brand' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.cashDrawerEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTestPrint}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-medium hover:bg-accent"
            >
              <FileText className="w-3.5 h-3.5" />
              Test Print
            </button>
            <button
              onClick={handleSampleReceipt}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-medium hover:bg-accent"
            >
              <Printer className="w-3.5 h-3.5" />
              Sample Receipt
            </button>
            <button
              onClick={handleOpenDrawer}
              disabled={!config.cashDrawerEnabled}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Open Drawer
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
