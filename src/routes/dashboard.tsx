import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL from earlier demo: forwards to the new Admin dashboard or Driver portal.
export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({ role: search["role"] === "driver" ? "driver" : "admin" }),
  beforeLoad: ({ search }) => { throw redirect({ to: search.role === "driver" ? "/driver" : "/admin", replace: true }); },
});
