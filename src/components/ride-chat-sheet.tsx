import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Send,
  Phone,
  Car,
  User,
  CheckCheck,
  MapPin,
  Navigation,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  sender: "driver" | "customer";
  senderName: string;
  text: string;
  timestamp: string;
}

interface RideChatSheetProps {
  bookingId: string;
  bookingReference: string;
  currentUserType: "driver" | "customer";
  currentUserName: string;
  otherPartyName: string;
  otherPartyPhone?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadCountChange?: (count: number) => void;
}

const DRIVER_QUICK_CHIPS = [
  "I have arrived at your pickup location",
  "⏳ Stuck in traffic, arriving in ~5 mins",
  "Where should I stop to pick you up?",
  "Please come towards the main exit gate",
  "AC is switched on and ready for you",
];

const CUSTOMER_QUICK_CHIPS = [
  "On my way down right now",
  "Waiting at the security / reception gate",
  "Please turn on the AC",
  "⏱️ Please give me 2 minutes, arriving!",
  "Wearing a blue shirt near the entrance",
];

function playChatChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

export function RideChatSheet({
  bookingId,
  bookingReference,
  currentUserType,
  currentUserName,
  otherPartyName,
  otherPartyPhone,
  isOpen,
  onOpenChange,
  onUnreadCountChange,
}: RideChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [sharingLocation, setSharingLocation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;

  const currentUserTypeRef = useRef(currentUserType);
  currentUserTypeRef.current = currentUserType;

  const currentUserNameRef = useRef(currentUserName);
  currentUserNameRef.current = currentUserName;

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const storageKey = `orange_chat_${bookingId}`;

  // Helper to merge new incoming messages without duplicates and trigger notifications
  const mergeIncomingMessages = (incomingList: ChatMessage[]) => {
    if (!incomingList || incomingList.length === 0) return;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const brandNew = incomingList.filter((m) => m && m.id && !existingIds.has(m.id));
      if (brandNew.length === 0) return prev;

      const merged = [...prev, ...brandNew].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      // Trigger chime and notification if any message is from the other party
      const fromOther = brandNew.filter((m) => m.sender !== currentUserTypeRef.current);
      if (fromOther.length > 0) {
        playChatChime();
        if (!isOpenRef.current) {
          const addedCount = fromOther.length;
          setUnreadCount((c) => {
            const next = c + addedCount;
            onUnreadCountChangeRef.current?.(next);
            return next;
          });
          const latest = fromOther[fromOther.length - 1];
          if (latest) {
            toast.info(`${latest.senderName}: "${latest.text}"`, {
              action: {
                label: "Reply",
                onClick: () => onOpenChangeRef.current?.(true),
              },
            });
          }
        }
      }

      return merged;
    });
  };

  const shareMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setSharingLocation(true);
    toast.info("Acquiring high-accuracy GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
        const msg = `Standing here right now: ${mapUrl}`;
        sendMessage(msg);
        setSharingLocation(false);
        toast.success(`Exact GPS coordinates shared!`);
      },
      (err) => {
        console.warn("Location error:", err);
        toast.error("Could not obtain GPS. Please verify location permissions.");
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // Load initial persisted chat history
  useEffect(() => {
    if (!bookingId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        setMessages(parsed);
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }
  }, [bookingId, storageKey]);

  // When drawer opens, clear unread, re-sync from localStorage, and request latest history from peer
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      onUnreadCountChangeRef.current?.(0);

      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: ChatMessage[] = JSON.parse(stored);
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const brandNew = parsed.filter((m) => m && m.id && !existingIds.has(m.id));
            if (brandNew.length === 0) return prev;
            return [...prev, ...brandNew].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );
          });
        }
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      // Broadcast history request so the other party sends any messages we might have missed
      if (channelRef.current) {
        channelRef.current
          .send({
            type: "broadcast",
            event: "request_chat_history",
            payload: { requester: currentUserTypeRef.current },
          })
          .catch(() => {});
      }
    }
  }, [isOpen, storageKey]);

  // Scroll to bottom on message change or open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isOpen]);

  // Stable multi-channel subscription (Supabase Realtime + BroadcastChannel + Window Storage)
  useEffect(() => {
    if (!bookingId) return;

    let isCancelled = false;
    let channel: any = null;
    let bc: BroadcastChannel | null = null;

    async function setupAuthorizedChat() {
      // 1. Verify authenticated session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isCancelled || !session?.user) {
        return;
      }

      // 2. Verify caller is authorized for this specific ride (passenger or assigned driver)
      const { data: ride, error } = await supabase
        .from("bookings")
        .select("id, customer_id, driver_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (isCancelled || error || !ride) {
        return;
      }

      // 3. Supabase Realtime Broadcast (cross-device)
      channel = supabase.channel(`ride-chat-${bookingId}`, {
        // Private channel: Realtime Authorization (RLS on realtime.messages, migration
        // 20261025130000) admits only this ride's passenger and chauffeur.
        config: { private: true, broadcast: { self: false, ack: true } },
      });

      channel
        .on("broadcast", { event: "chat_message" }, (payload: any) => {
          const p = payload?.payload;
          if (p) {
            mergeIncomingMessages([p]);
          }
        })
        .on("broadcast", { event: "request_chat_history" }, () => {
          if (messagesRef.current.length > 0 && channelRef.current) {
            channelRef.current
              .send({
                type: "broadcast",
                event: "sync_chat_history",
                payload: { messages: messagesRef.current },
              })
              .catch(() => {});
          }
        })
        .on("broadcast", { event: "sync_chat_history" }, (payload: any) => {
          const msgs = payload?.payload?.messages;
          if (msgs) {
            mergeIncomingMessages(msgs);
          }
        })
        .subscribe();

      channelRef.current = channel;

      // 4. Browser BroadcastChannel
      try {
        bc = new BroadcastChannel(`orange_chat_bc_${bookingId}`);
        bc.onmessage = (event) => {
          if (event.data) {
            if (Array.isArray(event.data)) mergeIncomingMessages(event.data);
            else mergeIncomingMessages([event.data]);
          }
        };
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }
    }

    setupAuthorizedChat();

    // 5. LocalStorage Event listener (multi-tab cross sync)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed: ChatMessage[] = JSON.parse(e.newValue);
          mergeIncomingMessages(parsed);
        } catch {
          // best-effort: failure here is non-fatal and intentionally ignored
        }
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // 6. Custom window event (same-page cross-component dispatch)
    const handleCustomLocalEvent = (e: any) => {
      if (e.detail?.bookingId === bookingId && e.detail?.message) {
        mergeIncomingMessages([e.detail.message]);
      }
    };
    window.addEventListener("orange_chat_local_event", handleCustomLocalEvent);

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (bc) {
        bc.close();
      }
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("orange_chat_local_event", handleCustomLocalEvent);
    };
  }, [bookingId, storageKey]);

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || !bookingId) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: currentUserTypeRef.current,
      senderName:
        currentUserNameRef.current ||
        (currentUserTypeRef.current === "driver" ? "Driver" : "Passenger"),
      text,
      timestamp: new Date().toISOString(),
    };

    // 1. Update local state and localStorage
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }
      return updated;
    });

    setInputText("");

    // 2. Dispatch locally for in-page and cross-tab listeners
    try {
      window.dispatchEvent(
        new CustomEvent("orange_chat_local_event", {
          detail: { bookingId, message: newMsg },
        }),
      );
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }

    try {
      const bc = new BroadcastChannel(`orange_chat_bc_${bookingId}`);
      bc.postMessage(newMsg);
      bc.close();
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }

    // 3. Broadcast across Supabase Realtime channel to other devices
    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: "broadcast",
          event: "chat_message",
          payload: newMsg,
        });
      } catch (err) {
        console.warn("Realtime broadcast send notice:", err);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const quickChips = currentUserType === "driver" ? DRIVER_QUICK_CHIPS : CUSTOMER_QUICK_CHIPS;
  const cleanPhone = (otherPartyPhone || "").replace(/\D/g, "");

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col p-0 sm:max-w-md bg-background border-l border-border"
      >
        {/* Chat Header */}
        <SheetHeader className="border-b border-border bg-card/60 backdrop-blur px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold shrink-0">
                {currentUserType === "driver" ? (
                  <User className="size-5" />
                ) : (
                  <Car className="size-5" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-sm font-bold truncate">
                  {otherPartyName || (currentUserType === "driver" ? "Passenger" : "Driver")}
                </SheetTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-primary">#{bookingReference}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-emerald-500 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Ride
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Call Action in Header */}
            {cleanPhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0"
                title={`Call ${otherPartyName}`}
              >
                <Phone className="size-3.5" />
                <span className="hidden sm:inline">Call</span>
              </a>
            )}
          </div>
        </SheetHeader>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-3">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <MessageSquare className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">In-Ride Direct Chat</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Coordinate pickup location, delays, or preferences directly with{" "}
                  {currentUserType === "driver" ? "the passenger" : "your driver"}.
                </p>
              </div>
              <div className="text-xs text-muted-foreground/80 bg-muted/40 rounded-lg p-2.5 border border-border/50 max-w-xs">
                Tip: Tap any quick response chip below to reply instantly with 1 tap.
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender === currentUserType;
              const timeStr = m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted text-foreground border border-border/60 rounded-bl-xs"
                    }`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">
                        {m.senderName}
                      </p>
                    )}
                    {m.text.includes("maps.google.com") ? (
                      <div className="space-y-2 my-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <MapPin className="size-3.5 text-emerald-400" />
                          <span>Exact Physical Location Shared</span>
                        </div>
                        <p className="text-xs opacity-90">{m.text.split("https")[0]}</p>
                        <a
                          href={m.text.substring(m.text.indexOf("https"))}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <Navigation className="size-3.5" />
                          <span>Open in Google Maps / Navigate</span>
                        </a>
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                        isMe ? "text-primary-foreground/75" : "text-muted-foreground"
                      }`}
                    >
                      <span>{timeStr}</span>
                      {isMe && <CheckCheck className="size-3" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Response Chips */}
        <div className="border-t border-border/70 bg-card/40 p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={shareMyLocation}
              disabled={sharingLocation}
              className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold transition-all hover:bg-emerald-500/20 active:scale-95 flex items-center gap-1 shadow-sm"
              title="Share exact physical GPS location pin"
            >
              <MapPin className="size-3 text-emerald-500" />
              <span>{sharingLocation ? "Locating..." : "Share GPS Pin"}</span>
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0 pl-1">
              Quick:
            </span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(chip)}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 active:scale-95 text-left"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Input Field & Send Button */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-border bg-background p-3 flex items-center gap-2"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${otherPartyName || (currentUserType === "driver" ? "Passenger" : "Driver")}...`}
            className="flex-1 bg-muted/40 border-border h-10 text-sm focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputText.trim()}
            className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
