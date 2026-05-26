import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message, Snap, UserProfile } from "../backend.d";
import { RetentionPolicy } from "../backend.d";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

export { RetentionPolicy };

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useRegister() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("Actor not available");
      await actor.register(username);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export function useListContacts() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listContacts();
    },
    enabled: !!actor && !isFetching && !!identity,
    refetchInterval: 10000,
  });
}

export function useListPendingRequests() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPendingRequests();
    },
    enabled: !!actor && !isFetching && !!identity,
    refetchInterval: 10000,
  });
}

export function useConversationHistory(otherUserPrincipal: string | null) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery<Message[]>({
    queryKey: ["conversation", otherUserPrincipal],
    queryFn: async () => {
      if (!actor || !otherUserPrincipal) return [];
      const principal = Principal.fromText(otherUserPrincipal);
      return actor.getConversationHistory(principal);
    },
    enabled: !!actor && !isFetching && !!identity && !!otherUserPrincipal,
    refetchInterval: 5000,
  });
}

export function useListUnopenedSnaps() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery<Snap[]>({
    queryKey: ["unopenedSnaps"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listUnopenedSnaps();
    },
    enabled: !!actor && !isFetching && !!identity,
    refetchInterval: 8000,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
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
      const principal = Principal.fromText(receiver);
      return actor.sendMessage(principal, content, isSnapEvent);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", vars.receiver],
      });
    },
  });
}

export function useSendContactRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principalStr: string) => {
      if (!actor) throw new Error("Actor not available");
      const principal = Principal.fromText(principalStr);
      await actor.sendContactRequest(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useAcceptContactRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principalStr: string) => {
      if (!actor) throw new Error("Actor not available");
      const principal = Principal.fromText(principalStr);
      await actor.acceptContactRequest(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
  });
}

export function useRejectContactRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principalStr: string) => {
      if (!actor) throw new Error("Actor not available");
      const principal = Principal.fromText(principalStr);
      await actor.rejectContactRequest(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
  });
}

export function useUpdateRetention() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policy: RetentionPolicy) => {
      if (!actor) throw new Error("Actor not available");
      await actor.updateRetention(policy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export function useGetUserByUsername() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.getUserByUsername(username);
    },
  });
}

export function useFindUserByUsername() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (
      username: string,
    ): Promise<{ profile: UserProfile; principal: string } | null> => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.findUserByUsername(username);
      if (!result) return null;
      const [profile, principal] = result;
      return {
        profile,
        principal: principal.toString(),
      };
    },
  });
}

export function useGetUserByPrincipal() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (principalStr: string) => {
      if (!actor) throw new Error("Actor not available");
      const principal = Principal.fromText(principalStr);
      return actor.getUserByPrincipal(principal);
    },
  });
}

export function useOpenSnap() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapId: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.openSnap(snapId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unopenedSnaps"] });
    },
  });
}

export function useSendSnap() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      receiver,
      bytes,
    }: {
      receiver: string;
      bytes: Uint8Array;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const { ExternalBlob } = await import("../backend");
      const blob = ExternalBlob.fromBytes(
        bytes as unknown as Uint8Array<ArrayBuffer>,
      );
      const principal = Principal.fromText(receiver);
      const snapId = await actor.sendSnap(principal, blob);
      await actor.sendMessage(principal, "📸 Snap", true);
      return snapId;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", vars.receiver],
      });
      queryClient.invalidateQueries({ queryKey: ["unopenedSnaps"] });
    },
  });
}

export function useSaveProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}
