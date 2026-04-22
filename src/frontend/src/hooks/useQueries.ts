import { Principal } from "@dfinity/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Cofre,
  Contato,
  Nota,
  RegrasAcesso,
  UserProfile,
  UserProfileEntry,
} from "../backend.d";
import { useCrypto } from "../crypto/CryptoContext";
import {
  clearVetKeyForCofre,
  decryptNoteWithStatus,
  encryptNote,
} from "../crypto/vetkeys";
import { useActor } from "./useActor";

// Actor type extended with vetKD endpoints (added in backend update)
type VetKeysActor = {
  vetkd_public_key: (id: bigint) => Promise<Uint8Array | number[]>;
  vetkd_encrypted_key: (
    tpk: Uint8Array | number[],
    id: bigint,
  ) => Promise<Uint8Array | number[]>;
};

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      const profile = await actor.getCallerUserProfile();
      return profile;
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      await actor.saveCallerUserProfile(profile);
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      queryClient.invalidateQueries({ queryKey: ["contatos"] });
    },
  });
}

// Contact Queries
export function useListarContatos() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Contato[]>({
    queryKey: ["contatos"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listarContatos();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useAdicionarContato() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (principalId: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.adicionarContato(Principal.fromText(principalId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contatos"] });
    },
  });
}

export function useRemoverContato() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (principalId: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.removerContato(Principal.fromText(principalId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contatos"] });
    },
  });
}

export function useValidarUsuarioExiste() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (principalId: string) => {
      if (!actor) throw new Error("Actor not available");

      try {
        const profile = await actor.getUserProfile(
          Principal.fromText(principalId),
        );
        return profile !== null;
      } catch (_error) {
        return false;
      }
    },
  });
}

// Cofre Queries
export function useListarCofres() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Cofre[]>({
    queryKey: ["cofres"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listarCofresUsuario();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useBuscarCofrePorId() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (idCofre: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.buscarCofrePorId(idCofre);
    },
  });
}

export function useCriarCofre() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nome,
      descricao,
      regras,
    }: { nome: string; descricao: string; regras: RegrasAcesso }) => {
      if (!actor) throw new Error("Actor not available");
      return await actor.criarCofre(nome, descricao, regras);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
    },
  });
}

export function useEditarCofre() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      nome,
      descricao,
      regras,
    }: {
      id: bigint;
      nome: string;
      descricao: string;
      regras: RegrasAcesso;
    }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.editarCofre(id, nome, descricao, regras);
    },
    onSuccess: (_, variables) => {
      // Invalidate cached vetKey — authorization rules may have changed
      clearVetKeyForCofre(variables.id);
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Cofre atualizado com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao editar cofre. Tente novamente.";
      let shouldRefresh = false;

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage =
            "Cofre não encontrado. Este cofre pode ter sido excluído. A lista de cofres será recarregada.";
          shouldRefresh = true;
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para editar este cofre. Apenas o proprietário pode fazer alterações.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para editar este cofre.";
        } else if (err.message.includes("Actor not available")) {
          errorMessage =
            "Conexão com o backend perdida. Tente fazer login novamente.";
        } else {
          errorMessage = `Erro ao editar cofre: ${err.message}`;
        }
      }

      toast.error(errorMessage, {
        duration: 6000,
        action: shouldRefresh
          ? {
              label: "Recarregar",
              onClick: () => {
                queryClient.invalidateQueries({ queryKey: ["cofres"] });
              },
            }
          : undefined,
      });

      if (shouldRefresh) {
        queryClient.invalidateQueries({ queryKey: ["cofres"] });
      }

      throw error;
    },
  });
}

export function useExcluirCofre() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.excluirCofre(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Cofre excluído com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao excluir cofre. Tente novamente.";
      let shouldRefresh = false;

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage = "Cofre não encontrado. A lista será atualizada.";
          shouldRefresh = true;
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para excluir este cofre. Apenas o proprietário pode excluí-lo.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para excluir este cofre.";
        } else {
          errorMessage = `Erro ao excluir cofre: ${err.message}`;
        }
      }

      toast.error(errorMessage);

      if (shouldRefresh) {
        queryClient.invalidateQueries({ queryKey: ["cofres"] });
      }

      throw error;
    },
  });
}

