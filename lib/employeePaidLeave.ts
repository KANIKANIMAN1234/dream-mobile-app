import { supabaseAdmin } from "@/lib/supabaseAdmin";

function daysBetweenInclusive(startYmd: string, endYmd: string) {
  const start = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

function calcGrantedDays(joinedOn: string | null, year: number) {
  if (!joinedOn) return 10;
  const joined = new Date(`${joinedOn}T00:00:00Z`);
  const base = new Date(Date.UTC(year, 0, 1));
  const years = Math.max(0, base.getUTCFullYear() - joined.getUTCFullYear());
  return Math.min(20, 10 + years);
}

export async function buildEmployeePaidLeaveSummary(
  tenantId: string,
  employeeId: string,
  joinedOn: string | null,
  year = new Date().getFullYear(),
) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { data: leaves, error } = await supabaseAdmin
    .from("t_leave_requests")
    .select("leave_type,start_date,end_date,status")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from)
    .limit(5000);

  if (error) throw new Error(error.message);

  let usedDays = 0;
  for (const row of leaves ?? []) {
    const leaveType = row.leave_type as string;
    const isPaid =
      leaveType.includes("有休") ||
      leaveType.toLowerCase().includes("paid") ||
      leaveType.toLowerCase().includes("annual");
    if (!isPaid) continue;
    const startDate = row.start_date as string;
    const endDate = row.end_date as string;
    const clippedStart = startDate < from ? from : startDate;
    const clippedEnd = endDate > to ? to : endDate;
    usedDays += daysBetweenInclusive(clippedStart, clippedEnd);
  }

  const grantedDays = calcGrantedDays(joinedOn, year);
  const remainingDays = Math.max(0, grantedDays - usedDays);
  const mandatoryProgress = Math.min(5, usedDays);

  return { grantedDays, usedDays, remainingDays, mandatoryProgress };
}

export async function findEmployeeByLineUserId(lineUserId: string) {
  const { data: employee, error } = await supabaseAdmin
    .from("m_employees")
    .select("id,tenant_id,employee_code_4,name,joined_on,is_active,line_user_id")
    .eq("line_user_id", lineUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return employee;
}
