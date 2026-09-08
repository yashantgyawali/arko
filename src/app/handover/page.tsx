import { HandoverClaim } from "@/components/host/HandoverClaim";

/**
 * Its own route rather than a segment under /host, so a handover link can
 * never be confused with a room code.
 */
export default async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <HandoverClaim token={(token ?? "").trim()} />;
}
