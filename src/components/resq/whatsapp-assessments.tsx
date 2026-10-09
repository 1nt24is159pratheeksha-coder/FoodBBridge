import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listWhatsAppAssessments } from "@/lib/assessments.functions";

const qClass: Record<string, string> = {
  ELIGIBLE: "bg-success-soft text-success border-success/15",
  REVIEW_REQUIRED: "bg-warning-soft text-warning border-warning/15",
  URGENT: "bg-danger-soft text-danger border-danger/15",
  REJECTED: "bg-danger-soft text-danger border-danger/15",
};

export function WhatsAppAssessments() {
  const fetchList = useServerFn(listWhatsAppAssessments);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["wa-assessments"],
    queryFn: () => fetchList(),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Admin · WhatsApp</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Food assessments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kitchens send food photos on WhatsApp. AI visual screening only — not a food-safety guarantee.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className="size-4" />Refresh
        </Button>
      </div>

      <section className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
            <tr>
              {["Kitchen", "Food", "AI Qty", "Confirmed", "Weight", "Quality", "Freshness", "Confidence", "Safety", "Source", "Date/Time"].map((h) => (
                <th key={h} className="px-3 py-3 font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {isLoading && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {error && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-danger">Could not load assessments.</td></tr>
            )}
            {data?.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">No WhatsApp assessments yet.</td></tr>
            )}
            {data?.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 font-bold">{r.kitchen}</td>
                <td className="px-3 py-3">{r.food_name}</td>
                <td className="px-3 py-3">{r.ai_estimated_quantity ?? "—"}</td>
                <td className="px-3 py-3">{r.confirmed_quantity ?? "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.ai_estimated_weight != null ? `${r.ai_estimated_weight} kg` : "—"}</td>
                <td className="px-3 py-3">{r.visual_quality ?? "—"}</td>
                <td className="px-3 py-3">{r.freshness ?? "—"}</td>
                <td className="px-3 py-3">{r.confidence_percent != null ? `${r.confidence_percent}%` : "—"}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={`rounded-full text-[10px] font-bold ${qClass[r.safety_status ?? r.quality_screening_status] ?? ""}`}>
                    {r.safety_status ?? r.quality_screening_status}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {r.analysis_mode === "live_ai" ? "AI vision" : <span className="font-bold text-warning">Demo</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
