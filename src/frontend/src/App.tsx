import { Toaster } from "@/components/ui/sonner";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import BottomNav from "./components/BottomNav";
import RegisterModal from "./components/RegisterModal";
import { useGetCallerUserProfile, useOpenSnap } from "./hooks/useQueries";
import AuthScreen from "./screens/AuthScreen";
import CameraScreen from "./screens/CameraScreen";
import ChatDetailScreen from "./screens/ChatDetailScreen";
import ChatsScreen from "./screens/ChatsScreen";
import ContactsScreen from "./screens/ContactsScreen";
import ProfileScreen from "./screens/ProfileScreen";

export type MainScreen = "camera" | "chats" | "contacts" | "profile";

// Left-to-right order of the swipeable pages (matches the bottom nav order).
const SCREEN_ORDER: MainScreen[] = ["chats", "camera", "contacts", "profile"];

export default function App() {
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const [activeScreen, setActiveScreen] = useState<MainScreen>("camera");
  const [chatContact, setChatContact] = useState<string | null>(null);
  const [directSnapUrl, setDirectSnapUrl] = useState<string | null>(null);
  const [loadingSnap, setLoadingSnap] = useState(false);

  const openSnap = useOpenSnap();

  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useGetCallerUserProfile();
  const showRegisterModal =
    isAuthenticated &&
    profileFetched &&
    !profileLoading &&
    userProfile === null;

  const activeIndex = SCREEN_ORDER.indexOf(activeScreen);

  // ── Swipe-to-switch-tabs (Snapchat-style) ──────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    // Ignore gestures that start inside opted-out surfaces (e.g. the snap editor)
    if ((e.target as HTMLElement).closest("[data-noswipe]")) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    // Require a clearly horizontal swipe so vertical scrolling still works.
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0 && activeIndex < SCREEN_ORDER.length - 1) {
      setActiveScreen(SCREEN_ORDER[activeIndex + 1]);
    } else if (dx > 0 && activeIndex > 0) {
      setActiveScreen(SCREEN_ORDER[activeIndex - 1]);
    }
  };

  const handleOpenChat = (principalStr: string) => {
    setChatContact(principalStr);
  };

  const handleCloseChat = () => {
    setChatContact(null);
  };

  const handleOpenSnap = async (snapId: string) => {
    setLoadingSnap(true);
    try {
      const blob = await openSnap.mutateAsync(snapId);
      const url = blob.getDirectURL();
      setDirectSnapUrl(url);
    } catch {
      toast.error("Couldn't open snap");
    } finally {
      setLoadingSnap(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="dark h-full">
        <AuthScreen />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="dark h-full bg-background overflow-hidden">
      <div className="mx-auto h-full flex flex-col" style={{ maxWidth: 430 }}>
        <div className="flex-1 overflow-hidden relative">
          {chatContact ? (
            <ChatDetailScreen
              contactPrincipal={chatContact}
              onBack={handleCloseChat}
            />
          ) : (
            <div
              className="h-full overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="flex h-full w-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                <div className="h-full shrink-0 basis-full">
                  <ChatsScreen
                    onOpenChat={handleOpenChat}
                    onOpenSnap={handleOpenSnap}
                    onNavigate={setActiveScreen}
                  />
                </div>
                <div className="h-full shrink-0 basis-full">
                  <CameraScreen activeScreen={activeScreen} />
                </div>
                <div className="h-full shrink-0 basis-full">
                  <ContactsScreen onOpenChat={handleOpenChat} />
                </div>
                <div className="h-full shrink-0 basis-full">
                  <ProfileScreen />
                </div>
              </div>
            </div>
          )}
        </div>

        {!chatContact && (
          <BottomNav active={activeScreen} onChange={setActiveScreen} />
        )}
      </div>

      {showRegisterModal && <RegisterModal />}
      <Toaster />

      <AnimatePresence>
        {loadingSnap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
            data-ocid="snap.loading_state"
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-full border-4 border-transparent border-t-current animate-spin"
                style={{ color: "oklch(var(--primary))" }}
              />
              <p className="text-white text-sm">Opening snap…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {directSnapUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
            onClick={() => setDirectSnapUrl(null)}
            data-ocid="snap.modal"
          >
            <img
              src={directSnapUrl}
              alt="Snap"
              className="w-full h-full object-contain"
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
