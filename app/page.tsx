import { EmployeeLiffApp } from "@/components/EmployeeLiffApp";
import { MobileLiffApp } from "@/components/MobileLiffApp";

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.role === "employee") {
    return <EmployeeLiffApp />;
  }
  return <MobileLiffApp />;
}
