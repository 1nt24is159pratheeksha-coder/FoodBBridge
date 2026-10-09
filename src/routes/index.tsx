import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, ArrowDown, LineChart, ShieldCheck, Camera, Handshake, Truck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ResQFood AI — Predict. Prevent. Redistribute." },
    { name: "description", content: "AI platform that predicts food demand, prevents overproduction and redistributes surplus to verified organizations." },
    { property: "og:title", content: "ResQFood AI — Predict. Prevent. Redistribute." },
    { property: "og:description", content: "Predict demand, prevent overproduction and redistribute unavoidable surplus to verified NGOs." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Landing,
});

const steps = [
  { label: "Predict", icon: LineChart, text: "Forecast how much food is really needed." },
  { label: "Prevent", icon: ShieldCheck, text: "Cut avoidable overproduction at the source." },
  { label: "Capture", icon: Camera, text: "Kitchens report surplus on WhatsApp with a photo." },
  { label: "Match", icon: Handshake, text: "Verified NGOs are matched and confirm." },
  { label: "Deliver", icon: Truck, text: "Drivers pick up and deliver with OTP checks." },
  { label: "Impact", icon: BarChart3, text: "Every kilogram rescued is measured." },
];

function Landing() {
  return <div className="min-h-screen bg-background">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Leaf className="size-5" /></span><span className="font-display text-lg font-extrabold">ResQFood <span className="text-primary">AI</span></span></div>
      <Button variant="outline" asChild><Link to="/login">Login</Link></Button>
    </header>
    <main className="mx-auto max-w-6xl px-5">
      <section className="py-16 text-center sm:py-24">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">ResQFood AI</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">Predict. Prevent. Redistribute.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">An AI-powered platform that predicts food demand, prevents avoidable overproduction, and intelligently redistributes unavoidable surplus to verified organizations.</p>
        <div className="mt-8 flex justify-center gap-3"><Button size="lg" asChild><Link to="/login">Get Started</Link></Button><Button size="lg" variant="outline" asChild><Link to="/login">Login</Link></Button></div>
      </section>
      <section className="pb-20">
        <h2 className="text-center font-display text-xl font-bold">How it works</h2>
        <ol className="mx-auto mt-8 flex max-w-md flex-col items-stretch gap-2">
          {steps.map((s, i) => <li key={s.label} className="flex flex-col items-center gap-2">
            <div className="surface flex w-full items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-highlight text-primary"><s.icon className="size-5" /></span><div><p className="font-display text-sm font-bold uppercase tracking-wide">{s.label}</p><p className="text-sm text-muted-foreground">{s.text}</p></div></div>
            {i < steps.length - 1 && <ArrowDown className="size-4 text-muted-foreground" />}
          </li>)}
        </ol>
      </section>
    </main>
  </div>;
}
