import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { UserProfile } from "../backend.d";
import { Variant_pending_rejected_accepted } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useListContacts, useSendSnap } from "../hooks/useQueries";

interface SendSnapSheetProps {
  open: boolean;
  onClose: () => void;
  snapBytes: Uint8Array;
  onSent: () => void;
}

export default function SendSnapSheet({
  open,
  onClose,
  snapBytes,
  onSent,
}: SendSnapSheetProps) {
  const { data: contacts } = useListContacts();
  const { actor } = useActor();
  const sendSnap = useSendSnap();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const acceptedContacts = (contacts ?? []).filter(
    ([, req]) => req.status === Variant_pending_rejected_accepted.accepted,
  );
  const principalStrs = acceptedContacts.map(([uid]) => uid.toString());

  const { data: usernameMap } = useQuery({
    queryKey: ["sendSnapUsernames", principalStrs.join(",")],
    queryFn: async () => {
      if (!actor || principalStrs.length === 0)
        return {} as Record<string, string>;
      const results = await Promise.allSettled(
        principalStrs.map((p) =>
          actor
            .getUserByPrincipal(Principal.fromText(p))
            .then((pr: UserProfile) => [p, pr.username] as [string, string]),
        ),
      );
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
      }
      return map;
    },
    enabled: !!actor && principalStrs.length > 0,
  });

  const toggleContact = (p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0) return;
    setSending(true);

    // Optimistic: close immediately so the user doesn't notice the backend latency
    const receivers = Array.from(selected);
    toast.success(
      `Snap an ${receivers.length} Kontakt${receivers.length > 1 ? "e" : ""} gesendet!`,
    );
    onSent(); // dismiss UI right away

    // Fire backend calls in the background
    Promise.all(
      receivers.map((receiver) =>
        sendSnap.mutateAsync({ receiver, bytes: snapBytes }),
      ),
    ).catch(() => {
      toast.error("Snap konnte nicht gesendet werden");
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-card border-border text-foreground rounded-t-3xl"
        style={{ maxHeight: "70vh" }}
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Snap senden an...</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 py-4 overflow-y-auto">
          {acceptedContacts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">
              Keine Kontakte vorhanden. Füge zuerst Kontakte hinzu.
            </p>
          ) : (
            acceptedContacts.map(([uid], idx) => {
              const p = uid.toString();
              const username = usernameMap?.[p] ?? `${p.slice(0, 12)}...`;
              const isSelected = selected.has(p);
              return (
                <button
                  type="button"
                  key={p}
                  data-ocid={`sendsnap.item.${idx + 1}`}
                  onClick={() => toggleContact(p)}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                    isSelected
                      ? "bg-primary/20 border border-primary/50"
                      : "hover:bg-secondary"
                  }`}
                >
                  <Avatar className="w-11 h-11">
                    <AvatarFallback className="gradient-avatar text-white text-sm font-semibold">
                      {username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left font-medium text-foreground">
                    {username}
                  </span>
                  {isSelected && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "oklch(0.55 0.22 293)" }}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <Button
          data-ocid="sendsnap.primary_button"
          onClick={handleSend}
          disabled={selected.size === 0 || sending}
          className="w-full rounded-2xl py-5 font-semibold"
          style={{
            background:
              selected.size > 0
                ? "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.48 0.2 280))"
                : undefined,
          }}
        >
          {`Senden${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
