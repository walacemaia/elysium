import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  CheckCircle,
  FileText,
  Hash,
  Lock,
  LockOpen,
  Plus,
  Save,
  Shield,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type { Cofre } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  type DecryptedNota,
  useAdicionarNota,
  useExcluirNota,
  useListarNotas,
} from "../hooks/useQueries";
import NotaModal from "./NotaModal";

interface CofreModalProps {
  cofre: Cofre;
  onClose: () => void;
}

type EncryptionBadgeProps = { isEncrypted: boolean };

function EncryptionBadge({ isEncrypted }: EncryptionBadgeProps) {
  if (isEncrypted) {
    return (
      <span
        className="badge-encrypted inline-flex items-center gap-1 flex-shrink-0"
        title="Nota criptografada com vetkeys"
        data-ocid="nota.encrypted_badge"
      >
        <Lock className="h-3 w-3" />
        Criptografada
      </span>
    );
  }
  return (
    <span
      className="badge-plaintext inline-flex items-center gap-1 flex-shrink-0"
      title="Nota em texto não criptografado"
      data-ocid="nota.plaintext_badge"
    >
      <LockOpen className="h-3 w-3" />
      Texto puro
    </span>
  );
}

export default function CofreModal({ cofre, onClose }: CofreModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [selectedNota, setSelectedNota] = useState<DecryptedNota | null>(null);
  const [notaToDelete, setNotaToDelete] = useState<DecryptedNota | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const { identity } = useInternetIdentity();
  const { data: notas = [], isLoading } = useListarNotas(cofre.id);
  const adicionarNota = useAdicionarNota();
  const excluirNota = useExcluirNota();

  const isOwner =
    identity &&
    cofre.proprietario.toString() === identity.getPrincipal().toString();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !selectedNota && !showDeleteDialog) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, selectedNota, showDeleteDialog]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const resetAddForm = () => {
    setNovoTitulo("");
    setNovoConteudo("");
    setShowAddForm(false);
  };

  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novoConteudo.trim()) return;
    try {
      await adicionarNota.mutateAsync({
        idCofre: cofre.id,
        titulo: novoTitulo.trim(),
        conteudo: novoConteudo.trim(),
      });
      resetAddForm();
      showSuccess("Nota criada com sucesso!");
    } catch {
      // Error handled via toast in useQueries
    }
  };

  const handleDeleteNota = (nota: DecryptedNota, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotaToDelete(nota);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!notaToDelete) return;
    try {
      await excluirNota.mutateAsync({
        idCofre: cofre.id,
        idNota: notaToDelete.id,
      });
      setShowDeleteDialog(false);
      setNotaToDelete(null);
      showSuccess("Nota excluída com sucesso!");
    } catch {
      // Error handled via toast in useQueries
    }
  };

  const formatDate = (ts: bigint) =>
    new Date(Number(ts) / 1_000_000).toLocaleString("pt-BR");

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 z-50"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget && !selectedNota) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !selectedNota) onClose();
        }}
        data-ocid="cofre.dialog"
      >
        <div className="glass-modal w-full min-h-full sm:min-h-0 sm:max-w-2xl sm:max-h-[90vh] sm:rounded-2xl flex flex-col animate-fade-in overflow-hidden">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/40 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/15 border border-primary/25 flex-shrink-0">
                <Terminal className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                    {cofre.nome}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-technical text-muted-foreground flex-shrink-0"
                    style={{
                      background: "oklch(var(--muted) / 0.2)",
                      border: "1px solid oklch(var(--border) / 0.5)",
                    }}
                    title="ID do Cofre"
                  >
                    <Hash className="h-2.5 w-2.5" />
                    {cofre.id.toString()}
                  </span>
                </div>
                {cofre.descricao && (
                  <p className="text-muted-foreground text-sm truncate mt-0.5">
                    {cofre.descricao}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-ocid="cofre.close_button"
              aria-label="Fechar cofre"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/20 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Scrollable body ────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto glass-scrollbar dialog-body px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">
            {/* Success message */}
            {successMessage && (
              <Alert className="glass-card border-success/30 success-message">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription className="text-success font-medium text-sm ml-2">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Notes list label */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Notas
                {notas.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs text-foreground font-medium"
                    style={{
                      background: "oklch(var(--muted) / 0.25)",
                      border: "1px solid oklch(var(--border) / 0.4)",
                    }}
                  >
                    {notas.length}
                  </span>
                )}
              </h3>
            </div>

            {/* Loading */}
            {isLoading ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-muted-foreground"
                data-ocid="notas.loading_state"
              >
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-3" />
                <p className="text-sm">Carregando notas...</p>
              </div>
            ) : notas.length === 0 && !showAddForm ? (
              /* Empty state */
              <div
                className="flex flex-col items-center justify-center py-14 text-center"
                data-ocid="notas.empty_state"
              >
                <div className="p-4 rounded-2xl glass-card mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Nenhuma nota adicionada
                </h4>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  {isOwner
                    ? "Crie sua primeira nota neste cofre."
                    : "Este cofre não possui notas ainda."}
                </p>
              </div>
            ) : (
              /* Note cards — vertical list */
              <div className="space-y-2" data-ocid="notas.list">
                {notas.map((nota, idx) => (
                  <button
                    key={nota.id.toString()}
                    type="button"
                    data-ocid={`notas.item.${idx + 1}`}
                    onClick={() => setSelectedNota(nota)}
                    className="w-full text-left glass-card rounded-xl px-4 py-3 border border-border/30 hover:border-primary/30 hover:shadow-[0_0_16px_oklch(var(--primary)/0.12)] transition-all duration-200 animate-fade-in group flex flex-col gap-1.5"
                    style={{ minHeight: "60px", maxHeight: "80px" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 text-sm font-semibold text-foreground truncate min-w-0">
                        {nota.titulo}
                      </span>
                      <EncryptionBadge isEncrypted={nota.isEncrypted} />
                      {isOwner && (
                        <button
                          type="button"
                          data-ocid={`notas.delete_button.${idx + 1}`}
                          onClick={(e) => handleDeleteNota(nota, e)}
                          aria-label={`Excluir nota ${nota.titulo}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1 min-w-0">
                        {nota.conteudo}
                      </p>
                      <span className="font-technical text-[10px] text-muted-foreground/70 flex-shrink-0 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDate(nota.dataCriacao)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Add note form */}
            {showAddForm && isOwner && (
              <div className="glass-card rounded-xl p-4 border border-primary/20 animate-slide-up space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Nova Nota
                </h4>
                <form onSubmit={handleAddNota} className="space-y-3">
                  <Input
                    type="text"
                    value={novoTitulo}
                    onChange={(e) => setNovoTitulo(e.target.value)}
                    placeholder="Título da nota"
                    required
                    data-ocid="nota.new_title_input"
                    className="glass-input text-foreground placeholder:text-muted-foreground text-sm"
                  />
                  <Textarea
                    value={novoConteudo}
                    onChange={(e) => setNovoConteudo(e.target.value)}
                    placeholder="Conteúdo da nota..."
                    rows={5}
                    required
                    data-ocid="nota.new_content_textarea"
                    className="glass-input text-foreground placeholder:text-muted-foreground resize-none text-sm leading-relaxed"
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={resetAddForm}
                      data-ocid="nota.add_cancel_button"
                      disabled={adicionarNota.isPending}
                      className="glass-button-ghost text-sm px-4 py-2 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      data-ocid="nota.add_submit_button"
                      disabled={
                        !novoTitulo.trim() ||
                        !novoConteudo.trim() ||
                        adicionarNota.isPending
                      }
                      className="glass-button-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {adicionarNota.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Salvar Nota
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Privacy note */}
            <Alert className="glass-card border-info/20">
              <Shield className="h-4 w-4 text-info shrink-0" />
              <AlertDescription className="text-info/90 text-xs ml-2">
                <strong>Privacidade:</strong> Notas criptografadas com vetkeys —
                apenas usuários autorizados podem ler.
                {!isOwner && (
                  <span className="block mt-0.5 text-warning/80">
                    Você tem permissão somente de leitura neste cofre.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>

          {/* ── Footer — add button ─────────────────────────────── */}
          {isOwner && !showAddForm && (
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-border/40 flex justify-center flex-shrink-0">
              <Button
                onClick={() => setShowAddForm(true)}
                data-ocid="notas.add_button"
                className="glass-button-primary flex items-center gap-2 px-6 font-medium text-sm"
              >
                <Plus className="h-4 w-4" />
                Adicionar Nota
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Nota detail modal ───────────────────────────────────── */}
      {selectedNota && (
        <NotaModal
          nota={selectedNota}
          cofreId={cofre.id}
          isReadOnly={!isOwner}
          onClose={() => setSelectedNota(null)}
          onNotaUpdated={() => setSelectedNota(null)}
        />
      )}

      {/* ── Delete confirmation dialog ──────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          className="glass-modal border border-border/50 animate-fade-in"
          data-ocid="nota.delete.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-semibold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Nota
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza de que deseja excluir a nota{" "}
              <strong className="text-foreground">
                "{notaToDelete?.titulo}"
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-ocid="nota.delete.cancel_button"
              className="glass-button-ghost text-sm"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-ocid="nota.delete.confirm_button"
              disabled={excluirNota.isPending}
              className="glass-button-ghost text-destructive border-destructive/30 hover:bg-destructive/15 text-sm"
            >
              {excluirNota.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
