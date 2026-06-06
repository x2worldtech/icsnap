import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { Camera, MessageCircle, Pencil, Search, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { createActor } from "../backend";
import type { MainScreen } from "../App";
import type { UserProfile } from "../backend";
import {
  useGetCallerUserProfile,
  useListContacts,
  useListUnopenedSnaps,
} from "../hooks/useQueries";

interface ChatsScreenProps {
  onOpenChat: (principalStr: string) => void;
  onOpenSnap: (snapId: string) => void;
  onNavigate: (screen: MainScreen) => void;
}

type Filter = "all" | "unread" | "snaps";

function timeAgo(tsNs: bigint | null | undefined): string {
  if (tsNs === null || tsNs === undefined) return "";
  const ms = Number(tsNs / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

function useContactUsernames(principalStrs: string[]) {
  const { actor } = useActor(createActor);
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

interface ConvMeta {
  unread: boolean;
  lastTs: bigint | null;
}

function useConversationMeta(principalStrs: string[]) {
  const { actor } = useActor(createActor);
  const { identity } = useInternetIdentity();
  const myPrincipal = identity?.getPrincipal().toString();

  return useQuery({
    queryKey: ["conversationMeta", principalStrs.join(","), myPrincipal],
    queryFn: async () => {
      const empty = {} as Record<string, ConvMeta>;
      if (!actor || principalStrs.length === 0 || !myPrincipal) return empty;
      const results = await Promise.allSettled(
        principalStrs.map(async (p) => {
          const msgs = await actor.getConversationHistory(
            Principal.fromText(p),
          );
          if (msgs.length === 0)
            return [p, { unread: false, lastTs: null }] as [string, ConvMeta];
          const latest = msgs[msgs.length - 1];
          const unread =
            !latest.isSnapEvent && latest.sender.toString() !== myPrincipal;
          return [p, { unread, lastTs: latest.timestamp }] as [
            string,
            ConvMeta,
          ];
        }),
      );
      const map: Record<string, ConvMeta> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
      }
      return map;
    },
    enabled: !!actor && !!identity && principalStrs.length > 0,
    refetchInterval: 8000,
  });
}

export default function ChatsScreen({
  onOpenChat,
  onOpenSnap,
  onNavigate,
}: ChatsScreenProps) {
  const { data: contacts, isLoading } = useListContacts();
  const { data: unopenedSnaps } = useListUnopenedSnaps();
  const { data: myProfile } = useGetCallerUserProfile();

  const [filter, setFilter] = useState<Filter>("all");
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");

  const acceptedContacts = (contacts ?? []).filter(
    ([, req]) => req.status === "accepted",
  );
  const principalStrs = acceptedContacts.map(([uid]) => uid.toString());
  const { data: usernameMap } = useContactUsernames(principalStrs);
  const { data: metaMap } = useConversationMeta(principalStrs);

  const snapBySender = new Map(
    (unopenedSnaps ?? []).map((s) => [s.sender.toString(), s]),
  );

  const rows = acceptedContacts.map(([uid]) => {
    const principalStr = uid.toString();
    const username =
      usernameMap?.[principalStr] ?? `${principalStr.slice(0, 12)}…`;
    const snap = snapBySender.get(principalStr);
    const hasUnopened = !!snap;
    const meta = metaMap?.[principalStr];
    const hasUnreadMsg = !hasUnopened && !!meta?.unread;
    const ts = hasUnopened ? (snap?.timestamp ?? null) : (meta?.lastTs ?? null);
    return {
      principalStr,
      username,
      hasUnopened,
      hasUnreadMsg,
      snapId: snap?.id ?? null,
      time: timeAgo(ts),
    };
  });

  const unreadCount = rows.filter((r) => r.hasUnopened || r.hasUnreadMsg).length;
  const snapsCount = rows.filter((r) => r.hasUnopened).length;

  const q = query.trim().toLowerCase();
  const visibleRows = rows.filter((r) => {
    if (filter === "unread" && !(r.hasUnopened || r.hasUnreadMsg)) return false;
    if (filter === "snaps" && !r.hasUnopened) return false;
    if (q && !r.username.toLowerCase().includes(q)) return false;
    return true;
  });

  const handleRowClick = (row: (typeof rows)[number]) => {
    if (row.hasUnopened && row.snapId) {
      onOpenSnap(row.snapId);
      return;
    }
    onOpenChat(row.principalStr);
  };

  const myInitials = (myProfile?.username ?? "")
    .slice(0, 2)
    .toUpperCase();

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "snaps", label: "Snaps", count: snapsCount },
  ];

  return (
    <div className="relative h-full flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 pt-12 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-ocid="chats.profile_button"
            onClick={() => onNavigate("profile")}
            aria-label="Profile"
            className="shrink-0"
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="gradient-avatar text-white text-xs font-bold">
                {myInitials || "?"}
              </AvatarFallback>
            </Avatar>
          </button>

          <h1 className="flex-1 text-[1.75rem] font-extrabold tracking-tight text-foreground">
            Chats
          </h1>

          <button
            type="button"
            data-ocid="chats.search_button"
            onClick={() => {
              setShowSearch((v) => !v);
              if (showSearch) setQuery("");
            }}
            aria-label="Search"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              showSearch ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            <Search className="w-[1.125rem] h-[1.125rem]" />
          </button>
          <button
            type="button"
            data-ocid="chats.add_button"
            onClick={() => onNavigate("contacts")}
            aria-label="Add friends"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-secondary text-foreground"
          >
            <UserPlus className="w-[1.125rem] h-[1.125rem]" />
          </button>
        </div>

        {showSearch && (
          <Input
            data-ocid="chats.search_input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            autoFocus
            className="mt-3 bg-card border-border rounded-xl text-foreground placeholder:text-muted-foreground"
          />
        )}

        {/* Filter chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-ocid={`chats.filter.${f.id}`}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span
                    className={`min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[0.6875rem] font-bold flex items-center justify-center ${
                      active
                        ? "bg-primary-foreground text-primary"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-24">
        {isLoading ? (
          <div className="flex flex-col gap-1" data-ocid="chats.loading_state">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div
            data-ocid="chats.empty_state"
            className="flex flex-col items-center justify-center h-[55vh] gap-4 text-center px-8"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-foreground">
                {rows.length === 0
                  ? "No chats yet"
                  : filter === "snaps"
                    ? "No new snaps"
                    : filter === "unread"
                      ? "You're all caught up"
                      : "No results"}
              </p>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? "Add a friend to start a conversation."
                  : "Nothing to show here right now."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleRows.map((row, idx) => {
              const initials = row.username.slice(0, 2).toUpperCase();
              const isHighlighted = row.hasUnopened || row.hasUnreadMsg;

              return (
                <motion.button
                  key={row.principalStr}
                  data-ocid={`chats.item.${idx + 1}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleRowClick(row)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-card active:bg-card transition-colors text-left"
                >
                  <Avatar className="w-14 h-14 shrink-0">
                    <AvatarFallback className="gradient-avatar text-white font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate ${
                        isHighlighted
                          ? "font-bold text-foreground"
                          : "font-semibold text-foreground"
                      }`}
                    >
                      {row.username}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-sm min-w-0">
                      {row.hasUnopened ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-accent shrink-0" />
                          <span className="font-semibold text-accent shrink-0">
                            New Snap
                          </span>
                        </>
                      ) : row.hasUnreadMsg ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-primary shrink-0" />
                          <span className="font-semibold text-primary shrink-0">
                            New Chat
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2.5 h-2.5 rounded-[3px] border-[1.5px] border-muted-foreground shrink-0" />
                          <span className="text-muted-foreground truncate">
                            Tap to chat
                          </span>
                        </>
                      )}
                      {row.time && (
                        <span className="text-muted-foreground shrink-0">
                          · {row.time}
                        </span>
                      )}
                      {isHighlighted && (
                        <span
                          data-ocid={`chats.unread_msg_badge.${idx + 1}`}
                          className="sr-only"
                        >
                          unread
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                    {row.hasUnopened ? (
                      <MessageCircle className="w-[1.375rem] h-[1.375rem]" />
                    ) : (
                      <Camera className="w-[1.375rem] h-[1.375rem]" />
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose */}
      <button
        type="button"
        data-ocid="chats.compose_button"
        onClick={() => onNavigate("contacts")}
        aria-label="New chat"
        className="absolute bottom-5 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground brand-glow flex items-center justify-center active:scale-95 transition-transform"
      >
        <Pencil className="w-5 h-5" />
      </button>
    </div>
  );
}
