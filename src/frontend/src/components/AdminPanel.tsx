import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Principal } from "@dfinity/principal";
import {
  AlertCircle,
  CheckCircle,
  Info,
  Shield,
  ShieldOff,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { UserProfileEntry } from "../backend.d";
import { UserRole } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useListarTodosProfiles,
  usePromoverParaAdmin,
  useRevogarAdmin,
} from "../hooks/useQueries";

type ConfirmAction = { type: "promover" | "revogar"; user: UserProfileEntry };

function RoleBadge({ role }: { role: UserRole }) {
  if (role === UserRole.admin) {
    return (
      <span className="badge-admin inline-flex items-center gap-1 text-xs">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: "oklch(14% 0.022 240)",
        border: "1px solid oklch(17% 0.028 240 / 0.8)",
        color: "oklch(55% 0.022 240)",
      }}
    >
      Usuário
    </span>
  );
}

export default function AdminPanel() {
  const { identity } = useInternetIdentity();
  const {
    data: profiles = [],
    isLoading,
    isError,
    refetch,
  } = useListarTodosProfiles();
  const promover = usePromoverParaAdmin();
  const revogar = useRevogarAdmin();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const callerPrincipal = identity?.getPrincipal().toString();
  const isBusy = promover.isPending || revogar.isPending;

  async function handleConfirm() {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmAction(null);
    setErrorMessage("");
    try {
      if (type === "promover") {
        const result = await promover.mutateAsync(
          user.principalId as unknown as Principal,
        );
        if ("err" in result) throw new Error(result.err);
        setSuccessMessage(`${user.nome} agora é Administrador.`);
      } else {
        const result = await revogar.mutateAsync(
          user.principalId as unknown as Principal,
        );
        if ("err" in result) throw new Error(result.err);
        setSuccessMessage(
          `Privilégios de administrador removidos de ${user.nome}.`,
        );
      }
      setTimeout(() => setSuccessMessage(""), 4000);
      refetch();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Operação falhou. Tente novamente.";
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando usuários...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="glass-card rounded-2xl p-10 flex flex-col items-center text-center animate-fade-in"
        data-ocid="admin.error_state"
      >
        <AlertCircle
          className="h-10 w-10 mb-4"
          style={{ color: "oklch(70% 0.14 55)" }}
        />
        <p className="text-base font-semibold text-foreground mb-1">
          Erro ao carregar usuários
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          Não foi possível obter a lista de usuários. Verifique sua conexão.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="glass-button-primary h-9 px-4 text-sm"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="admin.section">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Painel de Administração
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os privilégios dos usuários do sistema
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
          style={{
            background: "oklch(11% 0.022 240)",
            border: "1px solid oklch(17% 0.028 240)",
          }}
        >
          <Users className="h-4 w-4" style={{ color: "oklch(62% 0.18 230)" }} />
          <span className="text-sm text-muted-foreground">
            {profiles.length} usuário{profiles.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Feedback banners */}
      {successMessage && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl animate-slide-in-down"
          style={{
            background: "oklch(62% 0.18 150 / 0.08)",
            border: "1px solid oklch(62% 0.18 150 / 0.28)",
          }}
          data-ocid="admin.success_state"
        >
          <CheckCircle
            className="h-4 w-4 shrink-0"
            style={{ color: "oklch(62% 0.18 150)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "oklch(62% 0.18 150)" }}
          >
            {successMessage}
          </p>
        </div>
      )}
      {errorMessage && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl animate-slide-in-down"
          style={{
            background: "oklch(70% 0.14 55 / 0.08)",
            border: "1px solid oklch(70% 0.14 55 / 0.3)",
          }}
          data-ocid="admin.error_state"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0"
            style={{ color: "oklch(70% 0.14 55)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "oklch(70% 0.14 55)" }}
          >
            {errorMessage}
          </p>
        </div>
      )}

      {/* User table */}
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        {/* Table header — desktop */}
        <div
          className="hidden md:grid grid-cols-12 gap-4 px-6 py-3"
          style={{
            borderBottom: "1px solid oklch(17% 0.028 240 / 0.5)",
            background: "oklch(9% 0.02 240 / 0.8)",
          }}
        >
          {(["Nome", "Principal ID", "Papel", "Ações"] as const).map(
            (col, i) => (
              <div
                key={col}
                className={[
                  "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                  i === 0
                    ? "col-span-3"
                    : i === 1
                      ? "col-span-5"
                      : i === 2
                        ? "col-span-2"
                        : "col-span-2 text-right",
                ].join(" ")}
              >
                {col}
              </div>
            ),
          )}
        </div>

        {profiles.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-14 text-center"
            data-ocid="admin.empty_state"
          >
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum usuário registrado
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {profiles
              .filter((e) => e != null)
              .map((entry, index) => {
                const pid = entry.principalId.toString();
                const isSelf = pid === callerPrincipal;
                const entryIsAdmin = entry.role === UserRole.admin;

                return (
                  <div
                    key={pid}
                    data-ocid={`admin.item.${index + 1}`}
                    className={[
                      "flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 px-5 md:px-6 py-4 transition-colors",
                      isSelf ? "bg-primary/[0.04]" : "hover:bg-primary/[0.02]",
                    ].join(" ")}
                  >
                    {/* Name col */}
                    <div className="md:col-span-3 flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                        style={
                          entryIsAdmin
                            ? {
                                background: "oklch(72% 0.12 270 / 0.12)",
                                border: "1px solid oklch(72% 0.12 270 / 0.3)",
                              }
                            : {
                                background: "oklch(14% 0.022 240)",
                                border: "1px solid oklch(17% 0.028 240)",
                              }
                        }
                      >
                        <Shield
                          className="h-3.5 w-3.5"
                          style={{
                            color: entryIsAdmin
                              ? "oklch(72% 0.12 270)"
                              : "oklch(55% 0.022 240)",
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {entry.nome}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                              (você)
                            </span>
                          )}
                        </p>
                        {/* Mobile role badge */}
                        <div className="md:hidden mt-1">
                          <RoleBadge role={entry.role} />
                        </div>
                      </div>
                    </div>

                    {/* Principal ID col */}
                    <div className="md:col-span-5 flex items-center">
                      <div
                        className="glass-card px-3 py-1.5 rounded-lg w-full overflow-hidden"
                        title={pid}
                      >
                        <span className="block text-xs font-mono text-muted-foreground truncate">
                          {pid}
                        </span>
                      </div>
                    </div>

                    {/* Role badge — desktop */}
                    <div className="hidden md:flex md:col-span-2 items-center">
                      <RoleBadge role={entry.role} />
                    </div>

                    {/* Actions col */}
                    <div className="md:col-span-2 flex items-center justify-end gap-2">
                      {!isSelf && !entryIsAdmin && (
                        <button
                          type="button"
                          data-ocid={`admin.promote_button.${index + 1}`}
                          onClick={() =>
                            setConfirmAction({ type: "promover", user: entry })
                          }
                          disabled={isBusy}
                          className="glass-button-ghost h-8 px-3 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            color: "oklch(72% 0.12 270)",
                            borderColor: "oklch(72% 0.12 270 / 0.28)",
                          }}
                        >
                          <Shield className="h-3 w-3" />
                          <span className="hidden sm:inline">Tornar Admin</span>
                        </button>
                      )}
                      {!isSelf && entryIsAdmin && (
                        <button
                          type="button"
                          data-ocid={`admin.revoke_button.${index + 1}`}
                          onClick={() =>
                            setConfirmAction({ type: "revogar", user: entry })
                          }
                          disabled={isBusy}
                          className="glass-button-ghost h-8 px-3 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            color: "oklch(70% 0.14 55)",
                            borderColor: "oklch(70% 0.14 55 / 0.28)",
                          }}
                        >
                          <ShieldOff className="h-3 w-3" />
                          <span className="hidden sm:inline">Revogar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
        style={{
          background: "oklch(60% 0.15 220 / 0.06)",
          border: "1px solid oklch(60% 0.15 220 / 0.2)",
        }}
      >
        <Info
          className="h-4 w-4 mt-0.5 shrink-0"
          style={{ color: "oklch(60% 0.15 220)" }}
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          O primeiro usuário a fazer login torna-se administrador
          automaticamente. Administradores podem promover outros usuários e
          revogar privilégios.
        </p>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent
          className="glass-modal border-border/50 w-full max-w-sm"
          data-ocid="admin.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-base font-semibold flex items-center gap-2">
              {confirmAction?.type === "promover" ? (
                <>
                  <Shield
                    className="h-4 w-4"
                    style={{ color: "oklch(72% 0.12 270)" }}
                  />
                  Promover a Administrador
                </>
              ) : (
                <>
                  <ShieldOff
                    className="h-4 w-4"
                    style={{ color: "oklch(70% 0.14 55)" }}
                  />
                  Revogar Administrador
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              {confirmAction?.type === "promover"
                ? `Tem certeza que deseja promover ${confirmAction.user.nome} a Administrador?`
                : `Tem certeza que deseja revogar os privilégios de ${confirmAction?.user.nome}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-ocid="admin.cancel_button"
              className="glass-button-ghost h-9 text-sm border-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="admin.confirm_button"
              onClick={handleConfirm}
              disabled={isBusy}
              className="h-9 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={
                confirmAction?.type === "promover"
                  ? {
                      background: "oklch(72% 0.12 270 / 0.12)",
                      border: "1px solid oklch(72% 0.12 270 / 0.3)",
                      color: "oklch(72% 0.12 270)",
                      borderRadius: "8px",
                    }
                  : {
                      background: "oklch(70% 0.14 55 / 0.12)",
                      border: "1px solid oklch(70% 0.14 55 / 0.3)",
                      color: "oklch(70% 0.14 55)",
                      borderRadius: "8px",
                    }
              }
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current/30 border-t-current" />
                  Aguarde...
                </span>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
