import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Leaf, ShieldCheck, Truck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDemoRole } from "@/lib/demo-session";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Login | ResQFood AI" },
    { name: "description", content: "Sign in to the ResQFood AI admin dashboard or driver portal." },
    { property: "og:title", content: "Login | ResQFood AI" },
    { property: "og:description", content: "Admin and driver access to ResQFood AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Login,
});

type DemoRole = "admin" | "driver" | "partner";
const options: { id: DemoRole; label: string; icon: typeof Leaf }[] = [
  { id: "admin", label: "Admin", icon: ShieldCheck }, { id: "driver", label: "Driver", icon: Truck }, { id: "partner", label: "Kitchen / NGO", icon: MessageCircle },
];

function Login() {
  const [role, setRole] = useState<DemoRole>("admin");
  const navigate = useNavigate();
  const submit = (e: FormEvent) => { e.preventDefault(); if (role === "admin") { setDemoRole("admin"); navigate({ to: "/admin" }); } else if (role === "driver") { setDemoRole("driver"); navigate({ to: "/driver" }); } };
  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
    <div className="w-full max-w-sm">
      <Link to="/" className="flex items-center justify-center gap-2"><span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Leaf className="size-5" /></span><span className="font-display text-xl font-extrabold">ResQFood <span className="text-primary">AI</span></span></Link>
      <form onSubmit={submit} className="surface-strong mt-8 p-6">
        <h1 className="font-display text-xl font-bold">Welcome Back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Demo access — no credentials are checked.</p>
        <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Demo role">
          {options.map((o) => <button type="button" key={o.id} aria-pressed={role === o.id} onClick={() => setRole(o.id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-semibold ${role === o.id ? "border-primary bg-highlight text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}><o.icon className="size-4" />{o.label}</button>)}
        </div>
        {role === "partner" ? <div className="mt-5 rounded-lg bg-highlight p-4 text-sm"><p className="font-semibold">Kitchens and NGOs use WhatsApp.</p><p className="mt-1 text-muted-foreground">Message the ResQFood AI number on WhatsApp to report surplus or accept food. Admins can preview this in the WhatsApp Demo.</p></div> : <>
          <label htmlFor="id" className="mt-5 block text-sm font-medium">Email / Phone</label>
          <Input id="id" autoComplete="username" placeholder="admin@resqfood.ai" className="mt-1.5 h-11" />
          <label htmlFor="pw" className="mt-4 block text-sm font-medium">Password / OTP</label>
          <Input id="pw" type="password" autoComplete="current-password" placeholder="••••••" className="mt-1.5 h-11" />
          <Button type="submit" className="mt-6 h-11 w-full">Login</Button>
          <button type="button" className="mt-3 w-full text-center text-sm font-medium text-primary hover:underline">Forgot Password?</button>
        </>}
      </form>
    </div>
  </main>;
}
