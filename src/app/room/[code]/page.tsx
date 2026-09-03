import { RoomProvider } from "@/lib/room-context";
import { GuestApp } from "@/components/guest/GuestApp";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <RoomProvider code={code}>
      <GuestApp />
    </RoomProvider>
  );
}
