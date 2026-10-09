import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, MockNote } from "@/components/rf/ui";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({ meta: [{ title: "Profile | ResQFood AI" }, { name: "description", content: "Admin profile for ResQFood AI operations." }] }),
  component: Profile,
});

function Profile() {
  return <>
    <PageTitle title="Profile" subtitle="Your admin account." actions={<MockNote>Demo account — no authentication yet.</MockNote>} />
    <div className="surface flex items-center gap-4">
      <span className="flex size-14 items-center justify-center rounded-full bg-highlight text-lg font-bold text-primary">AD</span>
      <div><p className="font-display text-lg font-bold">Admin</p><p className="text-sm text-muted-foreground">admin@resqfood.ai · ResQFood Operations</p><p className="mt-1 text-xs text-muted-foreground">Role: Platform administrator (monitoring)</p></div>
    </div>
  </>;
}
