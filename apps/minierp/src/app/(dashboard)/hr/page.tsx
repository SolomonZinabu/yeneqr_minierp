import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function HrPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR & Payroll</h1>
          <p className="text-sm text-muted-foreground">Phase 3</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What you&apos;ll get in Phase 3</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Employee master</strong> — Ethiopian fields (father name, grandfather name), position, branch, contract, bank account.</li>
            <li>• <strong>Attendance</strong> — mobile/PIN clock-in/out → daily work entries → monthly payroll input.</li>
            <li>• <strong>Work schedules</strong> — morning/evening split-shift for kitchen staff, Ethiopian public holidays.</li>
            <li>• <strong>Salary rules + DAG evaluator</strong> — ported from TechBee&apos;s Python formula engine to TypeScript using mathjs. Rules form a DAG: BASIC → GROSS → TAXABLE → PIT → PENSION → NET.</li>
            <li>• <strong>Ethiopian-compliant payroll</strong> — PIT brackets (0–600 Birr exempt, progressive to 35%), pension (7% employee / 11% employer), OT 125%/150%/200%.</li>
            <li>• <strong>Payroll run</strong> — select period + branch → evaluate rules → generate payslips → auto-post to GL (Dr Salaries / Cr Bank, Cr Pension Payable, Cr PIT Payable).</li>
            <li>• <strong>Loans & advances</strong> — staff borrow against next salary, auto-deduct installment from payroll.</li>
            <li>• <strong>Leave</strong> — annual/sick/unpaid, balance tracking, approval workflow.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
