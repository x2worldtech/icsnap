import { useActor } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createActor,
  ExternalBlob,
  RetentionPolicy,
  Variant_pending_rejected_accepted,
} from "../backend";
import type { ContactRequest, Message, Snap, UserId, UserProfile } from "../backend";

// Re-exported so screens can import the enum from a single place.
export { RetentionPolicy };

// Centralised, stable query keys. Changing a key here changes it everywhere.
const KEYS = {
  callerProfile: ["callerUserProfile"] as const,
  contacts: ["contacts"] as const,
  pending: ["pendingRequests"] as const,
  unopenedSnaps: ["unopenedSnaps"] as const,
  conversation: (principal: string) => ["conversation", principal] as const,
};

type ContactEntry = [UserId, ContactRequest];

/* ----------------------------- Queries ----------------------------- */

export function useGetCallerUserProfile() {
  const { actor } = useActor(createActor);
  return useQuery<UserProfile | null>({
    queryKey: KEYS.callerProfile,
    queryFn: async () => {
      if (!actor) return null;
      return await actor.getCallerUserProfile();
    },
    enabled: !!actor,
  });
}

export function useListContacts() {
  const { actor } = useActor(createActor);
  return useQuery<ContactEntry[]>({
    queryKey: KEYS.contacts,
    queryFn: async () => {
      if (!actor) return [];
      return await actor.listContacts();
    },
    enabled: !!actor,
    refetchInterval: 20000,
  });
}

export function useListPendingRequests() {
  const { actor } = useActor(createActor);
  return useQuery<ContactEntry[]>({
    queryKey: KEYS.pending,
    queryFn: async () => {
      if (!actor) return [];
      return await actor.listPendingRequests();
    },
    enabled: !!actor,
    refetchInterval: 12000,
  });
}

export function useListUnopenedSnaps() {
  const { actor } = useActor(createActor);
  return useQuery<Snap[]>({
    queryKey: KEYS.unopenedSnaps,
    queryFn: async () => {
      if (!actor) return [];
      return await actor.listUnopenedSnaps();
    },
    enabled: !!actor,
    refetchInterval: 5000,
  });
}

export function useConversationHistory(contactPrincipal: string) {
  const { actor } = useActor(createActor);
  return useQuery<Message[]>({
    queryKey: KEYS.conversation(contactPrincipal),
    queryFn: async () => {
      if (!actor) return [];
      return await actor.getConversationHistory(
        Principal.fromText(contactPrincipal),
      );
    },
    enabled: !!actor && !!contactPrincipal,
    refetchInterval: 3000,
  });
}

/* ---------------------------- Mutations ---------------------------- */

export function useRegister() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.register(username);
    },
    onMutate: async (username: string) => {
      await queryClient.cancelQueries({ queryKey: KEYS.callerProfile });
      const previous = queryClient.getQueryData<UserProfile | null>(
        KEYS.callerProfile,
      );
      queryClient.setQueryData<UserProfile | null>(KEYS.callerProfile, {
        username,
        retention: RetentionPolicy.forever,
      });
      return { previous };
    },
    onError: (_error, _username, context) => {
      if (context) {
        queryClient.setQueryData(KEYS.callerProfile, context.previous ?? null);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.callerProfile });
    },
  });
}

export function useSendContactRequest() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (to: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.sendContactRequest(Principal.fromText(to));
    },
  });
}

export function useAcceptContactRequest() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (from: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.acceptContactRequest(Principal.fromText(from));
    },
    onMutate: async (from: string) => {
      await queryClient.cancelQueries({ queryKey: KEYS.pending });
      await queryClient.cancelQueries({ queryKey: KEYS.contacts });
      const prevPending = queryClient.getQueryData<ContactEntry[]>(KEYS.pending);
      const prevContacts =
        queryClient.getQueryData<ContactEntry[]>(KEYS.contacts);

      if (prevPending) {
        queryClient.setQueryData<ContactEntry[]>(
          KEYS.pending,
          prevPending.filter(([uid]) => uid.toString() !== from),
        );
      }

      const fromPrincipal = Principal.fromText(from);
      const accepted: ContactRequest = {
        from: fromPrincipal,
        to: fromPrincipal,
        status: Variant_pending_rejected_accepted.accepted,
      };
      const base = prevContacts ?? [];
      const alreadyThere = base.some(([uid]) => uid.toString() === from);
      queryClient.setQueryData<ContactEntry[]>(
        KEYS.contacts,
        alreadyThere
          ? base
          : [...base, [fromPrincipal, accepted] as ContactEntry],
      );

      return { prevPending, prevContacts };
    },
    onError: (_error, _from, context) => {
      if (context?.prevPending !== undefined) {
        queryClient.setQueryData(KEYS.pending, context.prevPending);
      }
      if (context?.prevContacts !== undefined) {
        queryClient.setQueryData(KEYS.contacts, context.prevContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.pending });
      queryClient.invalidateQueries({ queryKey: KEYS.contacts });
    },
  });
}

