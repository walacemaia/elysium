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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Principal } from "@dfinity/principal";
import {
  AlertCircle,
  Clock,
  Edit3,
  FileText,
  Hash,
  Loader2,
  Lock,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
  UserMinus,
  Users,
  Vault,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import type { Cofre } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useEditarCofre,
  useExcluirCofre,
  useListarContatos,
  useObterUltimoAcesso,
  useRevogarAutorizacao,
  useVerificarAcessoCofre,
} from "../hooks/useQueries";
import CofreModal from "./CofreModal";

interface CofreCardProps {
  cofre: Cofre;
}

export default function CofreCard({ cofre }: CofreCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [isCheckingNotes, setIsCheckingNotes] = useState(false);

  const [nome, setNome] = useState(cofre.nome);
  const [descricao, setDescricao] = useState(cofre.descricao);
  const [usuariosAutorizados, setUsuariosAutorizados] = useState<string[]>(
    cofre.regrasAcesso.usuariosAutorizados.map((p) => p.toString()),
  );
  const [periodoInatividade, setPeriodoInatividade] = useState(
    Math.floor(
      Number(cofre.regrasAcesso.periodoInatividade) / (24 * 60 * 60),
    ).toString(),
  );
  const [unidadeTempo, setUnidadeTempo] = useState<
    "minutos" | "horas" | "dias"
  >("dias");

  const { identity } = useInternetIdentity();
  const editarCofre = useEditarCofre();
  const excluirCofre = useExcluirCofre();
  const revogarAutorizacao = useRevogarAutorizacao();
  const { data: contatos = [] } = useListarContatos();
  const { data: ultimoAcessoProprietario = BigInt(0) } = useObterUltimoAcesso(
    cofre.proprietario,
  );

  const isOwner =
    identity &&
    cofre.proprietario.toString() === identity.getPrincipal().toString();

  const hasInactivityRule = cofre.regrasAcesso.periodoInatividade > BigInt(0);
  const { hasAccess: polledHasAccess, refetch: refetchAccess } =
    useVerificarAcessoCofre(cofre.id, hasInactivityRule);

  const localHasAccess =
    identity && (isOwner || temPermissaoAcesso(identity.getPrincipal(), cofre));

  const hasAccess = hasInactivityRule
    ? polledHasAccess !== undefined
      ? polledHasAccess
      : localHasAccess
    : localHasAccess;

  const isLocked = !isOwner && !hasAccess;

  const getContactName = (principalId: string) => {
    const contato = contatos.find(
      (c) => c.principalId.toString() === principalId,
    );
    return contato ? contato.nome : `${principalId.slice(0, 10)}...`;
  };

  React.useEffect(() => {
    const segundos = Number(cofre.regrasAcesso.periodoInatividade);
    const dias = segundos / (24 * 60 * 60);
    const horas = segundos / (60 * 60);
    const minutos = segundos / 60;

    if (dias >= 1 && dias === Math.floor(dias)) {
      setUnidadeTempo("dias");
      setPeriodoInatividade(Math.floor(dias).toString());
    } else if (horas >= 1 && horas === Math.floor(horas)) {
      setUnidadeTempo("horas");
      setPeriodoInatividade(Math.floor(horas).toString());
    } else {
      setUnidadeTempo("minutos");
      setPeriodoInatividade(Math.floor(minutos).toString());
    }
  }, [cofre.regrasAcesso.periodoInatividade]);

  React.useEffect(() => {
    if (!isEditing) {
      setNome(cofre.nome);
      setDescricao(cofre.descricao);
      setUsuariosAutorizados(
        cofre.regrasAcesso.usuariosAutorizados.map((p) => p.toString()),
      );
    }
  }, [isEditing, cofre]);

  function temPermissaoAcesso(usuario: Principal, c: Cofre): boolean {
    if (usuario.toString() === c.proprietario.toString()) return true;
    const autorizado = c.regrasAcesso.usuariosAutorizados.find(
      (u) => u.toString() === usuario.toString(),
    );
    if (!autorizado) return false;
    const agora = Date.now() * 1000000;
    const tempoInativo = BigInt(agora) - ultimoAcessoProprietario;
    const periodo = c.regrasAcesso.periodoInatividade * BigInt(1000000000);
    return tempoInativo >= periodo;
  }

  const formatDateTime = (timestamp: bigint) => {
    if (timestamp === BigInt(0)) return "—";
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatInactivityPeriod = (seconds: bigint) => {
    const total = Number(seconds);
    const days = total / (24 * 60 * 60);
    const hours = total / (60 * 60);
    const minutes = total / 60;
    if (days >= 1) return `${Math.floor(days)}d`;
    if (hours >= 1) return `${Math.floor(hours)}h`;
    return `${Math.floor(minutes)}min`;
  };

  const handleEdit = () => setIsEditing(true);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNome(cofre.nome);
    setDescricao(cofre.descricao);
    setUsuariosAutorizados(
      cofre.regrasAcesso.usuariosAutorizados.map((p) => p.toString()),
    );
  };

  const handleSaveEdit = async () => {
    try {
      const usuariosValidos = usuariosAutorizados
        .filter((user) => user.trim() && user !== "__empty__")
        .map((user) => Principal.fromText(user.trim()));

      let segundos: bigint;
      if (unidadeTempo === "dias") {
        segundos = BigInt(Number.parseInt(periodoInatividade) * 24 * 60 * 60);
      } else if (unidadeTempo === "horas") {
        segundos = BigInt(Number.parseInt(periodoInatividade) * 60 * 60);
      } else {
        segundos = BigInt(Number.parseInt(periodoInatividade) * 60);
      }

      await editarCofre.mutateAsync({
        id: cofre.id,
        nome: nome.trim(),
        descricao: descricao.trim(),
        regras: {
          usuariosAutorizados: usuariosValidos,
          periodoInatividade: segundos,
        },
      });

      setIsEditing(false);
    } catch (_error: unknown) {
      // Error handled in useQueries
    }
  };

  const handleDelete = () => setShowDeleteDialog(true);

  const confirmDelete = async () => {
    try {
      await excluirCofre.mutateAsync(cofre.id);
      setShowDeleteDialog(false);
    } catch (_error: unknown) {
      setShowDeleteDialog(false);
    }
  };

  const handleViewNotes = async () => {
    setIsCheckingNotes(true);
    try {
      const result = await refetchAccess();
      const freshAccess = result.data;
      if (freshAccess === false) {
        toast.error("Cofre trancado. Aguardando inatividade do proprietário.", {
          duration: 5000,
        });
        return;
      }
      setShowModal(true);
    } finally {
      setIsCheckingNotes(false);
    }
  };

  const handleRevokeUser = (principalId: string) => {
    setUserToRevoke(principalId);
    setShowRevokeDialog(true);
  };

  const confirmRevokeUser = async () => {
    try {
      await revogarAutorizacao.mutateAsync({
        idCofre: cofre.id,
        usuario: userToRevoke,
      });
      setShowRevokeDialog(false);
      setUserToRevoke("");
    } catch (_error: unknown) {
      setShowRevokeDialog(false);
    }
  };

  const adicionarUsuario = () =>
    setUsuariosAutorizados([...usuariosAutorizados, "__empty__"]);

  const removerUsuario = (index: number) =>
    setUsuariosAutorizados(usuariosAutorizados.filter((_, i) => i !== index));

  const atualizarUsuario = (index: number, valor: string) => {
    const updated = [...usuariosAutorizados];
    updated[index] = valor;
    setUsuariosAutorizados(updated);
  };

  const hasChanges = () => {
    const cur = usuariosAutorizados
      .filter((u) => u.trim() && u !== "__empty__")
      .map((u) => u.trim())
      .sort();
    const orig = cofre.regrasAcesso.usuariosAutorizados
      .map((p) => p.toString())
      .sort();

    let curSec: number;
    if (unidadeTempo === "dias")
      curSec = Number.parseInt(periodoInatividade) * 24 * 60 * 60;
    else if (unidadeTempo === "horas")
      curSec = Number.parseInt(periodoInatividade) * 60 * 60;
    else curSec = Number.parseInt(periodoInatividade) * 60;

    return (
      nome.trim() !== cofre.nome ||
      descricao.trim() !== cofre.descricao ||
      curSec !== Number(cofre.regrasAcesso.periodoInatividade) ||
      JSON.stringify(cur) !== JSON.stringify(orig)
    );
  };

  // ─── Edit Mode ───────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div
        className="glass-card card-uniform rounded-2xl p-5 animate-fade-in"
        data-ocid="cofre.edit_card"
      >
        <div className="space-y-4 flex-1 overflow-y-auto glass-scrollbar">
          {/* Nome */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-nome"
              className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Nome do Cofre
            </label>
            <Input
              id="edit-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cofre"
              required
              className="glass-input w-full text-sm"
              data-ocid="cofre.edit_nome_input"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-descricao"
              className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Descrição
            </label>
            <Textarea
              id="edit-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Descrição do cofre"
              className="glass-input w-full text-sm resize-none"
              data-ocid="cofre.edit_descricao_input"
            />
          </div>

          {/* Usuários autorizados */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Usuários Autorizados
            </p>
            <div className="space-y-2">
              {usuariosAutorizados.map((usuario, index) => (
                <div key={`user-${index}-${usuario}`} className="flex gap-2">
                  <Select
                    value={usuario === "__empty__" ? undefined : usuario}
                    onValueChange={(value) => atualizarUsuario(index, value)}
                  >
                    <SelectTrigger className="flex-1 glass-input text-sm">
                      <SelectValue placeholder="Selecione um contato" />
                    </SelectTrigger>
                    <SelectContent className="glass-modal border-border/50">
                      {contatos
                        .filter(
                          (c) =>
                            !usuariosAutorizados
                              .filter((u) => u !== "__empty__")
                              .includes(c.principalId.toString()) ||
                            c.principalId.toString() === usuario,
                        )
                        .map((c) => (
                          <SelectItem
                            key={c.principalId.toString()}
                            value={c.principalId.toString()}
                            className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                          >
                            <div className="flex justify-between items-center w-full min-w-0 gap-2">
                              <span className="font-medium truncate">
                                {c.nome}
                              </span>
                              <span className="text-xs text-muted-foreground font-technical flex-shrink-0">
                                {c.principalId.toString().slice(0, 8)}…
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {usuariosAutorizados.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerUsuario(index)}
                      className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remover usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={adicionarUsuario}
                disabled={
                  usuariosAutorizados.filter((u) => u !== "__empty__").length >=
                  contatos.length
                }
                className="flex items-center gap-1.5 text-[13px] font-medium text-primary/80 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar usuário
              </button>
            </div>
          </div>

          {/* Período de inatividade */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-periodo"
              className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Período de Inatividade
            </label>
            <div className="flex gap-2">
              <Input
                id="edit-periodo"
                type="number"
                value={periodoInatividade}
                onChange={(e) => setPeriodoInatividade(e.target.value)}
                min="1"
                className="flex-1 glass-input text-sm"
                required
                data-ocid="cofre.edit_periodo_input"
              />
              <Select
                value={unidadeTempo}
                onValueChange={(value: "minutos" | "horas" | "dias") =>
                  setUnidadeTempo(value)
                }
              >
                <SelectTrigger
                  className="w-[110px] glass-input text-sm"
                  data-ocid="cofre.edit_unidade_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-modal border-border/50">
                  <SelectItem
                    value="minutos"
                    className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                  >
                    Minutos
                  </SelectItem>
                  <SelectItem
                    value="horas"
                    className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                  >
                    Horas
                  </SelectItem>
                  <SelectItem
                    value="dias"
                    className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                  >
                    Dias
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Após este período sem acesso, usuários autorizados poderão acessar
              o cofre.
            </p>
          </div>
        </div>

        {editarCofre.isError && (
          <Alert
            className="mt-3 glass-card border-destructive/40"
            data-ocid="cofre.edit.error_state"
          >
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-foreground text-sm ml-2">
              Erro ao salvar. Verifique suas permissões e tente novamente.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-border/30">
          <Button
            variant="outline"
            onClick={handleCancelEdit}
            className="flex-1 glass-button-ghost text-sm"
            disabled={editarCofre.isPending}
            data-ocid="cofre.edit.cancel_button"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancelar
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={!hasChanges() || editarCofre.isPending || !nome.trim()}
            className="flex-1 glass-button-primary text-sm disabled:opacity-50"
            data-ocid="cofre.edit.save_button"
          >
            {editarCofre.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── View Mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`glass-card card-uniform rounded-2xl transition-all duration-300 group relative overflow-hidden ${
          isLocked
            ? "ring-1 ring-accent/30 hover:ring-accent/50 hover:shadow-[0_0_24px_oklch(72%_0.15_210/0.15)]"
            : "hover:shadow-[0_0_24px_oklch(62%_0.18_230/0.2)] hover:ring-1 hover:ring-primary/25"
        }`}
        data-ocid="cofre.card"
      >
        {/* Locked semi-transparent overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] z-10 rounded-2xl pointer-events-none" />
        )}

        {/* Locked badge — top-right corner, uses badge-locked (cyan) */}
        {isLocked && (
          <div
            className="badge-locked absolute top-3 right-3 z-20"
            data-ocid="cofre.locked_badge"
          >
            <Lock className="h-3 w-3" />
            <span>Trancado</span>
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          {/* ── TOP: icon + name + owner ─────────────────────────── */}
          <div className="flex items-start gap-3 mb-3">
            {/* Vault/Lock icon */}
            <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center glass">
              {isLocked ? (
                <Lock className="h-5 w-5 text-accent" />
              ) : (
                <Vault className="h-5 w-5 text-primary" />
              )}
            </div>

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-foreground truncate leading-tight text-base"
                title={cofre.nome}
              >
                {cofre.nome}
              </h3>

              {/* Owner row */}
              {!isOwner ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3 flex-shrink-0 text-accent" />
                  <span className="text-xs font-medium text-accent truncate">
                    {getContactName(cofre.proprietario.toString())}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="badge-unlocked text-[11px] py-0">
                    Proprietário
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-mono text-muted-foreground"
                    style={{
                      background: "oklch(var(--muted) / 0.15)",
                      border: "1px solid oklch(var(--border) / 0.4)",
                    }}
                    title="ID do Cofre"
                  >
                    <Hash className="h-2.5 w-2.5" />
                    <span>{cofre.id.toString()}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── MIDDLE: description + stats ───────────────────────── */}
          <div className="flex-1 min-h-0">
            <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed mb-3">
              {cofre.descricao || (
                <span className="italic opacity-60">Sem descrição</span>
              )}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-info" />
                <span>
                  {cofre.notas.length} nota{cofre.notas.length !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>
                  {cofre.regrasAcesso.usuariosAutorizados.length} usuário
                  {cofre.regrasAcesso.usuariosAutorizados.length !== 1
                    ? "s"
                    : ""}
                </span>
              </span>
              {cofre.regrasAcesso.periodoInatividade > BigInt(0) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  <span>
                    {formatInactivityPeriod(
                      cofre.regrasAcesso.periodoInatividade,
                    )}
                  </span>
                </span>
              )}
            </div>

            {/* Authorized users chips (owners only, max 2) */}
            {isOwner && cofre.regrasAcesso.usuariosAutorizados.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cofre.regrasAcesso.usuariosAutorizados
                  .slice(0, 2)
                  .map((usuario, index) => (
                    <div
                      key={`view-${usuario.toString()}-${index}`}
                      className="flex items-center gap-0.5"
                      data-ocid={`cofre.authorized_user.${index + 1}`}
                    >
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background: "oklch(var(--primary) / 0.12)",
                          border: "1px solid oklch(var(--primary) / 0.25)",
                          color: "oklch(var(--primary))",
                        }}
                      >
                        {getContactName(usuario.toString())}
                      </span>
                      <button
                        type="button"
                        className="h-4 w-4 p-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleRevokeUser(usuario.toString())}
                        title="Revogar autorização"
                        aria-label={`Revogar autorização de ${getContactName(usuario.toString())}`}
                        data-ocid={`cofre.revoke_button.${index + 1}`}
                      >
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                {cofre.regrasAcesso.usuariosAutorizados.length > 2 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: "oklch(var(--muted) / 0.15)",
                      border: "1px solid oklch(var(--border) / 0.3)",
                      color: "oklch(var(--muted-foreground))",
                    }}
                  >
                    +{cofre.regrasAcesso.usuariosAutorizados.length - 2} mais
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── BOTTOM: last access + actions ─────────────────────── */}
          <div className="mt-4 pt-3 border-t border-border/30">
            {/* Last access + E2E indicator */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-technical text-muted-foreground/70 text-[11px] truncate">
                {formatDateTime(ultimoAcessoProprietario)}
              </span>
              <span
                className="flex items-center gap-1 text-xs flex-shrink-0"
                style={{ color: "oklch(var(--success))" }}
                title="Criptografado com vetKeys"
              >
                <Shield className="h-3 w-3" />
                <span className="text-[11px]">E2E</span>
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {/* Notes button — shown when user has access */}
              {hasAccess && (
                <button
                  type="button"
                  onClick={handleViewNotes}
                  disabled={isCheckingNotes}
                  data-ocid="cofre.notes_button"
                  className="flex-1 glass-button-primary text-sm h-8 px-3 flex items-center justify-center gap-1.5 disabled:opacity-60 rounded-lg"
                >
                  {isCheckingNotes ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Verificando…</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      <span>Notas</span>
                    </>
                  )}
                </button>
              )}

              {/* Locked — disabled placeholder using badge-locked styling */}
              {isLocked && (
                <button
                  type="button"
                  disabled
                  className="badge-locked flex-1 h-8 text-sm px-3 flex items-center justify-center gap-1.5 opacity-80 cursor-not-allowed rounded-lg"
                  data-ocid="cofre.locked_notes_button"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Trancado</span>
                </button>
              )}

              {/* Owner-only: Edit + Delete */}
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="flex-1 glass-button-ghost h-8 text-sm px-3 flex items-center justify-center gap-1.5 rounded-lg text-primary border-primary/25 hover:bg-primary/10"
                    data-ocid="cofre.edit_button"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="glass-button-ghost h-8 text-sm px-3 flex items-center justify-center rounded-lg text-destructive border-destructive/25 hover:bg-destructive/10"
                    data-ocid="cofre.delete_button"
                    aria-label="Excluir cofre"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notes modal */}
      {showModal && hasAccess && (
        <CofreModal cofre={cofre} onClose={() => setShowModal(false)} />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          className="glass-modal border-border/50"
          data-ocid="cofre.delete.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-semibold">
              Excluir Cofre
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza de que deseja excluir o cofre "{cofre.nome}" (ID:{" "}
              <span className="font-mono text-foreground">
                {cofre.id.toString()}
              </span>
              )?{" "}
              <strong className="text-destructive">
                As {cofre.notas.length} nota
                {cofre.notas.length !== 1 ? "s" : ""} serão perdidas
                permanentemente.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="glass-button-ghost text-sm"
              data-ocid="cofre.delete.cancel_button"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="glass-button-ghost text-destructive border-destructive/30 hover:bg-destructive/15 text-sm"
              disabled={excluirCofre.isPending}
              data-ocid="cofre.delete.confirm_button"
            >
              {excluirCofre.isPending ? "Excluindo…" : "Excluir Cofre"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke authorization confirmation */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent
          className="glass-modal border-border/50"
          data-ocid="cofre.revoke.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-semibold">
              Revogar Autorização
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza de que deseja revogar a autorização de "
              {getContactName(userToRevoke)}"? O usuário perderá imediatamente o
              acesso às notas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="glass-button-ghost text-sm"
              data-ocid="cofre.revoke.cancel_button"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeUser}
              className="glass-button-ghost text-destructive border-destructive/30 hover:bg-destructive/15 text-sm"
              disabled={revogarAutorizacao.isPending}
              data-ocid="cofre.revoke.confirm_button"
            >
              {revogarAutorizacao.isPending
                ? "Revogando…"
                : "Revogar Autorização"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
