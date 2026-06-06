// Re-exports for convenience — all types are generated in backend.ts (via bindgen).
// Import directly from "@/backend" or "../backend" in your components.
export type {
  ContactRequest,
  ExternalBlob,
  Message,
  None,
  Option,
  Snap,
  Some,
  Time,
  UserProfile,
  UserId,
} from "../backend";
export { RetentionPolicy, UserRole, Variant_pending_rejected_accepted } from "../backend";
