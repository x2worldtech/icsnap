import { Camera, MessageCircle, User, Users } from "lucide-react";
import { motion } from "motion/react";
import type { MainScreen } from "../App";

interface BottomNavProps {
  active: MainScreen;
  onChange: (screen: MainScreen) => void;
  onCamera?: () => void;
}

const NAV_ITEMS: { id: MainScreen; icon: React.ReactNode; label: string }[] = [
  { id: "chats", icon: <MessageCircle className="w-5 h-5" />, label: "Chats" },
  { id: "camera", icon: <Camera className="w-6 h-6" />, label: "Kamera" },
  { id: "contacts", icon: <Users className="w-5 h-5" />, label: "Kontakte" },
  { id: "profile", icon: <User className="w-5 h-5" />, label: "Profil" },
];

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className="px-4 pb-2">
      <div
        className="flex items-center justify-around rounded-3xl px-2 py-2 backdrop-blur-md"
        style={{
          background: "oklch(0.14 0.012 280 / 0.95)",
          border: "1px solid oklch(0.26 0.018 280)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          const isCamera = item.id === "camera";
          return (
            <button
              type="button"
              key={item.id}
              data-ocid={`nav.${item.id}.link`}
              onClick={() => onChange(item.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 transition-all"
              style={{
                minWidth: isCamera ? 64 : 48,
                minHeight: isCamera ? 56 : 48,
              }}
            >
              {isCamera ? (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.48 0.2 280))"
                      : "oklch(0.19 0.016 280)",
                    boxShadow: isActive
                      ? "0 0 20px oklch(0.55 0.22 293 / 0.5)"
                      : "none",
                  }}
                >
                  <span
                    style={{ color: isActive ? "white" : "oklch(0.55 0 0)" }}
                  >
                    {item.icon}
                  </span>
                </div>
              ) : (
                <>
                  <span
                    className="transition-colors"
                    style={{
                      color: isActive
                        ? "oklch(0.55 0.22 293)"
                        : "oklch(0.55 0 0)",
                      filter: isActive
                        ? "drop-shadow(0 0 6px oklch(0.55 0.22 293 / 0.6))"
                        : "none",
                    }}
                  >
                    {item.icon}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="w-1 h-1 rounded-full"
                      style={{ background: "oklch(0.55 0.22 293)" }}
                    />
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
