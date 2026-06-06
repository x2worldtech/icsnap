import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, MessageCircle, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createActor } from "../backend";
import type { Message, UserProfile } from "../backend";
import {
  useConversationHistory,
  useListUnopenedSnaps,
  useOpenSnap,
  useSendMessage,
} from "../hooks/useQueries";

interface ChatDetailScreenProps {
  contactPrincipal: string;
  onBack: () => void;
}

interface OptimisticMessage {
  id: string;
  content: string;
  isSnapEvent: boolean;
  optimistic: true;
  timestamp: number;
}

export default function ChatDetailScreen({
  contactPrincipal,
  onBack,
}: ChatDetailScreenProps) {
  const { identity } = useInternetIdentity();
  const { actor } = useActor(createActor);
  const myPrincipal = identity?.getPrincipal().toString();

  const [text, setText] = useState("");
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [openedSnapUrl, setOpenedSnapUrl] = useState<string | null>(null);
  const [openingSnapId, setOpeningSnapId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useConversationHistory(contactPrincipal);
  const { data: unopenedSnaps = [] } = useListUnopenedSnaps();
  const sendMessage = useSendMessage();
  const openSnap = useOpenSnap();
  const queryClient = useQueryClient();

  // Load contact username
  const { data: contactProfile } = useQuery<UserProfile>({
    queryKey: ["userProfile", contactPrincipal],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getUserByPrincipal(Principal.fromText(contactPrincipal));
    },
    enabled: !!actor && !!contactPrincipal,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, optimistic]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");

    const tempId = `opt-${Date.now()}`;
    const tempMsg: OptimisticMessage = {
      id: tempId,
      content,
      isSnapEvent: false,
      optimistic: true,
      timestamp: Date.now(),
    };
    setOptimistic((prev) => [...prev, tempMsg]);

    try {
      await sendMessage.mutateAsync({
        receiver: contactPrincipal,
        content,
        isSnapEvent: false,
      });
      setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
    } catch {
      toast.error("Couldn't send message");
      setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleOpenSnap = async (snapId: string) => {
    setOpeningSnapId(snapId);
    try {
      const blob = await openSnap.mutateAsync(snapId);
      const url = blob.getDirectURL();
      setOpenedSnapUrl(url);
      queryClient.invalidateQueries({
        queryKey: ["conversation", contactPrincipal],
      });
    } catch {
      toast.error("Couldn't open snap");
    } finally {
      setOpeningSnapId(null);
    }
  };

  // Build a map of snapId -> Snap for unopened snaps from this contact
  const snapMap = new Map(
    unopenedSnaps
      .filter((s) => s.sender.toString() === contactPrincipal)
      .map((s) => [s.id, s]),
  );

  const username =
    contactProfile?.username ?? `${contactPrincipal.slice(0, 12)}...`;
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border">
        <button
          type="button"
          data-ocid="chat.cancel_button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <Avatar className="w-9 h-9">
          <AvatarFallback className="gradient-avatar text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-foreground">{username}</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && optimistic.length === 0 && (
          <div
            data-ocid="chat.empty_state"
            className="flex flex-col items-center justify-center flex-1 gap-4 px-8 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              No messages yet. Say hello or send a snap.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMine = msg.sender.toString() === myPrincipal;
          return (
            <MessageBubble
              key={msg.id.toString()}
              msg={msg}
              isMine={isMine}
              snapMap={snapMap}
              onOpenSnap={handleOpenSnap}
              openingSnapId={openingSnapId}
              idx={idx}
            />
          );
        })}

        {optimistic.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.7, y: 0 }}
            className="flex justify-end"
          >
            <div className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-sm bubble-sent text-white text-sm">
              {msg.content}
            </div>
          </motion.div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 border-t border-border flex items-center gap-2">
        <Input
          data-ocid="chat.input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Message…"
          className="flex-1 rounded-full bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          data-ocid="chat.submit_button"
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
          style={{ background: "oklch(var(--primary))" }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Full-screen snap viewer */}
      <AnimatePresence>
        {openedSnapUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-50 flex items-center justify-center"
            onClick={() => setOpenedSnapUrl(null)}
          >
            <img
              src={openedSnapUrl}
              alt="Snap"
              className="max-w-full max-h-full object-contain"
            />
            <p className="absolute bottom-10 text-white/70 text-sm">
              Tap to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({
  msg,
  isMine,
  snapMap,
  onOpenSnap,
  openingSnapId,
  idx,
}: {
  msg: Message;
  isMine: boolean;
  snapMap: Map<string, any>;
  onOpenSnap: (id: string) => void;
  openingSnapId: string | null;
  idx: number;
}) {
  const snapId = msg.snapId;
  const hasUnopened = snapId ? snapMap.has(snapId) : false;

  if (msg.isSnapEvent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.02, 0.3) }}
        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      >
        {hasUnopened && snapId ? (
          <button
            type="button"
            data-ocid={`snap.item.${idx + 1}`}
            onClick={() => onOpenSnap(snapId)}
            disabled={openingSnapId === snapId}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border snap-shimmer max-w-[72%] transition-transform active:scale-95"
          >
            <Camera
              className="w-5 h-5"
              style={{ color: "oklch(var(--primary))" }}
            />
            <div className="text-left">
              <p
                className="text-sm font-semibold"
                style={{ color: "oklch(var(--primary))" }}
              >
                {openingSnapId === snapId ? "Opening…" : "Open Snap"}
              </p>
              <p className="text-xs text-muted-foreground">
                Viewable once
              </p>
            </div>
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "oklch(var(--accent))" }}
            />
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-border max-w-[72%]">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isMine ? "Snap sent" : "Snap opened"}
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm ${
          isMine
            ? "bubble-sent text-white rounded-br-sm"
            : "bg-card text-foreground rounded-bl-sm border border-border"
        }`}
      >
        {msg.content}
      </div>
    </motion.div>
  );
}
