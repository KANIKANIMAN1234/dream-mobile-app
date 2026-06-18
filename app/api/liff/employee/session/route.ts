import { NextResponse } from "next/server";
import { buildEmployeePaidLeaveSummary, findEmployeeByLineUserId } from "@/lib/employeePaidLeave";
import type { EmployeeSessionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lineUserId?: string };
    const lineUserId = body.lineUserId?.trim();
    if (!lineUserId) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "lineUserId が必要です。" },
        { status: 400 },
      );
    }

    const employee = await findEmployeeByLineUserId(lineUserId);
    if (!employee) {
      return NextResponse.json<EmployeeSessionResponse>({
        ok: true,
        linked: false,
        message: "初回紐付けが必要です。",
      });
    }

    const paidLeave = await buildEmployeePaidLeaveSummary(
      employee.tenant_id as string,
      employee.id as string,
      (employee.joined_on as string | null) ?? null,
    );

    return NextResponse.json<EmployeeSessionResponse>({
      ok: true,
      linked: true,
      employee: {
        id: employee.id as string,
        employee_code_4: employee.employee_code_4 as string,
        name: employee.name as string,
      },
      paidLeave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json<EmployeeSessionResponse>({ ok: false, message }, { status: 500 });
  }
}