export function useRejectContactRequest() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (from: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.rejectContactRequest(Principal.fromText(from));
    },
    onMutate: async (from: string) => {
      await queryClient.cancelQueries({ queryKey: KEYS.pending });
      const prevPending = queryClient.getQueryData<ContactEntry[]>(KEYS.pending);
      if (prevPending) {
        queryClient.setQueryData<ContactEntry[]>(
          KEYS.pending,
          prevPending.filter(([uid]) => uid.toString() !== from),
        );
      }
      return { prevPending };
    },
    onError: (_error, _from, context) => {
      if (context?.prevPending !== undefined) {
        queryClient.setQueryData(KEYS.pending, context.prevPending);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.pending });
    },
  });
}

export function useFindUserByUsername() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.findUserByUsername(username);
      if (!result) return null;
      const [profile, principal] = result;
      return { profile, principal: principal.toString() };
    },
  });
}

export function useGetUserByPrincipal() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (principalStr: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.getUserByPrincipal(Principal.fromText(principalStr));
    },
  });
}

export function useSendSnap() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async ({
      receiver,
      bytes,
    }: {
      receiver: string;
      bytes: Uint8Array;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const blob = ExternalBlob.fromBytes(bytes as Uint8Array<ArrayBuffer>);
      return await actor.sendSnap(Principal.fromText(receiver), blob);
    },
  });
}

export function useOpenSnap() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapId: string) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.openSnap(snapId);
    },
    onMutate: async (snapId: string) => {
      await queryClient.cancelQueries({ queryKey: KEYS.unopenedSnaps });
      const previous = queryClient.getQueryData<Snap[]>(KEYS.unopenedSnaps);
      if (previous) {
        queryClient.setQueryData<Snap[]>(
          KEYS.unopenedSnaps,
          previous.filter((snap) => snap.id !== snapId),
        );
      }
      return { previous };
    },
    onError: (_error, _snapId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(KEYS.unopenedSnaps, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.unopenedSnaps });
    },
  });
}

export function useSendMessage() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      receiver,
      content,
      isSnapEvent,
    }: {
      receiver: string;
      content: string;
      isSnapEvent: boolean;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.sendMessage(
        Principal.fromText(receiver),
        content,
        isSnapEvent,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.conversation(variables.receiver),
      });
    },
  });
}

export function useUpdateRetention() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policy: RetentionPolicy) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.updateRetention(policy);
    },
    onMutate: async (policy: RetentionPolicy) => {
      await queryClient.cancelQueries({ queryKey: KEYS.callerProfile });
      const previous = queryClient.getQueryData<UserProfile | null>(
        KEYS.callerProfile,
      );
      if (previous) {
        queryClient.setQueryData<UserProfile | null>(KEYS.callerProfile, {
          ...previous,
          retention: policy,
        });
      }
      return { previous };
    },
    onError: (_error, _policy, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(KEYS.callerProfile, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.callerProfile });
    },
  });
}

export function useSaveProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: {
      username: string;
      retention: RetentionPolicy;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.saveCallerUserProfile(profile);
    },
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: KEYS.callerProfile });
      const previous = queryClient.getQueryData<UserProfile | null>(
        KEYS.callerProfile,
      );
      queryClient.setQueryData<UserProfile | null>(KEYS.callerProfile, profile);
      return { previous };
    },
    onError: (_error, _profile, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(KEYS.callerProfile, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.callerProfile });
    },
  });
}