export function useRevogarAutorizacao() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      idCofre,
      usuario,
    }: { idCofre: bigint; usuario: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.revogarAutorizacao(idCofre, Principal.fromText(usuario));
    },
    onSuccess: (_, variables) => {
      // Invalidate cached vetKey — the revoked user's key must not be reused
      clearVetKeyForCofre(variables.idCofre);
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Autorização revogada com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao revogar autorização. Tente novamente.";
      let shouldRefresh = false;

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage = "Cofre não encontrado. A lista será atualizada.";
          shouldRefresh = true;
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para revogar autorizações. Apenas o proprietário pode fazer isso.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para revogar autorizações neste cofre.";
        } else {
          errorMessage = `Erro ao revogar autorização: ${err.message}`;
        }
      }

      toast.error(errorMessage);

      if (shouldRefresh) {
        queryClient.invalidateQueries({ queryKey: ["cofres"] });
      }

      throw error;
    },
  });
}

export function useObterUltimoAcesso(usuario: Principal | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["ultimoAcesso", usuario?.toString()],
    queryFn: async () => {
      if (!actor || !usuario) return BigInt(0);
      return actor.obterUltimoAcesso(usuario);
    },
    enabled: !!actor && !actorFetching && !!usuario,
  });
}

export function useAtualizarUltimoAcesso() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.atualizarUltimoAcessoBackend();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ultimoAcesso"] });
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
    },
  });
}

// Nota Queries — with vetKeys encryption/decryption

// Frontend-only extension: adds isEncrypted flag determined during decryption
export type DecryptedNota = Nota & { isEncrypted: boolean };

export function useListarNotas(idCofre: bigint) {
  const { actor, isFetching: actorFetching } = useActor();
  const { transportKey } = useCrypto();

  return useQuery<DecryptedNota[]>({
    queryKey: ["notas", idCofre.toString()],
    queryFn: async () => {
      if (!actor) return [];

      const notas = await actor.listarNotas(idCofre);

      // If transport key not yet ready, return notes as-is (graceful fallback — all marked unencrypted)
      if (!transportKey) {
        return notas.map((nota) => ({ ...nota, isEncrypted: false }));
      }

      // Decrypt all notes in parallel; isEncrypted is set based on decryption outcome
      const decryptedNotas = await Promise.all(
        notas.map(async (nota) => {
          try {
            const { titulo, conteudo, isEncrypted } =
              await decryptNoteWithStatus(
                idCofre,
                nota.titulo,
                nota.conteudo,
                actor as unknown as VetKeysActor,
                transportKey,
              );
            return { ...nota, titulo, conteudo, isEncrypted };
          } catch (err) {
            console.warn(
              "[vetkeys] Failed to decrypt nota",
              nota.id.toString(),
              err,
            );
            return { ...nota, isEncrypted: false };
          }
        }),
      );

      return decryptedNotas;
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useAdicionarNota() {
  const { actor } = useActor();
  const { transportKey } = useCrypto();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      idCofre,
      titulo,
      conteudo,
    }: { idCofre: bigint; titulo: string; conteudo: string }) => {
      if (!actor) throw new Error("Actor not available");

      // transportKey must be available — if not, block the save rather than storing plaintext
      if (!transportKey) {
        throw new Error(
          "[vetkeys] Chave de transporte não disponível. Aguarde a inicialização e tente novamente.",
        );
      }

      // Encryption errors propagate as mutation errors — note is NOT saved on failure
      const { tituloEnc, conteudoEnc } = await encryptNote(
        idCofre,
        titulo,
        conteudo,
        actor as unknown as VetKeysActor,
        transportKey,
      );

      return actor.adicionarNota(idCofre, tituloEnc, conteudoEnc);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["notas", variables.idCofre.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Nota adicionada com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao adicionar nota. Tente novamente.";

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage = "Cofre não encontrado. A lista será atualizada.";
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para adicionar notas. Apenas o proprietário pode fazer isso.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para adicionar notas neste cofre.";
        } else if (
          err.message.includes("[vetkeys]") ||
          err.message.includes("Encryption failed") ||
          err.message.includes("Chave de transporte")
        ) {
          errorMessage =
            "Falha na criptografia — a nota não foi salva. Verifique sua conexão e tente novamente.";
        } else {
          errorMessage = `Erro ao adicionar nota: ${err.message}`;
        }
      }

      toast.error(errorMessage);
      throw error;
    },
  });
}

