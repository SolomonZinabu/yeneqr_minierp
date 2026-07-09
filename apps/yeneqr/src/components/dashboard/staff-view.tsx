'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { PERMISSIONS, ROLE_PERMISSIONS, resolveUserPermissions } from '@/lib/auth';
import {
  Users, Plus, Shield, UserCheck, UserCog, Headphones, UtensilsCrossed,
  Loader2, Armchair, KeyRound, Search, Pencil, Power, PowerOff, RotateCcw, Info, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ui/image-upload';

type StaffRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen_staff';

interface StaffData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: StaffRole;
  branchId: string;
  branch?: { id: string; name: string } | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  permissions?: string | null;
  additionalPermissions?: string | null;
  revokedPermissions?: string | null;
}

interface BranchData {
  id: string;
  name: string;
}

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: string;
}

// Permission categories for grouping (restaurant-level only, excluding platform & customer)
const PERMISSION_CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Restaurant',
    keys: [PERMISSIONS.RESTAURANT_MANAGE.key, PERMISSIONS.RESTAURANT_VIEW.key],
  },
  {
    label: 'Branch',
    keys: [PERMISSIONS.BRANCH_MANAGE.key, PERMISSIONS.BRANCH_VIEW.key],
  },
  {
    label: 'Staff',
    keys: [PERMISSIONS.STAFF_MANAGE.key, PERMISSIONS.STAFF_VIEW.key],
  },
  {
    label: 'Menu',
    keys: [PERMISSIONS.MENU_MANAGE.key, PERMISSIONS.MENU_VIEW.key],
  },
  {
    label: 'QR Codes',
    keys: [PERMISSIONS.QR_MANAGE.key, PERMISSIONS.QR_VIEW.key],
  },
  {
    label: 'Orders',
    keys: [PERMISSIONS.ORDER_VIEW.key, PERMISSIONS.ORDER_MANAGE.key, PERMISSIONS.ORDER_CREATE.key],
  },
  {
    label: 'Kitchen',
    keys: [PERMISSIONS.KITCHEN_MANAGE.key],
  },
  {
    label: 'Payments',
    keys: [PERMISSIONS.PAYMENT_MANAGE.key, PERMISSIONS.PAYMENT_VIEW.key],
  },
  {
    label: 'Analytics',
    keys: [PERMISSIONS.ANALYTICS_VIEW.key],
  },
  {
    label: 'Tables',
    keys: [PERMISSIONS.TABLE_MANAGE.key, PERMISSIONS.TABLE_VIEW.key],
  },
  {
    label: 'Subscription',
    keys: [PERMISSIONS.SUBSCRIPTION_MANAGE.key],
  },
];

// Build a lookup map for permission metadata
const PERMISSION_MAP: Record<string, { key: string; label: string; description: string }> = {};
Object.values(PERMISSIONS).forEach((p: { key: string; label: string; description: string }) => {
  PERMISSION_MAP[p.key] = p;
});

const roleConfig: Record<StaffRole, { label: string; color: string; icon: React.ElementType; description: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Shield, description: 'Full access to everything except platform admin' },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: UserCog, description: 'Manage all operations except subscription' },
  cashier: { label: 'Cashier', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: UserCheck, description: 'Handle orders and payments' },
  waiter: { label: 'Waiter', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Headphones, description: 'Take orders and manage tables' },
  kitchen_staff: { label: 'Kitchen', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: UtensilsCrossed, description: 'View orders and manage kitchen' },
};

function getInitials(name: string) {
  return (name || '').split(' ').map((n) => n[0]).join('').toUpperCase();
}

