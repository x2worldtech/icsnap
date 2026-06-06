import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { createActor } from "../backend";
import type { UserProfile } from "../backend";
import { Variant_pending_rejected_accepted } from "../backend";
import {
  useAcceptContactRequest,
  useFindUserByUsername,
  useGetUserByPrincipal,
  useListContacts,
  useListPendingRequests,
  useRejectContactRequest,
  useSendContactRequest,
} from "../hooks/useQueries";

interface ContactsScreenProps {
  onOpenChat: (principalStr: string) => void;
}

export default function ContactsScreen({ onOpenChat }: ContactsScreenProps) {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    profile: UserProfile;
    principal: string;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: contacts, isLoading } = useListContacts();
  const { data: pending } = useListPendingRequests();
  const sendRequest = useSendContactRequest();
  const acceptRequest = useAcceptContactRequest();
  const rejectRequest = useRejectContactRequest();
  const findUserByUsername = useFindUserByUsername();
  const getUserByPrincipal = useGetUserByPrincipal();
  const { actor } = useActor(createActor);

  // Load usernames for pending requests
  const pendingPrincipals = (pending ?? []).map(([uid]) => uid.toString());
  const { data: pendingUsernameMap } = useQuery({
    queryKey: ["pendingUsernames", pendingPrincipals.join(",")],
    queryFn: async () => {
      if (!actor || pendingPrincipals.length === 0)
        return {} as Record<string, string>;
      const results = await Promise.allSettled(
        pendingPrincipals.map((p) =>
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
    enabled: !!actor && pendingPrincipals.length > 0,
  });

  // Accepted contacts
  const acceptedContacts = (contacts ?? []).filter(
    ([, req]) => req.status === Variant_pending_rejected_accepted.accepted,
  );
  const acceptedPrincipals = acceptedContacts.map(([uid]) => uid.toString());
  const { data: contactUsernameMap } = useQuery({
    queryKey: ["contactUsernames2", acceptedPrincipals.join(",")],
    queryFn: async () => {
      if (!actor || acceptedPrincipals.length === 0)
        return {} as Record<string, string>;
      const results = await Promise.allSettled(
        acceptedPrincipals.map((p) =>
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
    enabled: !!actor && acceptedPrincipals.length > 0,
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      let profile: UserProfile | null = null;
      let principalStr = "";

      // Try as principal ID first
      try {
        const p = Principal.fromText(query.trim());
        profile = await getUserByPrincipal.mutateAsync(query.trim());
        principalStr = p.toString();
      } catch {
        // Try as username - use findUserByUsername which returns BOTH profile and principal
        try {
          const result = await findUserByUsername.mutateAsync(query.trim());
          if (result) {
            profile = result.profile;
            principalStr = result.principal;
          } else {
            toast.error("User not found");
          }
        } catch {
          toast.error("User not found");
        }
      }
      if (profile && principalStr)
        setSearchResult({ profile, principal: principalStr });
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (principalStr: string) => {
    try {
      await sendRequest.mutateAsync(principalStr);
      toast.success("Contact request sent");
      setSearchResult(null);
      setQuery("");
    } catch {
      toast.error("Couldn't send request");
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="px-5 pt-14 pb-4">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">
          Contacts
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            data-ocid="contacts.search_input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Principal ID or username…"
            className="flex-1 bg-card border-border rounded-xl text-foreground placeholder:text-muted-foreground"
          />
          <Button
            data-ocid="contacts.primary_button"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="rounded-xl px-4"
            style={{ background: "oklch(var(--primary))" }}
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Search result */}
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border"
          >
            <Avatar className="w-11 h-11">
              <AvatarFallback className="gradient-avatar text-white text-sm font-semibold">
                {searchResult.profile.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {searchResult.profile.username}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {searchResult.principal}
              </p>
            </div>
            <button
              type="button"
              data-ocid="contacts.secondary_button"
              onClick={() => handleAddContact(searchResult.principal)}
              disabled={sendRequest.isPending}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "oklch(var(--primary))" }}
            >
              <UserPlus className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        )}

        {/* Pending requests */}
        {(pending ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
              Requests
            </h2>
            <div className="flex flex-col gap-1">
              {(pending ?? []).map(([uid], idx) => {
                const principalStr = uid.toString();
                const username =
                  pendingUsernameMap?.[principalStr] ??
                  `${principalStr.slice(0, 12)}...`;
                return (
                  <div
                    key={principalStr}
                    data-ocid={`contacts.item.${idx + 1}`}
                    className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border"
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarFallback className="gradient-avatar text-white text-sm font-semibold">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Wants to connect
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-ocid={`contacts.confirm_button.${idx + 1}`}
                        onClick={() =>
                          acceptRequest
                            .mutateAsync(principalStr)
                            .then(() => toast.success("Contact added"))
                            .catch(() => toast.error("Something went wrong"))
                        }
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "oklch(var(--primary))" }}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        type="button"
                        data-ocid={`contacts.cancel_button.${idx + 1}`}
                        onClick={() =>
                          rejectRequest
                            .mutateAsync(principalStr)
                            .then(() => toast.success("Request declined"))
                            .catch(() => toast.error("Something went wrong"))
                        }
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-muted"
                      >
                        <X className="w-4 h-4 text-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contacts list */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
            My Contacts
          </h2>
          {isLoading ? (
            <div
              data-ocid="contacts.loading_state"
              className="flex flex-col gap-2"
            >
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : acceptedContacts.length === 0 ? (
            <div
              data-ocid="contacts.empty_state"
              className="flex flex-col items-center justify-center py-12 gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No contacts yet. Search above to add people.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {acceptedContacts.map(([uid], idx) => {
                const principalStr = uid.toString();
                const username =
                  contactUsernameMap?.[principalStr] ??
                  `${principalStr.slice(0, 12)}...`;
                return (
                  <motion.button
                    key={principalStr}
                    data-ocid={`contacts.item.${idx + 10}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onOpenChat(principalStr)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-card transition-colors text-left"
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarFallback className="gradient-avatar text-white text-sm font-semibold">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {username}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
