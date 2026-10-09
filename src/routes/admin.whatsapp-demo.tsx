import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/rf/ui";
import { WhatsAppAssessments } from "@/components/resq/whatsapp-assessments";
import { WhatsAppDemo } from "@/components/rf/whatsapp-demo";

export const Route = createFileRoute("/admin/whatsapp-demo")({
  head: () => ({ meta: [
    { title: "WhatsApp Demo | ResQFood AI" },
    { name: "description", content: "Simulated WhatsApp conversations for kitchens and NGOs." },
    { property: "og:title", content: "WhatsApp Demo | ResQFood AI" },
    { property: "og:description", content: "Simulated WhatsApp-style demo of the ResQFood AI assistant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <>
    <PageTitle title="WhatsApp Demo" subtitle="Simulated interface — not the real WhatsApp app." />
    <WhatsAppDemo />
    <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live AI assessment tester (Twilio pipeline)</h2>
    <WhatsAppAssessments />
  </>,
});
