import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracion")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "config" } });
  },
});