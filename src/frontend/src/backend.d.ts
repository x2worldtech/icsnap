import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Snap {
    id: string;
    opened: boolean;
    sender: UserId;
    timestamp: Time;
    blobId: ExternalBlob;
    receiver: UserId;
}
export type UserId = Principal;
export type Time = bigint;
export interface ContactRequest {
    to: UserId;
    status: Variant_pending_rejected_accepted;
    from: UserId;
}
export interface Message {
    id: bigint;
    content: string;
    sender: UserId;
    snapId?: string;
    timestamp: Time;
    isSnapEvent: boolean;
    receiver: UserId;
}
export interface UserProfile {
    username: string;
    retention: RetentionPolicy;
}
export enum RetentionPolicy {
    deleteAfter24h = "deleteAfter24h",
    forever = "forever"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_pending_rejected_accepted {
    pending = "pending",
    rejected = "rejected",
    accepted = "accepted"
}
export interface backendInterface {
    acceptContactRequest(from: UserId): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getConversationHistory(otherUser: UserId): Promise<Array<Message>>;
    getUserByPrincipal(id: UserId): Promise<UserProfile>;
    getUserByUsername(username: string): Promise<UserProfile>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listContacts(): Promise<Array<[UserId, ContactRequest]>>;
    listPendingRequests(): Promise<Array<[UserId, ContactRequest]>>;
    listUnopenedSnaps(): Promise<Array<Snap>>;
    openSnap(snapId: string): Promise<ExternalBlob>;
    register(username: string): Promise<void>;
    rejectContactRequest(from: UserId): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendContactRequest(to: UserId): Promise<void>;
    sendMessage(receiver: UserId, content: string, isSnapEvent: boolean): Promise<bigint>;
    sendSnap(receiver: UserId, blobId: ExternalBlob): Promise<string>;
    updateRetention(policy: RetentionPolicy): Promise<void>;
}
