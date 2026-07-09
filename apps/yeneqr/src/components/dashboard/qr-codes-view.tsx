'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  QrCode,
  Plus,
  Download,
  RefreshCw,
  Scan,
  Table2,
  MapPin,
  Copy,
  Loader2,
  Printer,
  Layers,
  Trash2,
  Palette,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  Camera,
  Upload,
  X,
  BookOpen,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────

interface QRCodeData {
  id: string;
  tableId: string;
  restaurantId: string;
  branchId: string;
  type: 'static' | 'dynamic' | 'temporary';
  payload: string;
  signature: string;
  scanCount: number;
  isActive: boolean;
  expiresAt: string | null;
  menuId?: string | null;
  createdAt: string;
  updatedAt: string;
  // Style fields
  style?: string;
  fgColor?: string;
  bgColor?: string;
  logoUrl?: string;
  errorCorrection?: string;
  table: {
    id: string;
    number: string;
    capacity: number;
    status: string;
    floor: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
  };
  menu?: {
    id: string;
    name: string;
    nameAm?: string | null;
    isActive: boolean;
  } | null;
  // Extra fields from API response
  imageDataUrl?: string;
  qrUrl?: string;
}

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: string;
  floor: { id: string; name: string } | null;
}

// ─── QR Style Templates ─────────────────────────────────────

const QR_STYLES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean standard squares in brand green',
    fgColor: '#039D55',
    bgColor: '#FFFFFF',
    preview: 'bg-emerald-600',
    supportsLogo: false,
  },
  {
    id: 'rounded',
    name: 'Rounded',
    description: 'Rounded corners, dark navy on white',
    fgColor: '#1E293B',
    bgColor: '#FFFFFF',
    preview: 'bg-slate-800',
    supportsLogo: false,
  },
  {
    id: 'dots',
    name: 'Dots',
    description: 'Circular dot pattern in purple',
    fgColor: '#7C3AED',
    bgColor: '#FFFFFF',
    preview: 'bg-violet-600',
    supportsLogo: false,
  },
  {
    id: 'ethiopian',
    name: 'Ethiopian',
    description: 'Green on gold — Ethiopian flag colors',
    fgColor: '#078930',
    bgColor: '#FCDD09',
    preview: 'bg-gradient-to-r from-green-700 to-yellow-400',
    supportsLogo: false,
  },
  {
    id: 'branded',
    name: 'Branded',
    description: 'Logo embedded in center, brand green',
    fgColor: '#039D55',
    bgColor: '#FFFFFF',
    preview: 'bg-emerald-600',
    supportsLogo: true,
  },
  {
    id: 'artistic',
    name: 'Artistic',
    description: 'Creative QR with custom image overlay — perfect for landmarks & abstract designs',
    fgColor: '#1E293B',
    bgColor: '#FFFFFF',
    preview: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    supportsLogo: true,
  },
  {
    id: 'ethiopian_dam',
    name: 'GERD',
    description: 'Ethiopian Renaissance Dam theme — bold green & blue with image overlay',
    fgColor: '#078930',
    bgColor: '#E8F5E9',
    preview: 'bg-gradient-to-r from-green-600 via-blue-500 to-green-700',
    supportsLogo: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean, thin modules — elegant and modern',
    fgColor: '#374151',
    bgColor: '#F9FAFB',
    preview: 'bg-gray-700',
    supportsLogo: false,
  },
  {
    id: 'golden',
    name: 'Golden',
    description: 'Luxurious gold on deep black — premium feel',
    fgColor: '#D4AF37',
    bgColor: '#1A1A1A',
    preview: 'bg-gradient-to-r from-yellow-600 to-yellow-400',
    supportsLogo: true,
  },
  {
    id: 'coffee',
    name: 'Coffee',
    description: 'Warm Ethiopian coffee tones — earthy browns & cream',
    fgColor: '#6F4E37',
    bgColor: '#FFF8F0',
    preview: 'bg-gradient-to-r from-amber-800 to-amber-600',
    supportsLogo: true,
  },
] as const;

type QRStyleId = typeof QR_STYLES[number]['id'];

function getStyleConfig(styleId: string) {
  return QR_STYLES.find(s => s.id === styleId) || QR_STYLES[0];
}

// ─── QR Code Card ───────────────────────────────────────────

