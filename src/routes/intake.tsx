import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/intake")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/purchase-orders" });
  },
});