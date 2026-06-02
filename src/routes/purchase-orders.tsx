import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/purchase-orders")({
  ssr: false,
  component: () => <Outlet />,
});