/** Safely parse a JSON string that may be null/undefined/invalid */
function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function StaffView() {
  const { isAddStaffOpen, setIsAddStaffOpen, user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const currentUserRole = user?.role || '';

  const [staff, setStaff] = useState<StaffData[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[StaffView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setStaff([]);
    setTables([]);
    fetchDataRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Add staff state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('waiter');
  const [newBranch, setNewBranch] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);

  // Edit staff state
  const [editStaff, setEditStaff] = useState<StaffData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('waiter');
  const [editBranch, setEditBranch] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [roleChangeWarning, setRoleChangeWarning] = useState(false);

  // Deactivate/Activate state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Table assignment state
  const [assigningWaiter, setAssigningWaiter] = useState<StaffData | null>(null);
  const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Permission management state
  const [permStaff, setPermStaff] = useState<StaffData | null>(null);
  const [permAdditional, setPermAdditional] = useState<string[]>([]);
  const [permRevoked, setPermRevoked] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Whether the current user can manage staff
  const canManageStaff = currentUserRole === 'owner' || currentUserRole === 'manager' || currentUserRole === 'super_admin';
  const canManagePermissions = canManageStaff;

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const staffParams = branchId ? `?branchId=${branchId}` : '';
      const tablesParams = branchId ? `?branchId=${branchId}` : '';
      const [staffRes, branchesRes, tablesRes] = await Promise.all([
        api.get<{ data: StaffData[] }>(`/api/restaurants/${restaurantId}/staff${staffParams}`),
        api.get<{ data: BranchData[] }>(`/api/restaurants/${restaurantId}/branches`),
        api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables${tablesParams}`),
      ]);

      setStaff(staffRes.data || []);
      const branchData = branchesRes.data || [];
      setBranches(branchData);
      setTables(tablesRes.data || []);
      if (branchData.length > 0 && !newBranch) {
        if (branchData[0]?.id) setNewBranch(branchData[0].id);
      }
    } catch (err) {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, selectedBranchId, branchChangeVersion]);

  // ── Filtered staff list ──
  const filteredStaff = useMemo(() => {
    let list = [...staff];
    if (roleFilter !== 'all') {
      list = list.filter((s) => s.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.branch?.name && s.branch.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [staff, roleFilter, searchQuery]);

  const roleCounts = staff.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = staff.filter((s) => s.isActive).length;
  const inactiveCount = staff.filter((s) => !s.isActive).length;

  // ── Add Staff ──
  const handleAvatarChange = (url: string | null) => {
    setNewAvatarUrl(url);
  };

  const handleAddStaff = async () => {
    if (!newName || !newEmail) {
      toast.error('Name and email are required');
      return;
    }
    try {
      setAdding(true);
      await api.post(`/api/restaurants/${restaurantId}/staff`, {
        name: newName,
        email: newEmail,
        phone: newPhone || null,
        role: newRole,
        branchId: newBranch,
        password: 'changeme123',
        avatar: newAvatarUrl,
      });
      toast.success(`${newName} added as ${roleConfig[newRole].label}`, {
        description: 'Default password: changeme123 (they should change it on first login)',
      });
      setIsAddStaffOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('waiter');
      setNewAvatarUrl(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add staff';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  // ── Edit Staff ──
  const openEditStaff = (s: StaffData) => {
    setEditStaff(s);
    setEditName(s.name);
    setEditEmail(s.email);
    setEditPhone(s.phone || '');
    setEditRole(s.role);
    setEditBranch(s.branchId);
    setEditAvatarUrl(s.avatar || null);
    setRoleChangeWarning(false);
  };

  const handleEditRoleChange = (newRoleVal: string) => {
    const role = newRoleVal as StaffRole;
    setEditRole(role);
    if (editStaff && role !== editStaff.role) {
      setRoleChangeWarning(true);
    } else {
      setRoleChangeWarning(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editStaff) return;
    if (!editName || !editEmail) {
      toast.error('Name and email are required');
      return;
    }
    try {
      setSavingEdit(true);
      const payload: Record<string, unknown> = {
        name: editName,
        email: editEmail,
        phone: editPhone || null,
        role: editRole,
        branchId: editBranch,
        avatar: editAvatarUrl,
      };
      // If role changed, clear permission overrides so the new role defaults apply
      if (editRole !== editStaff.role) {
        payload.additionalPermissions = null;
        payload.revokedPermissions = null;
        payload.permissions = null;
      }
      await api.put(`/api/restaurants/${restaurantId}/staff/${editStaff.id}`, payload);
      toast.success(`${editName}'s profile updated`, {
        description: editRole !== editStaff.role
          ? `Role changed to ${roleConfig[editRole].label}. Permissions reset to new role defaults.`
          : undefined,
      });
      setEditStaff(null);
      setRoleChangeWarning(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update staff';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Activate / Deactivate ──
  const handleToggleActive = async (s: StaffData) => {
    try {
      setTogglingId(s.id);
      const newActiveState = !s.isActive;
      await api.put(`/api/restaurants/${restaurantId}/staff/${s.id}`, {
        isActive: newActiveState,
      });
      toast.success(
        newActiveState
          ? `${s.name} has been activated`
          : `${s.name} has been deactivated`
      );
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Table Assignment ──
  const openAssignTables = async (waiter: StaffData) => {
    setAssigningWaiter(waiter);
    try {
      const res = await api.get<{ data: { assignedTableIds?: string[] }[] }>(
        `/api/restaurants/${restaurantId}/staff-assignments`,
        { role: 'waiter' }
      );
      const assignments = res.data || [];
      const myAssignment = assignments.find((a: Record<string, unknown>) => {
        const user = a.user as Record<string, unknown> | undefined;
        return user?.id === waiter.id;
      });
      setAssignedTableIds((myAssignment as Record<string, unknown>)?.assignedTableIds as string[] || []);
    } catch {
      setAssignedTableIds([]);
    }
  };

  const saveTableAssignment = async () => {
    if (!assigningWaiter) return;
    try {
      setSavingAssignment(true);
      await api.post(`/api/restaurants/${restaurantId}/staff-assignments`, {
        userId: assigningWaiter.id,
        branchId: assigningWaiter.branchId,
        role: 'waiter',
        assignedTables: assignedTableIds,
      });
      toast.success(`Table assignment saved for ${assigningWaiter.name}`);
      setAssigningWaiter(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save assignment';
      toast.error(msg);
    } finally {
      setSavingAssignment(false);
    }
  };

  // ── Permission Management ──
  const openPermissions = (staffMember: StaffData) => {
    setPermStaff(staffMember);
    setPermAdditional(parseJsonArray(staffMember.additionalPermissions));
    setPermRevoked(parseJsonArray(staffMember.revokedPermissions));
    setShowResetConfirm(false);
  };

  /**
   * Compute whether a permission is effectively ON or OFF,
   * and toggle it. The user just sees ON/OFF; under the hood
   * we track additionalPermissions and revokedPermissions.
   */
  const isPermissionOn = useCallback(
    (permKey: string) => {
      if (!permStaff) return false;
      const effective = resolveUserPermissions(permStaff.role, {
        additionalPermissions: permAdditional,
        revokedPermissions: permRevoked,
      });
      return effective.includes(permKey);
    },
    [permStaff, permAdditional, permRevoked]
  );

  const togglePermission = (permKey: string, turnedOn: boolean) => {
    if (!permStaff) return;
    const roleDefaults = ROLE_PERMISSIONS[permStaff.role] || [];
    const isInRoleDefaults = roleDefaults.includes(permKey);

    if (turnedOn) {
      // Turning ON
      if (isInRoleDefaults) {
        // Was revoked from role defaults → remove from revoked
        setPermRevoked((prev) => prev.filter((k) => k !== permKey));
      } else {
        // Not in role defaults → add to additional
        setPermAdditional((prev) => (prev.includes(permKey) ? prev : [...prev, permKey]));
      }
    } else {
      // Turning OFF
      if (isInRoleDefaults) {
        // Part of role defaults → add to revoked
        setPermRevoked((prev) => (prev.includes(permKey) ? prev : [...prev, permKey]));
      } else {
        // Was additionally granted → remove from additional
        setPermAdditional((prev) => prev.filter((k) => k !== permKey));
      }
    }
  };

  const handleResetToRoleDefaults = () => {
    setPermAdditional([]);
    setPermRevoked([]);
    setShowResetConfirm(false);
    toast.success('Permissions reset to role defaults');
  };

  const savePermissions = async () => {
    if (!permStaff) return;
    try {
      setSavingPermissions(true);
      await api.put(`/api/restaurants/${restaurantId}/staff/${permStaff.id}`, {
        additionalPermissions: permAdditional.length > 0 ? permAdditional : null,
        revokedPermissions: permRevoked.length > 0 ? permRevoked : null,
      });
      toast.success(`Permissions updated for ${permStaff.name}`, {
        description: 'Changes will take effect when they next log in',
      });
      setPermStaff(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update permissions';
      toast.error(msg);
    } finally {
      setSavingPermissions(false);
    }
  };

  // Compute effective permissions for the staff member being edited
  const getEffectivePermissions = useCallback(() => {
    if (!permStaff) return [];
    return resolveUserPermissions(permStaff.role, {
      additionalPermissions: permAdditional,
      revokedPermissions: permRevoked,
    });
  }, [permStaff, permAdditional, permRevoked]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading staff...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{staff.length}</p>
            <p className="text-[11px] text-muted-foreground">Total Staff</p>
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
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {staff.filter((s) => {
                const add = parseJsonArray(s.additionalPermissions);
                const rev = parseJsonArray(s.revokedPermissions);
                return add.length > 0 || rev.length > 0;
              }).length}
            </p>
            <p className="text-[11px] text-muted-foreground">Custom Perms</p>
          </CardContent>
        </Card>
      </div>

      {/* Search / Filter / Add Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {(Object.entries(roleConfig) as [StaffRole, typeof roleConfig[StaffRole]][]).map(([role, config]) => (
              <SelectItem key={role} value={role}>
                <span className="flex items-center gap-2">
                  <config.icon className="h-3.5 w-3.5" />
                  {config.label}
                  {roleCounts[role] ? ` (${roleCounts[role]})` : ''}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="gap-1.5 shrink-0" onClick={() => setIsAddStaffOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* Staff Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStaff.map((s) => {
          const config = roleConfig[s.role] || roleConfig.waiter;
          const additionalPerms = parseJsonArray(s.additionalPermissions);
          const revokedPerms = parseJsonArray(s.revokedPermissions);
          const hasOverrides = additionalPerms.length > 0 || revokedPerms.length > 0;
          const isToggling = togglingId === s.id;

          return (
            <Card key={s.id} className={`hover:shadow-md transition-shadow ${!s.isActive ? 'opacity-70' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    {s.avatar && <AvatarImage src={s.avatar} alt={s.name} />}
                    <AvatarFallback className={`text-xs font-semibold ${s.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {getInitials(s.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.name}</span>
                      {!s.isActive && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className={`text-[10px] border-0 ${config.color}`}>
                        <config.icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      {hasOverrides && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/20">
                          <KeyRound className="h-2.5 w-2.5 mr-0.5" />
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                      <p className="text-xs text-muted-foreground">{s.branch?.name || 'No branch'}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {canManageStaff && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => openEditStaff(s)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                      )}
                      {canManagePermissions && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => openPermissions(s)}
                        >
                          <KeyRound className="h-3 w-3" />
                          Permissions
                        </Button>
                      )}
                      {s.role === 'waiter' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => openAssignTables(s)}
                        >
                          <Armchair className="h-3 w-3" />
                          Tables
                        </Button>
                      )}
                      {canManageStaff && (
                        <Button
                          variant={s.isActive ? 'outline' : 'default'}
                          size="sm"
                          className={`h-6 text-[10px] gap-1 ${
                            s.isActive
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          onClick={() => handleToggleActive(s)}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : s.isActive ? (
                            <PowerOff className="h-3 w-3" />
                          ) : (
                            <Power className="h-3 w-3" />
                          )}
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty States */}
      {staff.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No staff members yet</p>
            <Button className="mt-4" size="sm" onClick={() => setIsAddStaffOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first staff member
            </Button>
          </CardContent>
        </Card>
      )}
      {staff.length > 0 && filteredStaff.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No staff match your search</p>
            <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ADD STAFF DIALOG                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add a new team member. They will receive a default password to change on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <ImageUpload
                currentImage={null}
                onImageChange={handleAvatarChange}
                entity="avatar"
                entityId="new-staff"
                size={96}
                height={96}
                shape="circle"
                label="Add photo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffName">Full Name</Label>
              <Input id="staffName" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffEmail">Email</Label>
              <Input id="staffEmail" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffPhone">Phone</Label>
              <Input id="staffPhone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+251-9XX-XXX-XXXX" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(roleConfig) as [StaffRole, typeof roleConfig[StaffRole]][]).map(([role, config]) => (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          <config.icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newRole && (
                  <p className="text-[11px] text-muted-foreground">{roleConfig[newRole].description}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={newBranch} onValueChange={setNewBranch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-muted/50 rounded-md px-3 py-2 flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Default password: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">changeme123</code>
                </p>
                <p className="text-[11px] text-muted-foreground/70">The new staff member should change this on first login.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStaff} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* EDIT STAFF DIALOG                                           */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Dialog open={!!editStaff} onOpenChange={(open) => { if (!open) { setEditStaff(null); setRoleChangeWarning(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update profile for {editStaff?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <ImageUpload
                currentImage={editAvatarUrl}
                onImageChange={(url) => setEditAvatarUrl(url)}
                entity="avatar"
                entityId={editStaff?.id || 'edit-staff'}
                size={96}
                height={96}
                shape="circle"
                label="Change photo"
              />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+251-9XX-XXX-XXXX" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={handleEditRoleChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(roleConfig) as [StaffRole, typeof roleConfig[StaffRole]][]).map(([role, config]) => (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          <config.icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editRole && (
                  <p className="text-[11px] text-muted-foreground">{roleConfig[editRole].description}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={editBranch} onValueChange={setEditBranch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role change warning */}
            {roleChangeWarning && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Role change will reset permissions
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Changing from {editStaff ? roleConfig[editStaff.role].label : ''} to {roleConfig[editRole].label} will reset all custom permissions to the new role defaults. You can customize permissions again after saving.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditStaff(null); setRoleChangeWarning(false); }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TABLE ASSIGNMENT DIALOG                                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Dialog open={!!assigningWaiter} onOpenChange={(open) => { if (!open) setAssigningWaiter(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-primary" />
              Assign Tables to {assigningWaiter?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select which tables this waiter is responsible for. When an order at these tables becomes ready, this waiter will be notified to pick it up.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tables.map((table) => (
                <label
                  key={table.id}
                  className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={assignedTableIds.includes(table.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignedTableIds((prev) => [...prev, table.id]);
                      } else {
                        setAssignedTableIds((prev) => prev.filter((id) => id !== table.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Table {table.number}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      (capacity: {table.capacity})
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      table.status === 'available'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : table.status === 'occupied'
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {table.status}
                  </Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {assignedTableIds.length} table{assignedTableIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningWaiter(null)}>Cancel</Button>
            <Button onClick={saveTableAssignment} disabled={savingAssignment}>
              {savingAssignment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* PERMISSION MANAGEMENT DIALOG (Simplified)                   */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Dialog open={!!permStaff} onOpenChange={(open) => { if (!open) setPermStaff(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="flex flex-col max-h-[85vh]">
            {/* Header — pinned */}
            <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Manage Permissions
              </DialogTitle>
              <DialogDescription>
                Customize permissions for <strong>{permStaff?.name}</strong> ({permStaff ? roleConfig[permStaff.role]?.label : ''})
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-3">
              {/* "Changes take effect on next login" banner */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Permission changes will take effect when this staff member next logs in. Their current session will continue with the old permissions.
                </p>
              </div>

              {/* Effective permissions count + actions */}
              {permStaff && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Effective permissions: <strong>{getEffectivePermissions().length}</strong> of {PERMISSION_CATEGORIES.reduce((sum, cat) => sum + cat.keys.length, 0)}
                    {permAdditional.length > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 ml-1">(+{permAdditional.length} added)</span>
                    )}
                    {permRevoked.length > 0 && (
                      <span className="text-red-500 dark:text-red-400 ml-1">(-{permRevoked.length} removed)</span>
                    )}
                  </p>
                  <div className="relative">
                    {showResetConfirm ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Reset?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={handleResetToRoleDefaults}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setShowResetConfirm(false)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => setShowResetConfirm(true)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to Role Defaults
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Permission categories with simple ON/OFF toggles */}
              <div className="space-y-4">
                {PERMISSION_CATEGORIES.map((category) => {
                  if (!permStaff) return null;
                  const roleDefaults = ROLE_PERMISSIONS[permStaff.role] || [];
                  const effectivePerms = getEffectivePermissions();

                  // Check if any permission in this category is customized
                  const hasCustomInCategory = category.keys.some((k) => {
                    return permAdditional.includes(k) || permRevoked.includes(k);
                  });

                  return (
                    <div key={category.label}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {category.label}
                        </h4>
                        {hasCustomInCategory && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/20">
                            Customized
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        {category.keys.map((permKey) => {
                          const permInfo = PERMISSION_MAP[permKey];
                          if (!permInfo) return null;

                          const isOn = effectivePerms.includes(permKey);
                          const isInRoleDefaults = roleDefaults.includes(permKey);
                          const isAdditional = permAdditional.includes(permKey);
                          const isRevoked = permRevoked.includes(permKey);

                          // Determine source label
                          let sourceLabel: string | null = null;
                          if (isAdditional) {
                            sourceLabel = 'Added';
                          } else if (isRevoked) {
                            sourceLabel = 'Removed';
                          } else if (isInRoleDefaults && isOn) {
                            sourceLabel = 'From role';
                          }

                          return (
                            <div
                              key={permKey}
                              className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                                isAdditional
                                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20'
                                  : isRevoked
                                    ? 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-900/10'
                                    : 'border-transparent hover:bg-muted/50'
                              }`}
                            >
                              {/* Toggle switch */}
                              <Switch
                                checked={isOn}
                                onCheckedChange={(checked) => togglePermission(permKey, checked)}
                                className="shrink-0"
                              />

                              {/* Permission info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-sm font-medium ${!isOn ? 'text-muted-foreground' : ''}`}>
                                    {permInfo.label}
                                  </span>
                                  {sourceLabel && (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[8px] px-1 py-0 h-3.5 ${
                                        isAdditional
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                          : isRevoked
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                            : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {sourceLabel}
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-[11px] ${!isOn ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                  {permInfo.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer — pinned at bottom */}
            <div className="shrink-0 border-t px-6 py-4 bg-background">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (permStaff) {
                      setPermAdditional(parseJsonArray(permStaff.additionalPermissions));
                      setPermRevoked(parseJsonArray(permStaff.revokedPermissions));
                    }
                  }}
                >
                  Undo Changes
                </Button>
                <Button variant="outline" onClick={() => setPermStaff(null)}>Cancel</Button>
                <Button onClick={savePermissions} disabled={savingPermissions}>
                  {savingPermissions ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Permissions
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
