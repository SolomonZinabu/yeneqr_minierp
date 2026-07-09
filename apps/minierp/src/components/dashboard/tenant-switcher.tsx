"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { toast } from "sonner";

// Placeholder — in Phase 1 this will be wired to the user's tenant list.
// For now it shows a single "no tenant" state.

export function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const currentTenantName = "Demo Restaurant";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2 font-normal text-muted-foreground"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden font-medium text-foreground sm:inline">
            {currentTenantName}
          </span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Tenants</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            toast.info("Tenant switching is wired in Phase 1");
            setOpen(false);
          }}
        >
          <Check className="mr-2 h-4 w-4 opacity-100" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{currentTenantName}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            toast.info("Joining another tenant requires an invite");
            setOpen(false);
          }}
        >
          Join another tenant…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
