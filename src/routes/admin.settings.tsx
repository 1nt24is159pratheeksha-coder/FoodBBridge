import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/rf/ui";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [
    { title: "Settings | ResQFood AI" },
    { name: "description", content: "Platform settings for ResQFood AI operations." },
    { property: "og:title", content: "Settings | ResQFood AI" },
    { property: "og:description", content: "Manage ResQFood AI platform preferences." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Settings,
});

const prefs = [
  ["Require photo for every surplus", "Kitchens must send a food photo on WhatsApp.", true],
  ["Auto-expire surplus after window", "Hide surplus once its redistribution window ends.", true],
  ["Email me AI verification rejections", "Daily summary of registrations the AI rejected, with reasons.", false],
] as const;

function Settings() {
  return <>
    <PageTitle title="Settings" subtitle="Platform preferences (demo — not saved yet)." />
    <div className="surface divide-y divide-border p-0">
      {prefs.map(([t, d, on]) => <label key={t} className="flex items-center justify-between gap-4 p-4"><span><span className="block text-sm font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span><Switch defaultChecked={on} /></label>)}
    </div>
  </>;
}
