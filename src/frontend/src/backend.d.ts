import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface RegrasAcesso {
    usuariosAutorizados: Array<Principal>;
    periodoInatividade: bigint;
}
export type Time = bigint;
export interface Nota {
    id: bigint;
    titulo: string;
    conteudo: string;
    dataModificacao: Time;
    dataCriacao: Time;
}
export interface UserProfileEntry {
    nome: string;
    role: UserRole;
    principalId: Principal;
}
export interface Contato {
    nome: string;
    principalId: Principal;
}
export interface UserProfile {
    name: string;
    principalId: string;
}
export interface Cofre {
    id: bigint;
    regrasAcesso: RegrasAcesso;
    descricao: string;
    nome: string;
    notas: Array<Nota>;
    proprietario: Principal;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    adicionarContato(principalId: Principal): Promise<void>;
    adicionarNota(idCofre: bigint, titulo: string, conteudo: string): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    atualizarUltimoAcessoBackend(): Promise<void>;
    buscarCofrePorId(idCofre: bigint): Promise<Cofre>;
    criarCofre(nome: string, descricao: string, regras: RegrasAcesso): Promise<bigint>;
    editarCofre(idCofre: bigint, nome: string, descricao: string, regras: RegrasAcesso): Promise<void>;
    editarNota(idCofre: bigint, idNota: bigint, novoTitulo: string, novoConteudo: string): Promise<void>;
    excluirCofre(idCofre: bigint): Promise<void>;
    excluirNota(idCofre: bigint, idNota: bigint): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    listarCofresUsuario(): Promise<Array<Cofre>>;
    listarContatos(): Promise<Array<Contato>>;
    listarNotas(idCofre: bigint): Promise<Array<Nota>>;
    /**
     * / Lista todos os perfis registrados (somente administradores)
     */
    listarTodosProfiles(): Promise<Array<UserProfileEntry>>;
    obterUltimoAcesso(usuario: Principal): Promise<Time>;
    /**
     * / Promove um usuário a administrador (somente administradores podem fazer isso)
     */
    promoverParaAdmin(user: Principal): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    removerContato(principalId: Principal): Promise<void>;
    /**
     * / Revoga o status de administrador de um usuário (somente administradores podem fazer isso)
     * / O primeiro administrador do sistema não pode ter seu status revogado
     */
    revogarAdmin(user: Principal): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    revogarAutorizacao(idCofre: bigint, usuario: Principal): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    /**
     * / Verifica se o caller tem acesso ao cofre (para polling de status de bloqueio).
     * / Retorna true = cofre acessível (desbloqueado), false = cofre trancado.
     * / NÃO atualiza o último acesso — seguro para polling frequente.
     */
    verificarAcessoCofre(idCofre: bigint): Promise<boolean>;
    /**
     * / Returns the encrypted derived key for the caller (auth required)
     */
    vetkd_encrypted_key(transportPublicKey: Uint8Array, cofreId: bigint): Promise<Uint8Array>;
    /**
     * / Returns the canister base public key (empty context), used to verify vetKeys
     * / derived with context=[] and input=cofreIdToBytes(cofreId) in vetkd_encrypted_key.
     * / Access controlled — only cofre owner or authorized users (with inactivity met) may call this.
     */
    vetkd_public_key(idCofre: bigint): Promise<Uint8Array>;
}
