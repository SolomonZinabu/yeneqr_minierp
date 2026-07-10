// GET/POST /api/hr/attendance
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const attendanceSchema = z.object({
  employeeId: z.string().min(1), orgNodeId: z.string().optional().nullable(),
  date: z.string().datetime(),
  checkIn: z.string().datetime().optional().nullable(), checkOut: z.string().datetime().optional().nullable(),
  workedHours: z.number().min(0).default(0),
  otHoursRegular: z.number().min(0).default(0), otHoursRest: z.number().min(0).default(0), otHoursPublic: z.number().min(0).default(0),
  status: z.enum(["present", "absent", "leave", "holiday", "rest_day"]).default("present"),
  leaveType: z.string().max(50).optional().nullable(), notes: z.string().max(500).optional().nullable(),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const records = await db.attendanceRecord.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    include: { employee: { select: { id: true, employeeNumber: true, fullName: true, department: true } } },
    orderBy: { date: "desc" }, take: limit,
  });
  return Response.json({ records });
});

export const POST = withTenant(async ({ req }) => {
  const data = await parseAndValidate(req, attendanceSchema);
  const date = new Date(data.date); date.setHours(0, 0, 0, 0);
  const record = await db.attendanceRecord.upsert({
    where: { tenantId_employeeId_date: { tenantId: "", employeeId: data.employeeId, date } as never },
    create: {
      tenantId: getCurrentTenantId()!, employeeId: data.employeeId, orgNodeId: data.orgNodeId ?? null, date,
      checkIn: data.checkIn ? new Date(data.checkIn) : null, checkOut: data.checkOut ? new Date(data.checkOut) : null,
      workedHours: data.workedHours, otHoursRegular: data.otHoursRegular, otHoursRest: data.otHoursRest, otHoursPublic: data.otHoursPublic,
      status: data.status, leaveType: data.leaveType ?? null, notes: data.notes ?? null,
    },
    update: {
      checkIn: data.checkIn ? new Date(data.checkIn) : null, checkOut: data.checkOut ? new Date(data.checkOut) : null,
      workedHours: data.workedHours, otHoursRegular: data.otHoursRegular, otHoursRest: data.otHoursRest, otHoursPublic: data.otHoursPublic,
      status: data.status, leaveType: data.leaveType ?? null, notes: data.notes ?? null,
    },
  });
  return Response.json({ record }, { status: 201 });
});
