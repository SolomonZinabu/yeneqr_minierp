"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { TenantSwitcher } from "@/components/dashboard/tenant-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export function Topbar() {
  const { user, isLoading } = useCurrentUser();

  async function handleSignOut() {
    // Clear the HTTP-only cookie by setting it expired
    document.cookie = "merp_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure";
    toast.success("Signed out");
    window.location.href = "/login";
  }

  const initials = user?.user.name
    ? user.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : user?.user.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
      <TenantSwitcher />
      <div className="ml-auto flex items-center gap-2">
        {isLoading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user.user.name ?? user.user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{user.user.name ?? "Account"}</p>
                <p className="truncate text-xs text-muted-foreground">{user.user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">{user.role} · {user.permissions.length} permissions</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
