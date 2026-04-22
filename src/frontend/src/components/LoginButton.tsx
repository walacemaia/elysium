import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginButton() {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";
  const disabled = isLoggingIn;

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: unknown) {
        const err = error as Error;
        console.error("Erro no login:", err);
        if (err.message === "User is already authenticated") {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={handleAuth}
        disabled={disabled}
        className="glass-button-ghost flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
        data-ocid="header.logout_button"
      >
        <LogOut className="h-4 w-4" />
        <span>Sair</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAuth}
      disabled={disabled}
      className="glass-button-primary flex items-center gap-2 min-w-[120px] justify-center"
      data-ocid="login.submit_button"
    >
      {isLoggingIn ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          <span>Entrando...</span>
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4" />
          <span>Entrar</span>
        </>
      )}
    </button>
  );
}
