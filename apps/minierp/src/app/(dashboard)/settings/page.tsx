"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tenant configuration, billing, integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tenant</CardTitle>
          <CardDescription>
            Basic information about your restaurant chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Name</Label>
              <Input id="tenant-name" defaultValue="Demo Restaurant" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input id="tenant-slug" defaultValue="demo-restaurant" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" defaultValue="ETB" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">VAT rate</Label>
              <Input id="tax-rate" defaultValue="15%" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Subscription</CardTitle>
          <CardDescription>
            Current ERP plan. Upgrade or downgrade from the billing portal (Phase 1+).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">ERP Starter</p>
            <p className="text-xs text-muted-foreground">199 ETB / month</p>
          </div>
          <Badge>Active</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Integrations</CardTitle>
          <CardDescription>
            Connected sales channels. YeneQR pushes order/payment events here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100">
                <span className="text-sm font-bold text-orange-700">Y</span>
              </div>
              <div>
                <p className="text-sm font-medium">YeneQR</p>
                <p className="text-xs text-muted-foreground">
                  Order & payment events
                </p>
              </div>
            </div>
            <Badge variant="outline">Not connected</Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Integration setup arrives in Phase 1")}
          >
            + Add integration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