export function useEditarNota() {
  const { actor } = useActor();
  const { transportKey } = useCrypto();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      idCofre,
      idNota,
      titulo,
      conteudo,
    }: {
      idCofre: bigint;
      idNota: bigint;
      titulo: string;
      conteudo: string;
    }) => {
      if (!actor) throw new Error("Actor not available");

      // transportKey must be available — if not, block the save rather than storing plaintext
      if (!transportKey) {
        throw new Error(
          "[vetkeys] Chave de transporte não disponível. Aguarde a inicialização e tente novamente.",
        );
      }

      // Encryption errors propagate as mutation errors — note is NOT saved on failure
      const { tituloEnc, conteudoEnc } = await encryptNote(
        idCofre,
        titulo,
        conteudo,
        actor as unknown as VetKeysActor,
        transportKey,
      );

      return actor.editarNota(idCofre, idNota, tituloEnc, conteudoEnc);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["notas", variables.idCofre.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Nota atualizada com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao editar nota. Tente novamente.";

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage = "Cofre não encontrado. A lista será atualizada.";
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para editar notas. Apenas o proprietário pode fazer isso.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para editar notas neste cofre.";
        } else if (
          err.message.includes("[vetkeys]") ||
          err.message.includes("Encryption failed") ||
          err.message.includes("Chave de transporte")
        ) {
          errorMessage =
            "Falha na criptografia — a nota não foi salva. Verifique sua conexão e tente novamente.";
        } else {
          errorMessage = `Erro ao editar nota: ${err.message}`;
        }
      }

      toast.error(errorMessage);
      throw error;
    },
  });
}

// Cofre lock status polling
export function useVerificarAcessoCofre(idCofre: bigint, enabled: boolean) {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<boolean>({
    queryKey: ["acessoCofre", idCofre.toString()],
    queryFn: async () => {
      if (!actor) return true;
      return actor.verificarAcessoCofre(idCofre);
    },
    enabled: !!actor && !actorFetching && enabled,
    refetchInterval: 10000,
    staleTime: 0,
  });

  return {
    hasAccess: query.data,
    isLoading: actorFetching || query.isLoading,
    refetch: query.refetch,
  };
}

// Admin Queries
export function useListarTodosProfiles() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<UserProfileEntry[]>({
    queryKey: ["todosProfiles"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listarTodosProfiles();
      return result.filter((entry): entry is UserProfileEntry => entry != null);
    },
    enabled: !!actor && !actorFetching,
  });
}

export function usePromoverParaAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!actor) throw new Error("Actor not available");
      return actor.promoverParaAdmin(user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todosProfiles"] });
      toast.success("Usuário promovido a Administrador com sucesso");
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Erro ao promover usuário. Tente novamente.";
      toast.error(msg);
      throw error;
    },
  });
}

export function useRevogarAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!actor) throw new Error("Actor not available");
      return actor.revogarAdmin(user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todosProfiles"] });
      toast.success("Privilégios de administrador revogados com sucesso");
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Erro ao revogar administrador. Tente novamente.";
      toast.error(msg);
      throw error;
    },
  });
}

export function useExcluirNota() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      idCofre,
      idNota,
    }: { idCofre: bigint; idNota: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.excluirNota(idCofre, idNota);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["notas", variables.idCofre.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["cofres"] });
      toast.success("Nota excluída com sucesso!");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      let errorMessage = "Erro ao excluir nota. Tente novamente.";

      if (err?.message) {
        if (err.message.includes("Cofre não encontrado")) {
          errorMessage = "Cofre não encontrado. A lista será atualizada.";
        } else if (err.message.includes("Apenas o proprietário")) {
          errorMessage =
            "Você não tem permissão para excluir notas. Apenas o proprietário pode fazer isso.";
        } else if (err.message.includes("Acesso negado")) {
          errorMessage =
            "Acesso negado. Você não tem permissão para excluir notas neste cofre.";
        } else {
          errorMessage = `Erro ao excluir nota: ${err.message}`;
        }
      }

      toast.error(errorMessage);
      throw error;
    },
  });
}
