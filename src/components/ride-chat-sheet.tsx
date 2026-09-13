import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, Phone, X, Car, User, CheckCheck } from "lucide-react";
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
  "📍 I have arrived at your pickup location",
  "⏳ Stuck in traffic, arriving in ~5 mins",
  "🚗 Where should I stop to pick you up?",
  "🚪 Please come towards the main exit gate",
  "❄️ AC is switched on and ready for you",
];

const CUSTOMER_QUICK_CHIPS = [
  "🚶 On my way down right now",
  "🚪 Waiting at the security / reception gate",
  "❄️ Please turn on the AC",
  "⏱️ Please give me 2 minutes, arriving!",
  "👔 Wearing a blue shirt near the entrance",
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const isOpenRef = useRef(isOpen);

  isOpenRef.current = isOpen;

  const storageKey = `orange_chat_${bookingId}`;

  // Load persisted chat history for this booking
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

  // Reset unread count when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    }
  }, [isOpen, onUnreadCountChange]);

  // Scroll to bottom on message change or open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isOpen]);

  // Subscribe to real-time chat broadcast channel
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase.channel(`ride-chat-${bookingId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "chat_message" }, (payload) => {
        const incoming: ChatMessage = payload.payload;
        if (!incoming || !incoming.id) return;

        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          const updated = [...prev, incoming];
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Notify if incoming from the other party
        if (incoming.sender !== currentUserType) {
          playChatChime();
          if (!isOpenRef.current) {
            setUnreadCount((c) => {
              const next = c + 1;
              onUnreadCountChange?.(next);
              return next;
            });
            toast.info(`💬 ${incoming.senderName}: "${incoming.text}"`, {
              action: {
                label: "Reply",
                onClick: () => onOpenChange(true),
              },
            });
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, currentUserType, onOpenChange, onUnreadCountChange, storageKey]);

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || !bookingId) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: currentUserType,
      senderName: currentUserName || (currentUserType === "driver" ? "Driver" : "Passenger"),
      text,
      timestamp: new Date().toISOString(),
    };

    // Update local state and storage
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setInputText("");

    // Broadcast across Supabase channel to other party
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "chat_message",
        payload: newMsg,
      });
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
                💡 Tip: Tap any quick response chip below to reply instantly with 1 tap.
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
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
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
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
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

        {/* Quick Response Chips (Uber / Ola Style) */}
        <div className="border-t border-border/70 bg-card/40 p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
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
