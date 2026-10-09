import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Send, Paperclip, RotateCcw, Bot, Check, CheckCheck, Clock, AlertCircle,
  Image as ImageIcon, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  simulateWhatsAppMessage,
  fetchConversationHistory,
  fetchSessionState,
  resetConversationSession,
} from "@/lib/assessments.functions";

type ChatMessage = {
  id: string;
  who: "user" | "bot";
  text: string;
  hasImage?: boolean;
  imagePreview?: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
};

const PRESET_PHONES: { label: string; value: string }[] = [
  { label: "New / Unregistered", value: "+919999900001" },
  { label: "Demo Kitchen · Harvest", value: "+919845011220" },
  { label: "Demo NGO · Sunrise Shelter", value: "+919900011122" },
];

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fileToBase64(file: File): Promise<{ base64: string; contentType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;
      const buf = new Uint8Array(file.arrayBuffer ? null as unknown as ArrayBuffer : new ArrayBuffer(0));
      file.arrayBuffer().then((ab) => {
        const u8 = new Uint8Array(ab);
        let s = "";
        for (let i = 0; i < u8.length; i += 0x8000) {
          s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        }
        resolve({
          base64: btoa(s),
          contentType: file.type || "image/jpeg",
          preview,
        });
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function WhatsAppSimulator() {
  const send = useServerFn(simulateWhatsAppMessage);
  const fetchHistory = useServerFn(fetchConversationHistory);
  const fetchSession = useServerFn(fetchSessionState);
  const resetSession = useServerFn(resetConversationSession);

  const [phone, setPhone] = useState("+919999900001");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  // Load conversation history when phone changes
  const loadHistory = useCallback(async (p: string) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const [history, session] = await Promise.all([
        fetchHistory({ data: { phone: p } }),
        fetchSession({ data: { phone: p } }),
      ]);
      const mapped: ChatMessage[] = (history as { id: string; who: "user" | "bot"; text: string; imageUrl?: string; timestamp: string }[]).map((m) => ({
        id: m.id,
        who: m.who,
        text: m.text,
        hasImage: !!m.imageUrl,
        timestamp: m.timestamp,
      }));
      setMessages(mapped);
      setSessionRole((session as { role: string | null } | null)?.role ?? null);
      setSessionState((session as { state: string | null } | null)?.state ?? null);
      scrollToBottom();
    } catch (e) {
      setError((e as Error).message);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [fetchHistory, fetchSession, scrollToBottom]);

  useEffect(() => {
    loadHistory(phone);
  }, [phone, loadHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAttachedFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAttachedPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachedPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await resetSession({ data: { phone } });
      setMessages([]);
      setSessionRole(null);
      setSessionState(null);
      setText("");
      clearAttachment();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() && !attachedFile) return;
    setBusy(true);
    setError(null);

    let imagePayload: { base64: string; contentType: string } | null = null;
    let imagePreview: string | undefined;

    if (attachedFile) {
      try {
        const result = await fileToBase64(attachedFile);
        imagePayload = { base64: result.base64, contentType: result.contentType };
        imagePreview = result.preview;
      } catch {
        imagePayload = null;
      }
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      who: "user",
      text: text.trim() || (attachedFile ? "📷 Photo" : ""),
      hasImage: !!imagePayload,
      imagePreview,
      timestamp: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const sentText = text.trim();
    setText("");
    setAttachedFile(null);
    setAttachedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const r = await send({ data: { from: phone, text: sentText, image: imagePayload } });
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        who: "bot",
        text: r.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);

      // Refresh session state
      try {
        const session = await fetchSession({ data: { phone } });
        setSessionRole((session as { role: string | null } | null)?.role ?? null);
        setSessionState((session as { state: string | null } | null)?.state ?? null);
      } catch { /* non-critical */ }
    } catch (e) {
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        who: "bot",
        text: `⚠️ Error: ${(e as Error).message}`,
        timestamp: new Date().toISOString(),
        status: "error",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto max-w-md">
      {/* Phone frame */}
      <div className="overflow-hidden rounded-[2rem] border-8 border-neutral-800 bg-wa-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 bg-wa-head px-4 py-3 text-white">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/20">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">ResQFood AI</p>
            <p className="truncate text-[11px] opacity-80">
              {sessionRole ? `${sessionRole} · ${sessionState ?? "idle"}` : "Tap to start"}
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={busy}
            className="rounded-full p-2 transition-colors hover:bg-white/15 disabled:opacity-40"
            title="Reset conversation"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {/* Phone selector bar */}
        <div className="flex items-center gap-2 border-b border-black/10 bg-white/80 px-3 py-2">
          <select
            aria-label="Simulated phone number"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); }}
            className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-wa-head/30"
          >
            {PRESET_PHONES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            aria-label="Custom phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-32 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-wa-head/30"
          />
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="h-[460px] space-y-2 overflow-y-auto px-3 py-3"
          style={{ backgroundImage: "var(--wa-bg)" }}
          aria-live="polite"
        >
          {loadingHistory && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-500">
              <Loader2 className="size-4 animate-spin" /> Loading conversation…
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-wa-out/30">
                <Bot className="size-8 text-wa-head" />
              </div>
              <p className="mt-3 max-w-[200px] text-xs text-neutral-500">
                Send a message to start chatting with ResQFood AI. Try "Hi" to begin.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.who === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-[82%] rounded-lg px-3 py-2 text-[13px] shadow-sm ${
                  m.who === "user"
                    ? "rounded-tr-sm bg-wa-out text-neutral-900"
                    : "rounded-tl-sm bg-white text-neutral-900"
                } ${m.status === "error" ? "border border-danger/30 bg-danger-soft" : ""}`}
              >
                {m.hasImage && m.imagePreview && (
                  <img
                    src={m.imagePreview}
                    alt="Sent photo"
                    className="mb-1.5 max-h-40 rounded-md object-cover"
                  />
                )}
                {m.hasImage && !m.imagePreview && (
                  <div className="mb-1.5 flex h-24 items-center justify-center rounded-md bg-neutral-200">
                    <ImageIcon className="size-6 text-neutral-400" />
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                <div className="mt-1 flex items-center justify-end gap-0.5 text-[10px] text-neutral-500">
                  <span>{formatTime(m.timestamp)}</span>
                  {m.who === "user" && m.status === "sent" && <Check className="size-3" />}
                  {m.who === "user" && m.status === "sending" && <Clock className="size-3" />}
                  {m.status === "error" && <AlertCircle className="size-3 text-danger" />}
                </div>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-lg rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
                <span className="size-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0ms" }} />
                <span className="size-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "150ms" }} />
                <span className="size-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Attachment preview */}
        {attachedPreview && (
          <div className="flex items-center gap-2 border-t border-black/10 bg-white/80 px-3 py-2">
            <img src={attachedPreview} alt="Preview" className="size-12 rounded-md object-cover" />
            <span className="text-xs text-neutral-600">Photo ready to send</span>
            <button onClick={clearAttachment} className="ml-auto rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t border-black/10 bg-white/90 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40"
            title="Attach photo"
          >
            <Paperclip className="size-5" />
          </button>
          <input
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Type a message…"
            className="min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:ring-2 focus:ring-wa-head/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={busy || (!text.trim() && !attachedFile)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wa-head text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            title="Send"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>

      {/* Status info below phone */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center">
        {sessionRole && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {sessionRole}
          </Badge>
        )}
        {sessionState && sessionState !== "idle" && sessionState !== "new" && (
          <Badge variant="outline" className="text-[10px]">
            State: {sessionState}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          Admin Simulator · same backend as Twilio
        </span>
      </div>

      {error && (
        <p className="mt-2 text-center text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
