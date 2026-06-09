import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/delegations")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "delegations" } });
  },
});
