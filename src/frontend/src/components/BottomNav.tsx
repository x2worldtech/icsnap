import { Camera, MessageCircle, User, Users } from "lucide-react";
import { motion } from "motion/react";
import type { MainScreen } from "../App";

interface BottomNavProps {
  active: MainScreen;
  onChange: (screen: MainScreen) => void;
}

const NAV_ITEMS = [
  { id: "chats", icon: MessageCircle, label: "Chats" },
  { id: "camera", icon: Camera, label: "Camera" },
  { id: "contacts", icon: Users, label: "Contacts" },
  { id: "profile", icon: User, label: "Profile" },
] as const;

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="glass border-t border-white/10">
      <div
        className="flex items-center justify-around px-3 pt-2.5"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.625rem)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isCamera = item.id === "camera";

          if (isCamera) {
            return (
              <button
                type="button"
                key={item.id}
                data-ocid={`nav.${item.id}.link`}
                onClick={() => onChange(item.id)}
                aria-label={item.label}
                className="flex items-center justify-center"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "gradient-avatar brand-glow text-white scale-105"
                      : "bg-secondary text-muted-foreground active:scale-95"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </button>
            );
          }

          return (
            <button
              type="button"
              key={item.id}
              data-ocid={`nav.${item.id}.link`}
              onClick={() => onChange(item.id)}
              aria-label={item.label}
              className="relative flex min-w-[3.75rem] flex-col items-center gap-1 py-1"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-1.5 h-1 w-7 rounded-full bg-primary"
                />
              )}
              <Icon
                className={`w-[1.375rem] h-[1.375rem] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                style={
                  isActive
                    ? {
                        filter:
                          "drop-shadow(0 0 8px oklch(var(--primary) / 0.55))",
                      }
                    : undefined
                }
              />
              <span
                className={`text-[0.625rem] font-semibold tracking-wide transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground/70"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
