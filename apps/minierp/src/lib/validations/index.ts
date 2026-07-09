import { z } from "zod";

// ────────────────────────────────────────────────────────────
//  Auth
// ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ────────────────────────────────────────────────────────────
//  Tenant provisioning (called by YeneQR admin)
// ────────────────────────────────────────────────────────────

export const provisionTenantSchema = z.object({
  yeneqrRestaurantId: z.string().min(1),
  restaurantName: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).default("ETB"),
  planSlug: z.enum(["erp_starter", "erp_pro", "erp_enterprise"]).default("erp_starter"),
});

export type ProvisionTenantInput = z.infer<typeof provisionTenantSchema>;

// ────────────────────────────────────────────────────────────
//  YeneQR webhook payloads
// ────────────────────────────────────────────────────────────

export const yeneqrWebhookSchema = z.object({
  event: z.string().min(1),
  timestamp: z.string().or(z.number()).optional(),
  data: z.unknown(),
  externalId: z.string().optional(),
});

export type YeneqrWebhookInput = z.infer<typeof yeneqrWebhookSchema>;
