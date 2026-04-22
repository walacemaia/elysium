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
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle,
  Info,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  useAdicionarContato,
  useListarContatos,
  useRemoverContato,
  useValidarUsuarioExiste,
} from "../hooks/useQueries";

type Contato = { principalId: { toString(): string }; nome: string };

export default function Contatos() {
  const [novoPrincipalId, setNovoPrincipalId] = useState("");
  const [validationError, setValidationError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [contatoToDelete, setContatoToDelete] = useState<Contato | null>(null);

  const { data: contatos = [], isLoading } = useListarContatos();
  const adicionarContato = useAdicionarContato();
  const removerContato = useRemoverContato();
  const validarUsuario = useValidarUsuarioExiste();

  const isPending = adicionarContato.isPending || validarUsuario.isPending;

  const handleAddContato = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    const pid = novoPrincipalId.trim();
    if (!pid) {
      setValidationError("Principal ID é obrigatório.");
      return;
    }
    try {
      const exists = await validarUsuario.mutateAsync(pid);
      if (!exists) {
        setValidationError(
          "Este Principal ID não pertence a nenhum usuário registrado.",
        );
        return;
      }
      const alreadyAdded = contatos.some(
        (c) => c.principalId.toString() === pid,
      );
      if (alreadyAdded) {
        setValidationError("Este contato já está na sua lista.");
        return;
      }
      await adicionarContato.mutateAsync(pid);
      setNovoPrincipalId("");
      setShowAddForm(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Contato já existe")) {
        setValidationError("Este contato já está na sua lista.");
      } else if (msg.includes("Principal ID não encontrado")) {
        setValidationError(
          "Este Principal ID não pertence a nenhum usuário registrado.",
        );
      } else {
        setValidationError(
          "Erro ao adicionar contato. Verifique o Principal ID e tente novamente.",
        );
      }
    }
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNovoPrincipalId("");
    setValidationError("");
  };

  const confirmDelete = async () => {
    if (!contatoToDelete) return;
    try {
      await removerContato.mutateAsync(contatoToDelete.principalId.toString());
    } catch (err) {
      console.error("Erro ao remover contato:", err);
    } finally {
      setContatoToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando contatos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="contatos.section">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Meus Contatos
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie contatos para compartilhar cofres
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            data-ocid="contatos.add_button"
            className="glass-button-primary h-9 px-4 text-sm w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Novo Contato
          </button>
        )}
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl animate-slide-in-down"
          style={{
            background: "oklch(62% 0.18 150 / 0.08)",
            border: "1px solid oklch(62% 0.18 150 / 0.28)",
          }}
          data-ocid="contatos.success_state"
        >
          <CheckCircle
            className="h-4 w-4 shrink-0"
            style={{ color: "oklch(62% 0.18 150)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "oklch(62% 0.18 150)" }}
          >
            Contato adicionado com sucesso.
          </p>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div
          className="glass-card rounded-2xl p-5 animate-slide-up"
          data-ocid="contatos.add_form"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Adicionar Contato
          </h3>

          {validationError && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4"
              style={{
                background: "oklch(70% 0.14 55 / 0.08)",
                border: "1px solid oklch(70% 0.14 55 / 0.3)",
              }}
              data-ocid="contatos.field_error"
            >
              <AlertCircle
                className="h-4 w-4 mt-0.5 shrink-0"
                style={{ color: "oklch(70% 0.14 55)" }}
              />
              <p className="text-sm" style={{ color: "oklch(70% 0.14 55)" }}>
                {validationError}
              </p>
            </div>
          )}

          <form onSubmit={handleAddContato} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="contact-pid"
                className="text-sm font-medium text-foreground"
              >
                Principal ID do contato
              </Label>
              <input
                type="text"
                id="contact-pid"
                data-ocid="contatos.search_input"
                value={novoPrincipalId}
                onChange={(e) => {
                  setNovoPrincipalId(e.target.value);
                  setValidationError("");
                }}
                placeholder="Principal ID do contato"
                className="glass-input w-full h-10 px-3 text-sm font-mono"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <p className="text-xs text-muted-foreground">
                Insira o Principal ID de um usuário registrado na aplicação.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                data-ocid="contatos.cancel_button"
                onClick={handleCancelAdd}
                disabled={isPending}
                className="glass-button-ghost flex-1 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-ocid="contatos.submit_button"
                disabled={!novoPrincipalId.trim() || isPending}
                className="glass-button-primary flex-1 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                    {validarUsuario.isPending
                      ? "Validando..."
                      : "Adicionando..."}
                  </span>
                ) : (
                  "Adicionar"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts list */}
      {contatos.length === 0 ? (
        <div
          className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in"
          data-ocid="contatos.empty_state"
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: "oklch(14% 0.022 240)",
              border: "1px solid oklch(17% 0.028 240)",
            }}
          >
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-base font-medium text-foreground mb-1.5">
            Nenhum contato ainda
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Adicione contatos para poder compartilhar seus cofres com eles.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            data-ocid="contatos.empty_state_add_button"
            className="glass-button-primary h-9 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeiro Contato
          </button>
        </div>
      ) : (
        <div
          className="glass-card rounded-2xl overflow-hidden"
          data-ocid="contatos.list"
        >
          <div className="divide-y divide-border/30">
            {contatos.map((contato, index) => (
              <div
                key={contato.principalId.toString()}
                data-ocid={`contatos.item.${index + 1}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-primary/[0.03] transition-colors"
              >
                {/* Avatar */}
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "oklch(62% 0.18 150 / 0.1)",
                    border: "1px solid oklch(62% 0.18 150 / 0.25)",
                  }}
                >
                  <UserCheck
                    className="h-4 w-4"
                    style={{ color: "oklch(62% 0.18 150)" }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {contato.nome}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                    {contato.principalId.toString()}
                  </p>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  data-ocid={`contatos.delete_button.${index + 1}`}
                  onClick={() => setContatoToDelete(contato)}
                  aria-label={`Remover ${contato.nome}`}
                  className="h-8 w-8 flex items-center justify-center glass-button-ghost rounded-lg text-muted-foreground hover:text-warning hover:border-warning/30 shrink-0 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
          Apenas contatos da sua lista podem ser autorizados a acessar seus
          cofres. Os nomes são atualizados automaticamente quando o usuário
          edita seu perfil.
        </p>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={contatoToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setContatoToDelete(null);
        }}
      >
        <AlertDialogContent
          className="glass-modal border-border/50 w-full max-w-sm"
          data-ocid="contatos.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-base font-semibold">
              Remover Contato
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              Deseja remover{" "}
              <span className="text-foreground font-medium">
                {contatoToDelete?.nome}
              </span>{" "}
              da sua lista? Ele não poderá mais ser autorizado a acessar seus
              cofres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-ocid="contatos.cancel_button"
              className="glass-button-ghost h-9 text-sm border-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="contatos.confirm_button"
              onClick={confirmDelete}
              disabled={removerContato.isPending}
              className="h-9 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "oklch(70% 0.14 55 / 0.12)",
                border: "1px solid oklch(70% 0.14 55 / 0.3)",
                color: "oklch(70% 0.14 55)",
                borderRadius: "8px",
              }}
            >
              {removerContato.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-warning/30 border-t-warning" />
                  Removendo...
                </span>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
