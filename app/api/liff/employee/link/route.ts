import { NextResponse } from "next/server";
import { buildEmployeePaidLeaveSummary } from "@/lib/employeePaidLeave";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EmployeeSessionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lineUserId?: string; employeeCode4?: string };
    const lineUserId = body.lineUserId?.trim();
    const employeeCode4 = body.employeeCode4?.trim();

    if (!lineUserId || !employeeCode4) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "lineUserId, employeeCode4 は必須です。" },
        { status: 400 },
      );
    }

    if (!/^[0-9]{4}$/.test(employeeCode4)) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "社員コードは4桁の数字で入力してください。" },
        { status: 400 },
      );
    }

    const { data: existingLine, error: existingLineError } = await supabaseAdmin
      .from("m_employees")
      .select("id,employee_code_4")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    if (existingLineError) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: existingLineError.message },
        { status: 500 },
      );
    }
    if (existingLine && existingLine.employee_code_4 !== employeeCode4) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "このLINEアカウントは別の従業員に連携済みです。" },
        { status: 409 },
      );
    }

    const { data: employees, error } = await supabaseAdmin
      .from("m_employees")
      .select("id,tenant_id,employee_code_4,name,joined_on,is_active,line_user_id")
      .eq("employee_code_4", employeeCode4)
      .eq("is_active", true)
      .limit(2);

    if (error) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: error.message },
        { status: 500 },
      );
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "社員コードが見つかりません。" },
        { status: 404 },
      );
    }

    if (employees.length > 1) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "複数テナントで社員が一致しました。管理者へ確認してください。" },
        { status: 409 },
      );
    }

    const employee = employees[0];
    if (employee.line_user_id && employee.line_user_id !== lineUserId) {
      return NextResponse.json<EmployeeSessionResponse>(
        { ok: false, message: "この社員コードは別のLINEアカウントに連携済みです。" },
        { status: 409 },
      );
    }

    if (!employee.line_user_id) {
      const { error: updateError } = await supabaseAdmin
        .from("m_employees")
        .update({
          line_user_id: lineUserId,
          line_linked_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (updateError) {
        return NextResponse.json<EmployeeSessionResponse>(
          { ok: false, message: updateError.message },
          { status: 500 },
        );
      }

      await supabaseAdmin.from("t_line_link_events").insert({
        tenant_id: employee.tenant_id,
        target_type: "employee",
        target_id: employee.id,
        line_user_id: lineUserId,
        event_type: "link",
        payload: { employee_code_4: employeeCode4 },
        occurred_at: new Date().toISOString(),
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
