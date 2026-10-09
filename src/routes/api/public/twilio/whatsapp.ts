import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function twiml(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = text ? `<Message>${esc}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const Route = createFileRoute("/api/public/twilio/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const raw = await request.text();
        const params = new URLSearchParams(raw);

        // Security: shared token in the webhook URL (always), plus Twilio signature when the auth token is configured.
        const token = process.env['WHATSAPP_WEBHOOK_TOKEN'];
        if (!token || !safeEq(url.searchParams.get("token") ?? "", token)) return new Response("Unauthorized", { status: 401 });
        const authToken = process.env['TWILIO_AUTH_TOKEN'];
        if (authToken) {
          const sorted = [...params.keys()].sort().map((k) => k + params.get(k)).join("");
          const expected = createHmac("sha1", authToken).update(request.url + sorted).digest("base64");
          if (!safeEq(request.headers.get("x-twilio-signature") ?? "", expected)) return new Response("Invalid signature", { status: 401 });
        }

        const from = params.get("From") ?? "";
        if (!from) return new Response("Bad request", { status: 400 });
        const numMedia = Number(params.get("NumMedia") ?? 0);
        const media = numMedia > 0 ? { url: params.get("MediaUrl0") ?? "", contentType: params.get("MediaContentType0") ?? "" } : null;

        // Use the shared conversation engine — same engine as the Admin Simulator
        const { processConversation } = await import("@/lib/whatsapp/conversation-engine");
        try {
          const { reply } = await processConversation({
            from,
            text: (params.get("Body") ?? "").slice(0, 2000),
            messageSid: params.get("MessageSid") ?? undefined,
            media,
            channel: "whatsapp",
          });
          return twiml(reply);
        } catch (e) {
          console.error("Webhook failed", e);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
