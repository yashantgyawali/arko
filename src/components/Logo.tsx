export function Logo({
  height = 32,
  invert = false,
}: {
  height?: number;
  invert?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/arko-logo.svg"
      alt="arko"
      style={{ height, width: "auto", display: "block", filter: invert ? "invert(1)" : undefined }}
    />
  );
}
