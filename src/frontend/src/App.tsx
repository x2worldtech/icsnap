import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import BottomNav from "./components/BottomNav";
import RegisterModal from "./components/RegisterModal";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile, useOpenSnap } from "./hooks/useQueries";
import AuthScreen from "./screens/AuthScreen";
import CameraScreen from "./screens/CameraScreen";
import ChatDetailScreen from "./screens/ChatDetailScreen";
import ChatsScreen from "./screens/ChatsScreen";
import ContactsScreen from "./screens/ContactsScreen";
import ProfileScreen from "./screens/ProfileScreen";

export type MainScreen = "camera" | "chats" | "contacts" | "profile";

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
      toast.error("Snap konnte nicht ge\u00F6ffnet werden");
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
            <>
              <div className={activeScreen === "camera" ? "h-full" : "hidden"}>
                <CameraScreen
                  activeScreen={activeScreen}
                  setActiveScreen={setActiveScreen}
                />
              </div>
              <div className={activeScreen === "chats" ? "h-full" : "hidden"}>
                <ChatsScreen
                  onOpenChat={handleOpenChat}
                  onOpenSnap={handleOpenSnap}
                />
              </div>
              <div
                className={activeScreen === "contacts" ? "h-full" : "hidden"}
              >
                <ContactsScreen onOpenChat={handleOpenChat} />
              </div>
              <div className={activeScreen === "profile" ? "h-full" : "hidden"}>
                <ProfileScreen />
              </div>
            </>
          )}
        </div>

        {activeScreen !== "camera" && !chatContact && (
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
                style={{ color: "oklch(0.55 0.22 293)" }}
              />
              <p className="text-white text-sm">Snap wird ge\u00F6ffnet...</p>
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
              Tippen zum Schlie\u00DFen
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
