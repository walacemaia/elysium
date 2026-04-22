import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Cofre {
  'id' : bigint,
  'regrasAcesso' : RegrasAcesso,
  'descricao' : string,
  'nome' : string,
  'notas' : Array<Nota>,
  'proprietario' : Principal,
}
export interface Contato { 'nome' : string, 'principalId' : Principal }
export interface Nota {
  'id' : bigint,
  'titulo' : string,
  'conteudo' : string,
  'dataModificacao' : Time,
  'dataCriacao' : Time,
}
export interface RegrasAcesso {
  'usuariosAutorizados' : Array<Principal>,
  'periodoInatividade' : bigint,
}
export type Time = bigint;
export interface UserProfile { 'name' : string, 'principalId' : string }
export type UserRole = { 'admin' : null } |
  { 'user' : null } |
  { 'guest' : null };
export interface _SERVICE {
  'adicionarContato' : ActorMethod<[Principal], undefined>,
  'adicionarNota' : ActorMethod<[bigint, string, string], bigint>,
  'assignCallerUserRole' : ActorMethod<[Principal, UserRole], undefined>,
  'atualizarUltimoAcessoBackend' : ActorMethod<[Principal], undefined>,
  'buscarCofrePorId' : ActorMethod<[bigint], Cofre>,
  'criarCofre' : ActorMethod<[string, string, RegrasAcesso], bigint>,
  'editarCofre' : ActorMethod<
    [bigint, string, string, RegrasAcesso],
    undefined
  >,
  'editarNota' : ActorMethod<[bigint, bigint, string, string], undefined>,
  'excluirCofre' : ActorMethod<[bigint], undefined>,
  'excluirNota' : ActorMethod<[bigint, bigint], undefined>,
  'getCallerUserProfile' : ActorMethod<[], [] | [UserProfile]>,
  'getCallerUserRole' : ActorMethod<[], UserRole>,
  'getUserProfile' : ActorMethod<[Principal], [] | [UserProfile]>,
  'initializeAccessControl' : ActorMethod<[], undefined>,
  'isCallerAdmin' : ActorMethod<[], boolean>,
  'listarCofresUsuario' : ActorMethod<[], Array<Cofre>>,
  'listarContatos' : ActorMethod<[], Array<Contato>>,
  'listarNotas' : ActorMethod<[bigint], Array<Nota>>,
  'obterUltimoAcesso' : ActorMethod<[Principal], Time>,
  'removerContato' : ActorMethod<[Principal], undefined>,
  'revogarAutorizacao' : ActorMethod<[bigint, Principal], undefined>,
  'saveCallerUserProfile' : ActorMethod<[UserProfile], undefined>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
