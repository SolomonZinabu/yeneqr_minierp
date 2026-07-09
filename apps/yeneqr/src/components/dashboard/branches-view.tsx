'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { PERMISSIONS } from '@/lib/auth';
import {
  Building2, Plus, MapPin, Phone, Pencil, Power, PowerOff,
  Loader2, Search, Star, AlertTriangle, QrCode, UtensilsCrossed, ChefHat,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────

interface BranchCountData {
  tables?: number;
  floors?: number;
  kitchenStations?: number;
  qrCodes?: number;
}

interface BranchData {
  id: string;
  name: string;
  nameAm?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  workingHours?: string | null;
  isActive: boolean;
  isMainBranch: boolean;
  settings?: string | null;
  _count?: BranchCountData;
}

interface BranchFormData {
  name: string;
  nameAm: string;
  address: string;
  city: string;
  phone: string;
  latitude: string;
  longitude: string;
  isMainBranch: boolean;
  isActive: boolean;
  workingHours: string;
}

const emptyForm: BranchFormData = {
  name: '',
  nameAm: '',
  address: '',
  city: '',
  phone: '',
  latitude: '',
  longitude: '',
  isMainBranch: false,
  isActive: true,
  workingHours: '',
};

// ── Component ──────────────────────────────────────────────────

export function BranchesView() {
  const { user, incrementBranchesVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<BranchFormData>({ ...emptyForm });
  const [adding, setAdding] = useState(false);

  // Edit dialog
  const [editBranch, setEditBranch] = useState<BranchData | null>(null);
  const [editForm, setEditForm] = useState<BranchFormData>({ ...emptyForm });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDeactivateWarning, setEditDeactivateWarning] = useState(false);

  // Toggle active
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Deactivate confirmation dialog
  const [deactivateTarget, setDeactivateTarget] = useState<BranchData | null>(null);

  // Permission check
  const canManage = useMemo(() => {
    const role = user?.role || '';
    if (role === 'owner' || role === 'manager' || role === 'super_admin') return true;
    const perms = user?.resolvedPermissions || user?.permissions || [];
    return perms.includes(PERMISSIONS.BRANCH_MANAGE.key);
  }, [user]);

  const canView = useMemo(() => {
    const role = user?.role || '';
    if (role === 'owner' || role === 'manager' || role === 'super_admin') return true;
    const perms = user?.resolvedPermissions || user?.permissions || [];
    return perms.includes(PERMISSIONS.BRANCH_VIEW.key) || perms.includes(PERMISSIONS.BRANCH_MANAGE.key);
  }, [user]);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ data: BranchData[] }>(`/api/restaurants/${restaurantId}/branches?includeInactive=true`);
      setBranches(res.data || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // ── Computed ───────────────────────────────────────────────

  const filteredBranches = useMemo(() => {
    let result = branches;
    // Apply status filter
    if (statusFilter === 'active') result = result.filter((b) => b.isActive);
    else if (statusFilter === 'inactive') result = result.filter((b) => !b.isActive);
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.city && b.city.toLowerCase().includes(q)) ||
          (b.address && b.address.toLowerCase().includes(q))
      );
    }
    return result;
  }, [branches, searchQuery, statusFilter]);

  const totalCount = branches.length;
  const activeCount = branches.filter((b) => b.isActive).length;
  const inactiveCount = branches.filter((b) => !b.isActive).length;

  // ── Add Branch ─────────────────────────────────────────────

  const handleAddBranch = async () => {
    if (!addForm.name.trim()) {
      toast.error('Branch name is required');
      return;
    }
    try {
      setAdding(true);
      const payload: Record<string, unknown> = {
        name: addForm.name.trim(),
      };
      if (addForm.nameAm.trim()) payload.nameAm = addForm.nameAm.trim();
      if (addForm.address.trim()) payload.address = addForm.address.trim();
      if (addForm.city.trim()) payload.city = addForm.city.trim();
      if (addForm.phone.trim()) payload.phone = addForm.phone.trim();
      if (addForm.latitude) payload.latitude = parseFloat(addForm.latitude);
      if (addForm.longitude) payload.longitude = parseFloat(addForm.longitude);
      if (addForm.isMainBranch) payload.isMainBranch = true;
      if (addForm.workingHours.trim()) {
        try {
          payload.workingHours = JSON.parse(addForm.workingHours.trim());
        } catch {
          payload.workingHours = addForm.workingHours.trim();
        }
      }

      await api.post(`/api/restaurants/${restaurantId}/branches`, payload);
      toast.success(`"${addForm.name.trim()}" branch created`);
      setIsAddOpen(false);
      setAddForm({ ...emptyForm });
      fetchBranches();
      incrementBranchesVersion();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  // ── Edit Branch ────────────────────────────────────────────

  const openEditDialog = (branch: BranchData) => {
    setEditBranch(branch);
    setEditDeactivateWarning(false);
    let workingHoursStr = '';
    if (branch.workingHours) {
      try {
        workingHoursStr = JSON.stringify(JSON.parse(branch.workingHours), null, 2);
      } catch {
        workingHoursStr = branch.workingHours;
      }
    }
    setEditForm({
      name: branch.name,
      nameAm: branch.nameAm || '',
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      latitude: branch.latitude != null ? String(branch.latitude) : '',
      longitude: branch.longitude != null ? String(branch.longitude) : '',
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      workingHours: workingHoursStr,
    });
  };

  const handleSaveEdit = async () => {
    if (!editBranch) return;
    if (!editForm.name.trim()) {
      toast.error('Branch name is required');
      return;
    }
    try {
      setSavingEdit(true);
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        isActive: editForm.isActive,
        isMainBranch: editForm.isMainBranch,
      };
      if (editForm.nameAm.trim()) payload.nameAm = editForm.nameAm.trim();
      else payload.nameAm = null;
      if (editForm.address.trim()) payload.address = editForm.address.trim();
      else payload.address = null;
      if (editForm.city.trim()) payload.city = editForm.city.trim();
      else payload.city = null;
      if (editForm.phone.trim()) payload.phone = editForm.phone.trim();
      else payload.phone = null;
      if (editForm.latitude) payload.latitude = parseFloat(editForm.latitude);
      else payload.latitude = null;
      if (editForm.longitude) payload.longitude = parseFloat(editForm.longitude);
      else payload.longitude = null;
      if (editForm.workingHours.trim()) {
        try {
          payload.workingHours = JSON.parse(editForm.workingHours.trim());
        } catch {
          payload.workingHours = editForm.workingHours.trim();
        }
      } else {
        payload.workingHours = null;
      }

      await api.put(`/api/restaurants/${restaurantId}/branches/${editBranch.id}`, payload);
      toast.success(`"${editForm.name.trim()}" updated`);
      setEditBranch(null);
      fetchBranches();
      incrementBranchesVersion();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update branch';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Toggle Active ──────────────────────────────────────────

  const handleToggleActive = (branch: BranchData) => {
    if (branch.isActive) {
      // Deactivating — show confirmation dialog
      setDeactivateTarget(branch);
    } else {
      // Activating — no confirmation needed, just do it
      confirmToggleActive(branch);
    }
  };

  const confirmToggleActive = async (branch: BranchData) => {
    try {
      setTogglingId(branch.id);
      const newActive = !branch.isActive;
      await api.put(`/api/restaurants/${restaurantId}/branches/${branch.id}`, {
        isActive: newActive,
      });
      toast.success(
        newActive
          ? `"${branch.name}" has been activated`
          : `"${branch.name}" has been deactivated`
      );
      setDeactivateTarget(null);
      fetchBranches();
      incrementBranchesVersion();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading branches...</span>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">You do not have permission to view branches.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-[11px] text-muted-foreground">Total Branches</p>
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
            <p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
            <p className="text-[11px] text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { key: 'all', label: 'All', count: totalCount },
          { key: 'active', label: 'Active', count: activeCount },
          { key: 'inactive', label: 'Inactive', count: inactiveCount },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`ml-1 ${statusFilter === tab.key ? 'text-primary' : 'text-muted-foreground'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Search & Add ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button className="gap-1.5 shrink-0" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Branch
          </Button>
        )}
      </div>

      {/* ── Branch Cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBranches.map((branch) => {
          const isToggling = togglingId === branch.id;
          const tableCount = branch._count?.tables || 0;
          const floorCount = branch._count?.floors || 0;
          const kitchenStationCount = branch._count?.kitchenStations || 0;
          const qrCodeCount = branch._count?.qrCodes || 0;

          return (
            <Card
              key={branch.id}
              className={`hover:shadow-md transition-shadow ${!branch.isActive ? 'opacity-70' : ''}`}
            >
              <CardContent className="p-4">
                {/* Header: icon + name + badges */}
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{branch.name}</span>
                      {branch.isMainBranch && (
                        <Badge className="text-[10px] border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0">
                          <Star className="h-3 w-3 mr-0.5" />
                          Main
                        </Badge>
                      )}
                      {!branch.isActive && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {branch.nameAm && (
                      <p className="text-xs text-muted-foreground mt-0.5">{branch.nameAm}</p>
                    )}

                    {/* Details */}
                    <div className="mt-2 space-y-0.5">
                      {branch.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">
                            {branch.address}{branch.city ? `, ${branch.city}` : ''}
                          </p>
                        </div>
                      )}
                      {!branch.address && branch.city && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{branch.city}</p>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground">{branch.phone}</p>
                        </div>
                      )}
                    </div>

                    {/* Counts row */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {tableCount} table{tableCount !== 1 ? 's' : ''}
                      </span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-[11px] text-muted-foreground">
                        {floorCount} floor{floorCount !== 1 ? 's' : ''}
                      </span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-[11px] text-muted-foreground">
                        {kitchenStationCount} station{kitchenStationCount !== 1 ? 's' : ''}
                      </span>
                      {qrCodeCount > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <QrCode className="h-3 w-3" />
                            {qrCodeCount} QR
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => openEditDialog(branch)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant={branch.isActive ? 'outline' : 'default'}
                          size="sm"
                          className={`h-6 text-[10px] gap-1 ${
                            branch.isActive
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          onClick={() => handleToggleActive(branch)}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : branch.isActive ? (
                            <PowerOff className="h-3 w-3" />
                          ) : (
                            <Power className="h-3 w-3" />
                          )}
                          {branch.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Empty States ── */}
      {branches.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No branches yet</p>
            {canManage && (
              <Button className="mt-4" size="sm" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first branch
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {branches.length > 0 && filteredBranches.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No branches match your search</p>
            <Button variant="link" size="sm" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ADD BRANCH DIALOG                                        */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add Branch
            </DialogTitle>
            <DialogDescription>
              Create a new branch for your restaurant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addBranchName">Name</Label>
              <Input
                id="addBranchName"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bole Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addBranchNameAm">Name (Amharic) — optional</Label>
              <Input
                id="addBranchNameAm"
                value={addForm.nameAm}
                onChange={(e) => setAddForm((f) => ({ ...f, nameAm: e.target.value }))}
                placeholder="e.g. ቦሌ ቅርንጫፍ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addBranchAddress">Address</Label>
              <Input
                id="addBranchAddress"
                value={addForm.address}
                onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. Bole Road, Near Edna Mall"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addBranchCity">City</Label>
              <Input
                id="addBranchCity"
                value={addForm.city}
                onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Addis Ababa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addBranchPhone">Phone</Label>
              <Input
                id="addBranchPhone"
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+251-11-XXX-XXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addBranchLat">Latitude</Label>
                <Input
                  id="addBranchLat"
                  value={addForm.latitude}
                  onChange={(e) => setAddForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="9.0222"
                  type="number"
                  step="any"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addBranchLng">Longitude</Label>
                <Input
                  id="addBranchLng"
                  value={addForm.longitude}
                  onChange={(e) => setAddForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="38.7469"
                  type="number"
                  step="any"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Main Branch</Label>
                <p className="text-[11px] text-muted-foreground">
                  Mark this as the primary branch
                </p>
              </div>
              <Switch
                checked={addForm.isMainBranch}
                onCheckedChange={(checked) => setAddForm((f) => ({ ...f, isMainBranch: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addBranchHours">Working Hours (JSON)</Label>
              <textarea
                id="addBranchHours"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                value={addForm.workingHours}
                onChange={(e) => setAddForm((f) => ({ ...f, workingHours: e.target.value }))}
                placeholder={'{\n  "mon": "8:00-22:00",\n  "tue": "8:00-22:00"\n}'}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional. Provide a JSON object with day-to-hour mappings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBranch} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* DEACTIVATE CONFIRMATION DIALOG                           */}
      {/* ══════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Deactivate &ldquo;{deactivateTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will take the branch offline. The following will happen immediately:
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 space-y-2.5">
                  {deactivateTarget?._count?.qrCodes ? (
                    <div className="flex items-start gap-2.5">
                      <QrCode className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-800 dark:text-red-300">
                          {deactivateTarget._count.qrCodes} QR code{deactivateTarget._count.qrCodes !== 1 ? 's' : ''} deactivated
                        </p>
                        <p className="text-[11px] text-red-700 dark:text-red-400">
                          Scanning any QR code at this branch will be rejected. Printed QR codes won&apos;t work until reactivated.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <QrCode className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-800 dark:text-red-300">
                          QR codes deactivated
                        </p>
                        <p className="text-[11px] text-red-700 dark:text-red-400">
                          Any QR codes associated with this branch will be deactivated. Scans will be rejected.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <UtensilsCrossed className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-800 dark:text-red-300">
                        No new customer orders
                      </p>
                      <p className="text-[11px] text-red-700 dark:text-red-400">
                        Customers won&apos;t be able to browse the menu or place orders at this branch.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <ChefHat className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-800 dark:text-red-300">
                        Kitchen & waiter views affected
                      </p>
                      <p className="text-[11px] text-red-700 dark:text-red-400">
                        New orders from this branch won&apos;t appear on the kitchen display or waiter views.
                      </p>
                    </div>
                  </div>
                </div>
                {deactivateTarget?.isMainBranch && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3">
                    <div className="flex items-start gap-2">
                      <Star className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          This is your main branch
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          You must set another branch as main before deactivating this one.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-3">
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    Existing in-progress orders will continue to be processed. You can reactivate this branch later to restore all QR codes and ordering.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateTarget && confirmToggleActive(deactivateTarget)}
              disabled={deactivateTarget?.isMainBranch || togglingId === deactivateTarget?.id}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {togglingId === deactivateTarget?.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deactivating...</>
              ) : (
                <><PowerOff className="h-4 w-4 mr-2" /> Deactivate Branch</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* EDIT BRANCH DIALOG                                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!editBranch}
        onOpenChange={(open) => {
          if (!open) setEditBranch(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Branch
            </DialogTitle>
            <DialogDescription>
              Update details for &ldquo;{editBranch?.name}&rdquo;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editBranchName">Name</Label>
              <Input
                id="editBranchName"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bole Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBranchNameAm">Name (Amharic) — optional</Label>
              <Input
                id="editBranchNameAm"
                value={editForm.nameAm}
                onChange={(e) => setEditForm((f) => ({ ...f, nameAm: e.target.value }))}
                placeholder="e.g. ቦሌ ቅርንጫፍ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBranchAddress">Address</Label>
              <Input
                id="editBranchAddress"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. Bole Road, Near Edna Mall"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBranchCity">City</Label>
              <Input
                id="editBranchCity"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Addis Ababa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBranchPhone">Phone</Label>
              <Input
                id="editBranchPhone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+251-11-XXX-XXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editBranchLat">Latitude</Label>
                <Input
                  id="editBranchLat"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="9.0222"
                  type="number"
                  step="any"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBranchLng">Longitude</Label>
                <Input
                  id="editBranchLng"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="38.7469"
                  type="number"
                  step="any"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Active</Label>
                <p className="text-[11px] text-muted-foreground">
                  {editForm.isActive ? 'Branch is currently active' : 'Branch is currently inactive'}
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => {
                  if (!checked && editBranch?.isActive) {
                    setEditForm((f) => ({ ...f, isActive: checked }));
                    setEditDeactivateWarning(true);
                  } else {
                    setEditForm((f) => ({ ...f, isActive: checked }));
                    setEditDeactivateWarning(false);
                  }
                }}
              />
            </div>
            {editDeactivateWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold">Deactivation Warning</span>
                </div>
                <ul className="text-[11px] text-amber-800 dark:text-amber-300 space-y-1 ml-6 list-disc">
                  <li>All QR codes for this branch will be deactivated — scanning will be rejected</li>
                  <li>Customers won&apos;t be able to place orders at this branch</li>
                  <li>Kitchen display won&apos;t receive new orders from this branch</li>
                  <li>Existing in-progress orders will continue to be processed</li>
                </ul>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 ml-6">
                  You can reactivate this branch later to restore all QR codes.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Main Branch</Label>
                <p className="text-[11px] text-muted-foreground">
                  Mark this as the primary branch
                </p>
              </div>
              <Switch
                checked={editForm.isMainBranch}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, isMainBranch: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBranchHours">Working Hours (JSON)</Label>
              <textarea
                id="editBranchHours"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                value={editForm.workingHours}
                onChange={(e) => setEditForm((f) => ({ ...f, workingHours: e.target.value }))}
                placeholder={'{\n  "mon": "8:00-22:00",\n  "tue": "8:00-22:00"\n}'}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional. Provide a JSON object with day-to-hour mappings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranch(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
