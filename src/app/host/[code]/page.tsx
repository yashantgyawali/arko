import { RoomProvider } from "@/lib/room-context";
import { HostConsole } from "@/components/host/HostConsole";

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <RoomProvider code={code}>
      <HostConsole />
    </RoomProvider>
  );
}
