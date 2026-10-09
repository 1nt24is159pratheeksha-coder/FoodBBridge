import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/rf/ui";
import { WhatsAppSimulator } from "@/components/rf/whatsapp-demo";
import { WhatsAppAssessments } from "@/components/resq/whatsapp-assessments";
import { ForecastProcurementPanel } from "@/components/resq/forecast-procurement";

export const Route = createFileRoute("/admin/whatsapp-demo")({
  head: () => ({
    meta: [
      { title: "WhatsApp Demo | ResQFood AI" },
      { name: "description", content: "Interactive WhatsApp simulator — real conversation engine, real AI assessment, real Supabase." },
      { property: "og:title", content: "WhatsApp Demo | ResQFood AI" },
      { property: "og:description", content: "Interactive WhatsApp-style simulator using the real ResQFood AI backend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <>
      <PageTitle
        title="WhatsApp Demo"
        subtitle="Real conversational simulator — same backend engine as Twilio. Registration, surplus reporting, AI food assessment, NGO matching."
      />

      {/* Interactive WhatsApp Simulator */}
      <section className="mb-8">
        <WhatsAppSimulator />
      </section>

      {/* Food Assessments Table */}
      <section className="mb-8">
        <WhatsAppAssessments />
      </section>

      {/* Demand Forecast & Procurement */}
      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase text-primary">Planning</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Demand Forecast & Procurement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Statistical forecasting using historical data, weather signals, and day-of-week patterns. Procurement calculation from BOM recipes and current inventory.
          </p>
        </div>
        <ForecastProcurementPanel />
      </section>
    </>
  ),
});