function QRCodeCard({
  qr,
  restaurantId,
  onRefresh,
  onEditStyle,
}: {
  qr: QRCodeData;
  restaurantId: string;
  onRefresh: () => void;
  onEditStyle: (qr: QRCodeData) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(qr.imageDataUrl || null);
  const [loadingImage, setLoadingImage] = useState(!qr.imageDataUrl);

  // Build a style version key that changes whenever visual properties change
  const styleVersion = `${qr.style}|${qr.fgColor}|${qr.bgColor}|${qr.logoUrl}|${qr.payload}|${qr.signature}`;

  // Regenerate QR image whenever style props change or server data arrives
  useEffect(() => {
    // If server already provided an image, use it immediately
    if (qr.imageDataUrl) {
      setImageDataUrl(qr.imageDataUrl);
      setLoadingImage(false);
      return;
    }
    if (!qr.payload) return;

    let cancelled = false;
    (async () => {
      try {
        const QRCodeLib = (await import('qrcode')).default;
        const payload = JSON.parse(qr.payload);
        const sig = qr.signature;
        // Unicode-safe base64url encoding (btoa fails on non-ASCII chars)
        const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        // Prefer window.location.origin (always correct for current deployment) over build-time env var
        const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
        const qrUrl = `${baseUrl}/menu/${encodedPayload}--${sig}`;
        const styleConfig = getStyleConfig(qr.style || 'classic');
        const img = await QRCodeLib.toDataURL(qrUrl, {
          width: 512,
          margin: 2,
          color: {
            dark: qr.fgColor || styleConfig.fgColor,
            light: qr.bgColor || styleConfig.bgColor,
          },
        });
        if (!cancelled) {
          setImageDataUrl(img);
          setLoadingImage(false);
        }
      } catch {
        if (!cancelled) setLoadingImage(false);
      }
    })();
    return () => { cancelled = true; };
  }, [styleVersion, qr.imageDataUrl]);

  const tableName = `Table ${qr.table?.number || '?'}`;
  const branchFloor = qr.table?.floor?.name || 'Main Floor';
  const styleConfig = getStyleConfig(qr.style || 'classic');

  const handleDownload = async () => {
    try {
      setDownloading(true);
      if (imageDataUrl) {
        downloadImage(imageDataUrl, `QR-Table${qr.table?.number || 'unknown'}-${styleConfig.name}.png`);
        return;
      }
      const res = await api.get<{ data: QRCodeData }>(
        `/api/restaurants/${restaurantId}/qr-codes/${qr.id}`
      );
      if (res.data?.imageDataUrl) {
        setImageDataUrl(res.data.imageDataUrl);
        downloadImage(res.data.imageDataUrl, `QR-Table${qr.table?.number || 'unknown'}-${styleConfig.name}.png`);
      } else {
        toast.error('Failed to generate QR image');
      }
    } catch {
      toast.error('Failed to download QR code');
    } finally {
      setDownloading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const res = await api.put<{ data: QRCodeData }>(`/api/restaurants/${restaurantId}/qr-codes/${qr.id}`, {
        action: 'regenerate',
      });
      if (res.data?.imageDataUrl) {
        setImageDataUrl(res.data.imageDataUrl);
      }
      toast.success(`QR code for ${tableName} regenerated`);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate';
      toast.error(msg);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      // Use server-provided URL if available, otherwise reconstruct
      let url = qr.qrUrl;
      if (!url) {
        const payload = JSON.parse(qr.payload);
        const sig = qr.signature;
        // Unicode-safe base64url encoding (btoa fails on non-ASCII chars)
        const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        // Prefer window.location.origin (always correct for current deployment) over build-time env var
        const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
        url = `${baseUrl}/menu/${encodedPayload}--${sig}`;
      }
      // Try modern clipboard API first, fall back to execCommand
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('QR URL copied to clipboard');
    } catch {
      toast.error('Could not copy QR URL');
    }
  };

  const handleDeactivate = async () => {
    try {
      await api.delete(`/api/restaurants/${restaurantId}/qr-codes/${qr.id}`);
      toast.success(`QR code for ${tableName} deactivated`);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deactivate';
      toast.error(msg);
    }
  };

  const handleActivate = async () => {
    try {
      setActivating(true);
      const res = await api.patch<{ data: QRCodeData; message: string }>(
        `/api/restaurants/${restaurantId}/qr-codes/${qr.id}`,
        { action: 'activate' }
      );
      if (res.data?.imageDataUrl) {
        setImageDataUrl(res.data.imageDataUrl);
      }
      toast.success(res.data?.message || `QR code for ${tableName} activated`);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate';
      toast.error(msg);
    } finally {
      setActivating(false);
    }
  };

  // Determine QR border style based on template
  const borderStyle = qr.style === 'ethiopian'
    ? 'border-l-4 border-l-green-600 border-t border-t-yellow-400'
    : qr.style === 'ethiopian_dam'
      ? 'border-l-4 border-l-green-600 border-b border-b-blue-500'
      : qr.style === 'dots'
        ? 'border-l-4 border-l-violet-500'
        : qr.style === 'rounded'
          ? 'border-l-4 border-l-slate-700'
          : qr.style === 'branded'
            ? 'border-l-4 border-l-emerald-500'
            : qr.style === 'artistic'
              ? 'border-l-4 border-l-pink-500'
              : qr.style === 'golden'
                ? 'border-l-4 border-l-yellow-500'
                : qr.style === 'coffee'
                  ? 'border-l-4 border-l-amber-700'
                  : qr.style === 'minimal'
                    ? 'border-l-4 border-l-gray-500'
                    : 'border-l-4 border-l-emerald-600';

  return (
    <Card className={`overflow-hidden ${borderStyle}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* QR Image */}
          <div
            className="flex h-48 sm:h-auto sm:w-48 items-center justify-center border-b sm:border-b-0 sm:border-r"
            style={{ backgroundColor: qr.bgColor || styleConfig.bgColor + '20' }}
          >
            <div className="flex flex-col items-center gap-2 relative">
              <div
                className={`flex h-32 w-32 items-center justify-center rounded-lg shadow-sm border overflow-hidden ${!qr.isActive ? 'opacity-30' : ''}`}
                style={{ backgroundColor: qr.bgColor || '#FFFFFF' }}
              >
                {loadingImage ? (
                  <Loader2 className="h-8 w-8 text-primary/50 animate-spin" />
                ) : imageDataUrl ? (
                  <img src={imageDataUrl} alt={`QR for ${tableName}`} className="h-full w-full object-contain" />
                ) : (
                  <QrCode className="h-24 w-24 text-primary/70" />
                )}
              </div>
              {!qr.isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-red-600 bg-white/80 dark:bg-gray-800/80 px-2 py-0.5 rounded border border-red-200">
                    INACTIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-muted-foreground" />
                  {tableName}
                  {qr.table && (
                    <span className="text-xs text-muted-foreground">({qr.table.capacity} seats)</span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {branchFloor}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    ['artistic'].includes(qr.style || '') ? 'bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-900/20 dark:text-pink-400'
                    : ['ethiopian', 'ethiopian_dam'].includes(qr.style || '') ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400'
                    : qr.style === 'dots' ? 'bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-900/20 dark:text-violet-400'
                    : qr.style === 'rounded' ? 'bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-900/20 dark:text-slate-400'
                    : qr.style === 'golden' ? 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : qr.style === 'coffee' ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400'
                    : qr.style === 'minimal' ? 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-900/20 dark:text-gray-400'
                    : qr.style === 'branded' ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400'
                  }`}
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  {styleConfig.name}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {qr.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    qr.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                  }`}
                >
                  {qr.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Scans</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Scan className="h-3 w-3" />
                  {qr.scanCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(qr.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Assigned Menu */}
            {qr.menu && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Menu:</span>
                <span className="text-[11px] font-medium">{qr.menu.name}</span>
              </div>
            )}

            {/* Color preview */}
            {(qr.fgColor || qr.bgColor) && (qr.fgColor !== styleConfig.fgColor || qr.bgColor !== styleConfig.bgColor) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Colors:</span>
                <div className="flex items-center gap-1">
                  <div className="h-4 w-4 rounded border" style={{ backgroundColor: qr.fgColor || styleConfig.fgColor }} title="Foreground" />
                  <div className="h-4 w-4 rounded border" style={{ backgroundColor: qr.bgColor || styleConfig.bgColor }} title="Background" />
                </div>
              </div>
            )}

            {qr.expiresAt && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Expires: {new Date(qr.expiresAt).toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1 flex-wrap">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={handleRegenerate}
                disabled={regenerating || !qr.isActive}
                title="Regenerate QR code with new signature"
              >
                {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => onEditStyle(qr)}
                title="Customize QR style, colors, logo"
              >
                <Palette className="h-3 w-3" />
                Style
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleCopyUrl}>
                <Copy className="h-3 w-3" />
                Copy URL
              </Button>
              {qr.isActive ? (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDeactivate}>
                  <Trash2 className="h-3 w-3" />
                  Deactivate
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={handleActivate} disabled={activating}>
                  {activating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
                  Activate
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Download Helper ────────────────────────────────────────

function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success(`QR code downloaded as ${filename}`);
}

// ─── Style Editor Dialog ────────────────────────────────────

function StyleEditorDialog({
  qr,
  restaurantId,
  onClose,
  onSaved,
  menus,
}: {
  qr: QRCodeData | null;
  restaurantId: string;
  onClose: () => void;
  onSaved: (updatedQR?: QRCodeData) => void;
  menus: { id: string; name: string; nameAm?: string | null; isActive: boolean }[];
}) {
  const [selectedStyle, setSelectedStyle] = useState<string>(qr?.style || 'classic');
  const [fgColor, setFgColor] = useState(qr?.fgColor || getStyleConfig(qr?.style || 'classic').fgColor);
  const [bgColor, setBgColor] = useState(qr?.bgColor || getStyleConfig(qr?.style || 'classic').bgColor);
  const [logoUrl, setLogoUrl] = useState(qr?.logoUrl || '');
  const [editMenuId, setEditMenuId] = useState<string>(qr?.menuId || '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(qr?.imageDataUrl || null);

  // Update colors when template changes
  const handleStyleChange = (styleId: string) => {
    setSelectedStyle(styleId);
    const config = getStyleConfig(styleId);
    setFgColor(config.fgColor);
    setBgColor(config.bgColor);
    if (!config.supportsLogo) {
      setLogoUrl('');
    }
  };

  // Generate a preview (client-side)
  const generatePreview = useCallback(async () => {
    if (!qr?.payload) return;
    try {
      const QRCodeLib = (await import('qrcode')).default;
      const payload = JSON.parse(qr.payload);
      const sig = qr.signature;
      // Unicode-safe base64url encoding (btoa fails on non-ASCII chars)
      const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // Prefer window.location.origin (always correct for current deployment) over build-time env var
      const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
      const qrUrl = `${baseUrl}/menu/${encodedPayload}--${sig}`;
      const img = await QRCodeLib.toDataURL(qrUrl, {
        width: 256,
        margin: 2,
        color: { dark: fgColor, light: bgColor },
      });
      setPreviewImage(img);
    } catch {
      // Preview generation failed — keep existing image
    }
  }, [qr, fgColor, bgColor]);

  // Debounced preview generation
  useEffect(() => {
    const timer = setTimeout(generatePreview, 300);
    return () => clearTimeout(timer);
  }, [generatePreview]);

  const handleSave = async () => {
    if (!qr) return;
    try {
      setSaving(true);
      const res = await api.put<{ data: QRCodeData }>(`/api/restaurants/${restaurantId}/qr-codes/${qr.id}`, {
        style: selectedStyle,
        fgColor,
        bgColor,
        logoUrl: getStyleConfig(selectedStyle).supportsLogo ? (logoUrl || undefined) : undefined,
        menuId: editMenuId || null,
      });
      toast.success(`Style updated for Table ${qr.table?.number}`);
      onSaved(res.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update style';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Upload logo image to server
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('entity', 'qr-logo');
      formData.append('entityId', qr?.id || 'new');
      const token = localStorage.getItem('yeneqr_token') || '';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload image');
        return;
      }
      if (data.data?.imageUrl) {
        // Prefer window.location.origin (always correct for current deployment) over build-time env var
        const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
        const fullUrl = data.data.imageUrl.startsWith('http') ? data.data.imageUrl : `${baseUrl}${data.data.imageUrl}`;
        setUrl(fullUrl);
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Upload succeeded but no URL returned');
      }
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      // Reset file inputs so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  if (!qr) return null;

  return (
    <Dialog open={!!qr} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Customize QR Style — Table {qr.table?.number}
          </DialogTitle>
          <DialogDescription>
            Choose a template or customize colors for this QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Menu Assignment */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Assigned Menu
              <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={editMenuId || 'none'} onValueChange={(v) => setEditMenuId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Default menu (first active)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default menu (first active)</SelectItem>
                {menus.filter(m => m.isActive).map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Assign a specific menu for this table. VIP tables can show a different menu.
            </p>
          </div>

          <Separator />

          {/* Preview */}
          <div className="flex justify-center">
            <div
              className="flex h-44 w-44 items-center justify-center rounded-xl border-2 shadow-md overflow-hidden"
              style={{ backgroundColor: bgColor }}
            >
              {previewImage ? (
                <img src={previewImage} alt="Preview" className="h-full w-full object-contain" />
              ) : (
                <QrCode className="h-20 w-20 text-muted-foreground/30" />
              )}
            </div>
          </div>

          {/* Template Grid */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Template</Label>
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
              {QR_STYLES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleStyleChange(tmpl.id)}
                  className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all cursor-pointer text-center
                    ${selectedStyle === tmpl.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/30'
                    }`}
                >
                  <div className={`h-6 w-6 rounded-full ${tmpl.preview} border border-white/50 shadow-sm`} />
                  <span className="text-[10px] font-medium leading-tight">{tmpl.name}</span>
                  {selectedStyle === tmpl.id && (
                    <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {getStyleConfig(selectedStyle).description}
              {getStyleConfig(selectedStyle).supportsLogo && ' — Custom image will appear in the center'}
            </p>
          </div>

          <Separator />

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Foreground Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <Input
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-8 text-xs font-mono"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <Input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-8 text-xs font-mono"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Center Image (for logo-supporting templates) */}
          {getStyleConfig(selectedStyle).supportsLogo && (
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                Center Image
              </Label>
              {logoUrl ? (
                <div className="relative group">
                  <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                    <img
                      src={logoUrl}
                      alt="Center image preview"
                      className="h-14 w-14 rounded-md object-cover border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate">{logoUrl}</p>
                      <p className="text-[9px] text-emerald-600">Image uploaded</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setLogoUrl('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Upload Image
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                      Take Photo
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    <div className="relative flex justify-center">
                      <span className="bg-background px-2 text-[10px] text-muted-foreground">or paste URL</span>
                    </div>
                  </div>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="h-7 text-[11px]"
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e, setLogoUrl, setUploadingLogo)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleLogoUpload(e, setLogoUrl, setUploadingLogo)}
              />
              <p className="text-[10px] text-muted-foreground">
                {selectedStyle === 'artistic'
                  ? 'Upload an abstract design, pattern, or artistic image to the center of your QR code.'
                  : selectedStyle === 'ethiopian_dam'
                    ? 'Upload the Great Ethiopian Renaissance Dam image or Ethiopian landmark to the center.'
                    : selectedStyle === 'golden'
                      ? 'Upload a premium logo or emblem to the center. Works best with simple, high-contrast images.'
                      : selectedStyle === 'coffee'
                        ? 'Upload a coffee bean, cup, or restaurant emblem to the center.'
                        : 'Upload a logo or image to appear in the center of the QR code. Requires high error correction (H).'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Palette className="h-4 w-4 mr-2" />}
            Apply Style
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reusable Center Image Upload Component ─────────────────

function CenterImageUpload({
  logoUrl,
  onLogoUrlChange,
  restaurantId,
  qrId,
  label = 'Center Image',
}: {
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
  restaurantId: string;
  qrId: string;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('entity', 'qr-logo');
      formData.append('entityId', qrId || 'new');
      const token = localStorage.getItem('yeneqr_token') || '';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload image');
        return;
      }
      if (data.data?.imageUrl) {
        // Prefer window.location.origin (always correct for current deployment) over build-time env var
        const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
        const fullUrl = data.data.imageUrl.startsWith('http') ? data.data.imageUrl : `${baseUrl}${data.data.imageUrl}`;
        onLogoUrlChange(fullUrl);
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Upload succeeded but no URL returned');
      }
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium flex items-center gap-1">
        <ImageIcon className="h-3 w-3" />
        {label}
      </Label>
      {logoUrl ? (
        <div className="relative group">
          <div className="flex items-center gap-2 p-1.5 rounded-lg border bg-muted/30">
            <img
              src={logoUrl}
              alt="Center image"
              className="h-10 w-10 rounded-md object-cover border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-muted-foreground truncate">{logoUrl}</p>
              <p className="text-[8px] text-emerald-600">Uploaded</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onLogoUrlChange('')}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Camera className="h-2.5 w-2.5" />}
              Camera
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div className="relative flex justify-center">
              <span className="bg-background px-1.5 text-[9px] text-muted-foreground">or URL</span>
            </div>
          </div>
          <Input
            value={logoUrl}
            onChange={(e) => onLogoUrlChange(e.target.value)}
            placeholder="https://example.com/image.png"
            className="h-7 text-[10px]"
          />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────

export function QRCodesView() {
  const { isGenerateQROpen, setIsGenerateQROpen, user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [massStyle, setMassStyle] = useState<string>('');

  const fetchQRCodesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchTablesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchMenusRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[QRCodesView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setQrCodes([]);
    setTables([]);
    fetchQRCodesRef.current?.();
    fetchTablesRef.current?.();
    fetchMenusRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Style editing
  const [editingQR, setEditingQR] = useState<QRCodeData | null>(null);

  // Generate dialog state
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('static');
  const [selectedStyle, setSelectedStyle] = useState<string>('classic');
  const [selectedMenu, setSelectedMenu] = useState<string>('');
  const [genFgColor, setGenFgColor] = useState('#039D55');
  const [genBgColor, setGenBgColor] = useState('#FFFFFF');
  const [genLogoUrl, setGenLogoUrl] = useState('');
  const [menus, setMenus] = useState<{ id: string; name: string; nameAm?: string | null; isActive: boolean }[]>([]);

  // Update colors when template changes in generate dialog
  const handleGenStyleChange = (styleId: string) => {
    setSelectedStyle(styleId);
    const config = getStyleConfig(styleId);
    setGenFgColor(config.fgColor);
    setGenBgColor(config.bgColor);
    if (!config.supportsLogo) setGenLogoUrl('');
  };

  const fetchQRCodes = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params = branchId ? `?branchId=${branchId}` : '';
      const res = await api.get<{ data: QRCodeData[] }>(`/api/restaurants/${restaurantId}/qr-codes${params}`);
      setQrCodes(res.data || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchQRCodesRef.current = fetchQRCodes; }, [fetchQRCodes]);

  // Handle style save — merge updated QR data immediately for instant visual update
  const handleStyleSaved = useCallback((updatedQR?: QRCodeData) => {
    if (updatedQR) {
      // Immediately merge the updated QR into state for instant visual feedback
      setQrCodes(prev => prev.map(q => q.id === updatedQR.id ? { ...q, ...updatedQR } : q));
    }
    // Also re-fetch in background to ensure full consistency
    fetchQRCodes();
  }, [fetchQRCodes]);

  const fetchTables = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params = branchId ? `?branchId=${branchId}` : '';
      const res = await api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables${params}`);
      setTables(res.data || []);
    } catch {
      // Silently handle
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchTablesRef.current = fetchTables; }, [fetchTables]);

  const fetchMenus = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ menus: { id: string; name: string; nameAm?: string | null; isActive: boolean }[] }>(`/api/restaurants/${restaurantId}/menus`);
      setMenus(res.menus || []);
    } catch {
      // Silently handle
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchMenusRef.current = fetchMenus; }, [fetchMenus]);

  useEffect(() => {
    fetchQRCodes();
    fetchTables();
    fetchMenus();
  }, [fetchQRCodes, fetchTables, fetchMenus, selectedBranchId, branchChangeVersion]);

  // Tables without active QR codes
  const tablesWithoutQR = tables.filter(
    (t) => !qrCodes.some((qr) => qr.tableId === t.id && qr.isActive)
  );

  const handleGenerate = async () => {
    if (!selectedTable) {
      toast.error('Please select a table');
      return;
    }

    try {
      setGenerating(true);
      const body: Record<string, unknown> = {
        tableId: selectedTable,
        type: selectedType,
        style: selectedStyle,
        fgColor: genFgColor,
        bgColor: genBgColor,
        menuId: selectedMenu || undefined,
      };
      if (getStyleConfig(selectedStyle).supportsLogo && genLogoUrl) {
        body.logoUrl = genLogoUrl;
      }
      const res = await api.post<{ data: QRCodeData }>(`/api/restaurants/${restaurantId}/qr-codes`, body);

      toast.success(`QR code generated for Table ${res.data?.table?.number || selectedTable}`);
      // Immediately add to state for instant display
      if (res.data) {
        setQrCodes(prev => [res.data, ...prev]);
      }
      setIsGenerateQROpen(false);
      setSelectedTable('');
      setSelectedType('static');
      setSelectedStyle('classic');
      setGenFgColor('#039D55');
      setGenBgColor('#FFFFFF');
      setGenLogoUrl('');
      // Background re-fetch for full consistency
      fetchQRCodes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate QR code';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (tablesWithoutQR.length === 0) {
      toast.info('All tables already have QR codes');
      return;
    }

    try {
      setBulkGenerating(true);
      let generated = 0;
      let errors = 0;

      for (const table of tablesWithoutQR) {
        try {
          await api.post(`/api/restaurants/${restaurantId}/qr-codes`, {
            tableId: table.id,
            type: 'static',
            style: massStyle || 'classic',
          });
          generated++;
        } catch {
          errors++;
        }
      }

      toast.success(`Generated ${generated} QR codes${errors > 0 ? ` (${errors} failed)` : ''}`);
      fetchQRCodes();
    } catch {
      toast.error('Bulk generation failed');
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleBulkRegenerate = async () => {
    const activeQRs = qrCodes.filter((qr) => qr.isActive);
    if (activeQRs.length === 0) {
      toast.info('No active QR codes to regenerate');
      return;
    }

    try {
      setBulkRegenerating(true);
      let regenerated = 0;
      let errors = 0;

      for (const qr of activeQRs) {
        try {
          const body: Record<string, unknown> = { action: 'regenerate' };
          if (massStyle) body.style = massStyle;
          await api.put(`/api/restaurants/${restaurantId}/qr-codes/${qr.id}`, body);
          regenerated++;
        } catch {
          errors++;
        }
      }

      toast.success(`Regenerated ${regenerated} QR codes${errors > 0 ? ` (${errors} failed)` : ''}`);
      fetchQRCodes();
    } catch {
      toast.error('Bulk regeneration failed');
    } finally {
      setBulkRegenerating(false);
    }
  };

  const handleApplyMassStyle = async () => {
    if (!massStyle) {
      toast.error('Select a style template first');
      return;
    }
    const activeQRs = qrCodes.filter((qr) => qr.isActive);
    if (activeQRs.length === 0) {
      toast.info('No active QR codes to update');
      return;
    }

    try {
      setBulkRegenerating(true);
      let updated = 0;
      let errors = 0;
      const config = getStyleConfig(massStyle);

      for (const qr of activeQRs) {
        try {
          await api.put(`/api/restaurants/${restaurantId}/qr-codes/${qr.id}`, {
            style: massStyle,
            fgColor: config.fgColor,
            bgColor: config.bgColor,
          });
          updated++;
        } catch {
          errors++;
        }
      }

      toast.success(`Applied ${config.name} style to ${updated} QR codes${errors > 0 ? ` (${errors} failed)` : ''}`);
      setMassStyle('');
      fetchQRCodes();
    } catch {
      toast.error('Failed to apply mass style');
    } finally {
      setBulkRegenerating(false);
    }
  };

  const handlePrintAll = async () => {
    const activeQRs = qrCodes.filter((qr) => qr.isActive);
    if (activeQRs.length === 0) {
      toast.info('No active QR codes to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print QR codes');
      return;
    }

    // Ensure all QR codes have image data
    const QRCodeLib = (await import('qrcode')).default;
    const enrichedQRs = await Promise.all(
      activeQRs.map(async (qr) => {
        if (qr.imageDataUrl) return qr;
        try {
          const payload = JSON.parse(qr.payload);
          const sig = qr.signature;
          // Unicode-safe base64url encoding (btoa fails on non-ASCII chars)
          const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          // Prefer window.location.origin (always correct for current deployment) over build-time env var
          const baseUrl = (typeof window !== 'undefined' && window.location.origin) || process.env.NEXT_PUBLIC_BASE_URL || '';
          const qrUrl = `${baseUrl}/menu/${encodedPayload}--${sig}`;
          const styleConfig = getStyleConfig(qr.style || 'classic');
          const imageDataUrl = await QRCodeLib.toDataURL(qrUrl, {
            width: 512,
            margin: 2,
            color: {
              dark: qr.fgColor || styleConfig.fgColor,
              light: qr.bgColor || styleConfig.bgColor,
            },
          });
          return { ...qr, imageDataUrl };
        } catch {
          return qr;
        }
      })
    );

    const qrImagesHtml = enrichedQRs
      .map((qr) => {
        const imgSrc = qr.imageDataUrl || '';
        const branchName = (qr.table as Record<string, unknown> & { branch?: { name: string } })?.branch?.name || '';
        const styleConfig = getStyleConfig(qr.style || 'classic');
        const accentColor = qr.fgColor || styleConfig.fgColor;
        return `
        <div style="display: inline-block; text-align: center; margin: 20px; page-break-inside: avoid;">
          <div style="border: 3px solid ${accentColor}; border-radius: 16px; padding: 20px; width: 230px; background: ${qr.bgColor || '#FFFFFF'};">
            ${imgSrc ? `<img src="${imgSrc}" style="width: 160px; height: 160px; margin-bottom: 10px;" />` : '<div style="width: 160px; height: 160px; border: 1px dashed #ccc; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">QR Code</div>'}
            <p style="font-weight: bold; font-size: 15px; margin: 0; color: ${accentColor};">Table ${qr.table?.number || '?'}</p>
            ${branchName ? `<p style="font-size: 11px; color: #666; margin: 3px 0;">${branchName}</p>` : ''}
            <p style="font-size: 11px; color: #666; margin: 2px 0;">${qr.table?.floor?.name || ''}</p>
            <p style="font-size: 11px; color: ${accentColor}; margin: 4px 0 0 0; font-weight: 600;">Scan to order</p>
            ${qr.style && qr.style !== 'classic' ? `<p style="font-size: 9px; color: #999; margin: 2px 0 0 0;">${styleConfig.name} style</p>` : ''}
          </div>
        </div>`;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Yene QR - Print QR Codes</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; }
            h1 { color: #039D55; font-size: 20px; margin-bottom: 20px; }
            @media print { h1 { display: none; } }
          </style>
        </head>
        <body>
          <h1>Yene QR - QR Codes for Printing</h1>
          ${qrImagesHtml}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Stats
  const activeCount = qrCodes.filter((q) => q.isActive).length;
  const totalScans = qrCodes.reduce((sum, q) => sum + q.scanCount, 0);

  // Style distribution
  const styleCounts = qrCodes.reduce((acc, q) => {
    const s = q.style || 'classic';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Generate and manage QR codes for your tables</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tablesWithoutQR.length > 0 && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleBulkGenerate}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Generate All ({tablesWithoutQR.length})
            </Button>
          )}
          {qrCodes.length > 0 && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={handlePrintAll}>
                <Printer className="h-4 w-4" />
                Print All
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={handleBulkRegenerate}
                disabled={bulkRegenerating}
              >
                {bulkRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate All
              </Button>
            </>
          )}
          <Button className="gap-1.5" onClick={() => setIsGenerateQROpen(true)}>
            <Plus className="h-4 w-4" />
            Generate QR Code
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{qrCodes.length}</p>
            <p className="text-[11px] text-muted-foreground">Total QR Codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalScans}</p>
            <p className="text-[11px] text-muted-foreground">Total Scans</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-violet-600">{Object.keys(styleCounts).length}</p>
            <p className="text-[11px] text-muted-foreground">Styles Used</p>
          </CardContent>
        </Card>
      </div>

      {/* Mass Style Application */}
      {qrCodes.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Apply style to all QR codes:</span>
              <div className="flex items-center gap-2">
                {QR_STYLES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setMassStyle(massStyle === tmpl.id ? '' : tmpl.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer
                      ${massStyle === tmpl.id
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-transparent hover:border-muted-foreground/20 text-muted-foreground'
                      }`}
                  >
                    <div className={`h-3 w-3 rounded-full ${tmpl.preview}`} />
                    {tmpl.name}
                  </button>
                ))}
              </div>
              {massStyle && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleApplyMassStyle}
                  disabled={bulkRegenerating}
                >
                  {bulkRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Apply {getStyleConfig(massStyle).name} to All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="ml-2 text-muted-foreground">Loading QR codes...</span>
        </div>
      )}

      {/* QR Code Cards */}
      {!loading && (
        <div className="space-y-4">
          {qrCodes.map((qr) => (
            <QRCodeCard
              key={qr.id}
              qr={qr}
              restaurantId={restaurantId}
              onRefresh={fetchQRCodes}
              onEditStyle={setEditingQR}
            />
          ))}
        </div>
      )}

      {!loading && qrCodes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <QrCode className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No QR codes generated yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tables.length > 0
                ? `You have ${tables.length} tables ready for QR codes`
                : 'Add tables first, then generate QR codes'}
            </p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setIsGenerateQROpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generate your first QR code
              </Button>
              {tables.length > 0 && (
                <Button variant="outline" onClick={handleBulkGenerate}>
                  <Layers className="h-4 w-4 mr-2" />
                  Generate for all tables
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate QR Dialog */}
      <Dialog open={isGenerateQROpen} onOpenChange={setIsGenerateQROpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Generate QR Code
            </DialogTitle>
            <DialogDescription>Create a QR code that customers can scan to view the menu and place orders.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Table</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No tables available — add tables first
                    </SelectItem>
                  ) : (
                    tablesWithoutQR.length === 0 ? (
                      <SelectItem value="none" disabled>
                        All tables already have QR codes
                      </SelectItem>
                    ) : (
                      tablesWithoutQR.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          Table {table.number} ({table.capacity} seats){table.floor ? ` — ${table.floor.name}` : ''}
                        </SelectItem>
                      ))
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">QR Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static (Permanent — never expires)</SelectItem>
                  <SelectItem value="dynamic">Dynamic (Changeable — 24h rolling)</SelectItem>
                  <SelectItem value="temporary">Temporary (Expiring — 4 hours)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {selectedType === 'static' && 'Best for permanent table QR codes. Never expires.'}
                {selectedType === 'dynamic' && 'Can be regenerated with a new URL. Expires every 24h.'}
                {selectedType === 'temporary' && 'For special events. Expires in 4 hours.'}
              </p>
            </div>

            {/* Menu Assignment */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                Assigned Menu
                <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={selectedMenu || 'none'} onValueChange={(v) => setSelectedMenu(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Default menu (first active)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default menu (first active)</SelectItem>
                  {menus.filter(m => m.isActive).map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Assign a specific menu to this table. Use different menus for VIP tables, special events, etc. If not set, the first active menu is used.
              </p>
            </div>

            <Separator />

            {/* Style Template */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Style Template
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {QR_STYLES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleGenStyleChange(tmpl.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all cursor-pointer text-center
                      ${selectedStyle === tmpl.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/30'
                      }`}
                  >
                    <div className={`h-5 w-5 rounded-full ${tmpl.preview} border border-white/50 shadow-sm`} />
                    <span className="text-[9px] font-medium leading-tight">{tmpl.name}</span>
                    {selectedStyle === tmpl.id && (
                      <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium">Foreground</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={genFgColor}
                    onChange={(e) => setGenFgColor(e.target.value)}
                    className="h-7 w-7 rounded border cursor-pointer"
                  />
                  <Input
                    value={genFgColor}
                    onChange={(e) => setGenFgColor(e.target.value)}
                    className="h-7 text-[11px] font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium">Background</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={genBgColor}
                    onChange={(e) => setGenBgColor(e.target.value)}
                    className="h-7 w-7 rounded border cursor-pointer"
                  />
                  <Input
                    value={genBgColor}
                    onChange={(e) => setGenBgColor(e.target.value)}
                    className="h-7 text-[11px] font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Center Image (for logo-supporting styles) */}
            {getStyleConfig(selectedStyle).supportsLogo && (
              <CenterImageUpload
                logoUrl={genLogoUrl}
                onLogoUrlChange={setGenLogoUrl}
                restaurantId={restaurantId}
                qrId="new"
                label="Center Image"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateQROpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !selectedTable}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Style Editor Dialog */}
      <StyleEditorDialog
        qr={editingQR}
        restaurantId={restaurantId}
        onClose={() => setEditingQR(null)}
        onSaved={handleStyleSaved}
        menus={menus}
      />
    </div>
  );
}
