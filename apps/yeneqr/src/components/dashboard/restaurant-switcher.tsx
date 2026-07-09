'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore, type UserRestaurant } from '@/lib/store';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { slugPath } from '@/lib/router';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Check,
  ChevronsUpDown,
  Loader2,
  ArrowLeft,
  Shield,
} from 'lucide-react';

export function RestaurantSwitcher() {
  const user = useAppStore((s) => s.user);
  const token = useAppStore((s) => s.token);
  const userRestaurants = useAppStore((s) => s.userRestaurants);
  const setUserRestaurants = useAppStore((s) => s.setUserRestaurants);
  const switchRestaurant = useAppStore((s) => s.switchRestaurant);
  const storeLogout = useAppStore((s) => s.logout);

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentRestaurantId = user?.restaurantId;
  const isAdminImpersonation = user?.isAdminImpersonation;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'support_admin';

  // For non-admin staff who only belong to one restaurant, just show the name (no switcher)
  const showSwitcher = isAdmin || userRestaurants.length > 1;

  // Fetch user's restaurants on mount
  const fetchRestaurants = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{
        type: string;
        currentRestaurantId?: string;
        restaurants: UserRestaurant[];
      }>('/api/auth/my-restaurants');

      const restaurants = res.restaurants || [];
      setUserRestaurants(restaurants);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    } finally {
      setLoading(false);
    }
  }, [token, setUserRestaurants]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const handleSwitch = async (restaurant: UserRestaurant) => {
    if (restaurant.id === currentRestaurantId) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await api.post<{
        message: string;
        token: string;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
          twoFactorEnabled: boolean;
          restaurant: {
            id: string;
            name: string;
            nameAm?: string;
            slug: string;
            cuisineType?: string;
            logo?: string;
            defaultLanguage?: string;
            currency?: string;
          };
          branch: { id: string; name: string } | null;
        };
        isAdminImpersonation?: boolean;
        originalRole?: string;
      }>('/api/auth/switch-restaurant', { restaurantId: restaurant.id });

      const newAuthUser = {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        restaurantId: res.user.restaurant?.id,
        restaurantName: res.user.restaurant?.name,
        restaurantSlug: res.user.restaurant?.slug,
        branchId: res.user.branch?.id,
        isAdminImpersonation: res.isAdminImpersonation || false,
        originalRole: res.originalRole,
      };

      switchRestaurant(res.token, newAuthUser);
      setOpen(false);

      // Navigate to the new restaurant's slug-prefixed dashboard
      const slug = res.user.restaurant?.slug || res.user.restaurant?.id;
      window.location.hash = slugPath(slug, '/dashboard');
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to switch restaurant:', err);
      alert(err.message || 'Failed to switch restaurant');
    } finally {
      setSwitching(false);
    }
  };

  const handleBackToAdmin = () => {
    // Clear current restaurant context and go to admin
    storeLogout();
    window.location.hash = '/admin';
    window.location.reload();
  };

  const currentRestaurant = userRestaurants.find(r => r.id === currentRestaurantId);
  const otherRestaurants = userRestaurants.filter(r => r.id !== currentRestaurantId);

  return (
    <div className="px-3 py-2">
      {/* Admin impersonation banner */}
      {isAdminImpersonation && (
        <div className="mb-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
              Admin View
            </span>
          </div>
          <button
            onClick={handleBackToAdmin}
            className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <ArrowLeft className="h-2.5 w-2.5" />
            Back to Admin Panel
          </button>
        </div>
      )}

      {/* Show switcher only for admins or multi-restaurant users */}
      {showSwitcher ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Select a restaurant"
              className={cn(
                'w-full justify-between h-auto py-2 px-3 text-left font-normal',
                'hover:bg-accent/80'
              )}
              disabled={switching}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {user?.restaurantName || 'Select Restaurant'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isAdmin ? 'Admin Access' : currentRestaurant?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              </div>
              {switching ? (
                <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search restaurants..." />
              <CommandList>
                <CommandEmpty>No restaurant found.</CommandEmpty>

                {/* Current restaurant */}
                {currentRestaurant && (
                  <CommandGroup heading="Current">
                    <CommandItem
                      onSelect={() => setOpen(false)}
                      className="cursor-default"
                    >
                      <Check className="mr-2 h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{currentRestaurant.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {currentRestaurant.city || currentRestaurant.cuisineType || currentRestaurant.slug}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1 shrink-0">
                        {currentRestaurant.role === 'super_admin' ? 'Admin' : currentRestaurant.role}
                      </Badge>
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Other restaurants */}
                {otherRestaurants.length > 0 && (
                  <CommandGroup heading="Switch to">
                    {otherRestaurants.map((restaurant) => (
                      <CommandItem
                        key={restaurant.id}
                        onSelect={() => handleSwitch(restaurant)}
                        disabled={switching}
                        className="cursor-pointer"
                      >
                        <div className="mr-2 h-4 w-4 flex items-center justify-center">
                          {switching ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Store className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{restaurant.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {restaurant.city || restaurant.cuisineType || restaurant.slug}
                            {restaurant.branchCount > 0 && ` · ${restaurant.branchCount} branch${restaurant.branchCount > 1 ? 'es' : ''}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 shrink-0">
                          {restaurant.role === 'super_admin' ? 'Admin' : restaurant.role}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Loading state */}
                {loading && (
                  <CommandGroup>
                    <CommandItem disabled className="justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        /* Non-admin, single-restaurant: just show the name, no dropdown */
        <div className="rounded-lg bg-accent/50 px-3 py-2">
          <p className="text-xs font-medium truncate">
            {user?.restaurantName || 'Restaurant'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentRestaurant?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || user?.role}
          </p>
        </div>
      )}
    </div>
  );
}
