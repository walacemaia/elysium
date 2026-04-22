import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import {
  Heart,
  LogOut,
  Settings,
  Shield,
  User,
  Users,
  Vault,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import Contatos from "./components/Contatos";
import Dashboard from "./components/Dashboard";
import LoginButton from "./components/LoginButton";
import ProfileEdit from "./components/ProfileEdit";
import ProfileSetup from "./components/ProfileSetup";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";

type ActiveTab = "cofres" | "contatos" | "admin";

export default function App() {
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cofres");
  const [isAdmin, setIsAdmin] = useState(false);
  const { identity, isInitializing, clear } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useGetCallerUserProfile();

  const initCalledRef = useRef(false);
  useEffect(() => {
    if (!actor || actorFetching || !identity) {
      initCalledRef.current = false;
      setIsAdmin(false);
      return;
    }
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    actor.initializeAccessControl().catch((err: unknown) => {
      console.warn("[elysium] initializeAccessControl failed:", err);
    });
    actor.atualizarUltimoAcessoBackend().catch((err: unknown) => {
      console.warn("[elysium] Failed to update last access on login:", err);
    });
  }, [actor, actorFetching, identity]);

  const checkAdmin = useCallback(async () => {
    if (!actor || actorFetching || !identity) return;
    try {
      const result = await actor.isCallerAdmin();
      setIsAdmin(result);
    } catch (err) {
      console.warn("[elysium] isCallerAdmin failed:", err);
      setIsAdmin(false);
    }
  }, [actor, actorFetching, identity]);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  const isAuthenticated = !!identity;
  const showProfileSetup =
    isAuthenticated && !profileLoading && isFetched && userProfile === null;

  const tabs: {
    value: ActiveTab;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    { value: "cofres", label: "Cofres", icon: <Vault className="h-4 w-4" /> },
    {
      value: "contatos",
      label: "Contatos",
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: "admin",
      label: "Admin",
      icon: <Shield className="h-4 w-4" />,
      adminOnly: true,
    },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8 text-center animate-pulse-glow">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm font-body">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full glass-card rounded-none border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{
                background: "oklch(62% 0.18 230 / 0.15)",
                border: "1px solid oklch(62% 0.18 230 / 0.3)",
              }}
            >
              <Vault className="h-5 w-5 text-primary" />
            </div>
            <span
              className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent font-display"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, oklch(72% 0.15 210), oklch(62% 0.18 230))",
              }}
            >
              Elysium
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {isAuthenticated && userProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-ocid="header.profile_button"
                    className="glass-button-ghost flex items-center gap-2 h-9 px-3 rounded-lg border-border/50"
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate text-foreground">
                      {userProfile.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="glass-modal border-border/50 min-w-[180px] rounded-xl p-1"
                >
                  <DropdownMenuItem
                    onClick={() => setShowProfileEdit(true)}
                    className="cursor-pointer gap-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/40 focus:bg-muted/40"
                    data-ocid="header.edit_profile_button"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Editar Perfil</span>
                  </DropdownMenuItem>
                  {clear && (
                    <DropdownMenuItem
                      onClick={() => clear()}
                      className="cursor-pointer gap-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                      data-ocid="header.logout_button"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!isAuthenticated && <LoginButton />}
          </div>
        </div>

        {/* ── Tab Bar (only when authenticated and profile ready) ── */}
        {isAuthenticated && !showProfileSetup && (
          <div
            className="w-full overflow-x-auto"
            style={{ borderTop: "1px solid oklch(17% 0.028 240 / 0.4)" }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav
                className="flex items-center gap-1 sm:gap-0 min-w-max sm:min-w-0"
                aria-label="Navegação principal"
              >
                {visibleTabs.map((tab) => {
                  const isActive = activeTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      data-ocid={`tab-${tab.value}`}
                      onClick={() => setActiveTab(tab.value)}
                      className={[
                        "relative flex items-center gap-2 px-4 py-3 text-sm font-medium font-body transition-colors duration-200 whitespace-nowrap select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-none",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.value === "admin" && isAdmin && (
                        <span
                          className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full"
                          style={{
                            background: "oklch(62% 0.18 230 / 0.2)",
                            border: "1px solid oklch(62% 0.18 230 / 0.3)",
                          }}
                        >
                          <Shield className="h-2.5 w-2.5 text-primary" />
                        </span>
                      )}
                      {/* Active underline */}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                          style={{
                            background:
                              "linear-gradient(90deg, oklch(72% 0.15 210), oklch(62% 0.18 230))",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isAuthenticated ? (
          /* ── Login Page ── */
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
            <div className="glass-card rounded-2xl p-8 sm:p-10 w-full max-w-md animate-fade-in text-center">
              <div
                className="mx-auto flex items-center justify-center h-20 w-20 rounded-2xl mb-6 animate-pulse-glow"
                style={{
                  background: "oklch(62% 0.18 230 / 0.12)",
                  border: "1px solid oklch(62% 0.18 230 / 0.3)",
                }}
              >
                <Vault className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 font-display">
                Bem-vindo ao Elysium
              </h2>
              <p className="text-base text-muted-foreground mb-8 leading-relaxed font-body">
                Crie cofres seguros para suas notas e compartilhe com pessoas
                autorizadas de acordo com suas regras.
              </p>
              <div className="flex flex-col items-center gap-3">
                <LoginButton />
                <p className="text-sm text-muted-foreground font-body">
                  Faça login para começar a criar seus cofres privados
                </p>
              </div>
            </div>
          </div>
        ) : showProfileSetup ? (
          /* ── Profile Setup (modal overlay) ── */
          <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
            <ProfileSetup />
          </div>
        ) : showProfileEdit ? (
          /* ── Profile Edit ── */
          <ProfileEdit onClose={() => setShowProfileEdit(false)} />
        ) : (
          /* ── Tabbed Dashboard ── */
          <div className="animate-slide-up">
            {activeTab === "cofres" && <Dashboard />}
            {activeTab === "contatos" && <Contatos />}
            {activeTab === "admin" && isAdmin && <AdminPanel />}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        className="w-full mt-auto"
        style={{
          background: "oklch(8% 0.018 240)",
          borderTop: "1px solid oklch(17% 0.028 240 / 0.5)",
        }}
      >
        <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground font-body">
            © {new Date().getFullYear()}. Feito com{" "}
            <Heart className="inline h-3.5 w-3.5 text-destructive animate-pulse" />{" "}
            usando{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.hostname : "",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "oklch(11% 0.022 240 / 0.97)",
            backdropFilter: "blur(16px)",
            color: "oklch(92% 0.015 240)",
            border: "1px solid oklch(17% 0.028 240)",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        }}
      />
    </div>
  );
}
