import { JoinForm } from "@/components/guest/JoinForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const initialCode = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return <JoinForm initialCode={initialCode} />;
}
