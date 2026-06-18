import { LiffEntry } from "@/components/LiffEntry";

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.role === "employee") {
    return <LiffEntry forceRole="employee" />;
  }
  if (params.role === "customer") {
    return <LiffEntry forceRole="customer" />;
  }
  return <LiffEntry />;
}
