import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { UserProfile } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useListContacts, useListUnopenedSnaps } from "../hooks/useQueries";

interface ChatsScreenProps {
  onOpenChat: (principalStr: string) => void;
  onOpenSnap: (snapId: string) => void;
}

function useContactUsernames(principalStrs: string[]) {
  const { actor } = useActor();
  return useQuery({
    queryKey: ["contactUsernames", principalStrs.join(",")],
    queryFn: async () => {
      if (!actor || principalStrs.length === 0)
        return {} as Record<string, string>;
      const results = await Promise.allSettled(
        principalStrs.map((p) =>
          actor
            .getUserByPrincipal(Principal.fromText(p))
            .then(
              (profile: UserProfile) =>
                [p, profile.username] as [string, string],
            ),
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
}

export default function ChatsScreen({
  onOpenChat,
  onOpenSnap,
}: ChatsScreenProps) {
  const { data: contacts, isLoading } = useListContacts();
  const { data: unopenedSnaps } = useListUnopenedSnaps();

  const acceptedContacts = (contacts ?? []).filter(
    ([, req]) => req.status === "accepted",
  );
  const principalStrs = acceptedContacts.map(([uid]) => uid.toString());
  const { data: usernameMap } = useContactUsernames(principalStrs);

  const snapSenderSet = new Set(
    (unopenedSnaps ?? []).map((s) => s.sender.toString()),
  );

  const handleRowClick = (principalStr: string, hasUnopened: boolean) => {
    if (hasUnopened) {
      const snap = (unopenedSnaps ?? []).find(
        (s) => s.sender.toString() === principalStr,
      );
      if (snap) {
        onOpenSnap(snap.id);
        return;
      }
    }
    onOpenChat(principalStr);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Chats</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-3" data-ocid="chats.loading_state">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : acceptedContacts.length === 0 ? (
          <div
            data-ocid="chats.empty_state"
            className="flex flex-col items-center justify-center h-48 gap-3 text-center"
          >
            <span className="text-4xl">💬</span>
            <p className="text-muted-foreground text-sm">
              Noch keine Chats.
              <br />
              Füge Kontakte hinzu und fang an!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {acceptedContacts.map(([uid], idx) => {
              const principalStr = uid.toString();
              const username =
                usernameMap?.[principalStr] ??
                `${principalStr.slice(0, 12)}...`;
              const hasUnopened = snapSenderSet.has(principalStr);
              const initials = username.slice(0, 2).toUpperCase();

              return (
                <motion.button
                  key={principalStr}
                  data-ocid={`chats.item.${idx + 1}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleRowClick(principalStr, hasUnopened)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-card transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="gradient-avatar text-white font-semibold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {hasUnopened && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background"
                        style={{ background: "oklch(0.75 0.18 75)" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {username}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {hasUnopened
                        ? "\uD83D\uDCF8 Neuer Snap! – Tippen zum \u00D6ffnen"
                        : "Tippen zum Chatten"}
                    </p>
                  </div>
                  {hasUnopened && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: "oklch(0.75 0.18 75)",
                        color: "oklch(0.1 0 0)",
                      }}
                    >
                      SNAP
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
