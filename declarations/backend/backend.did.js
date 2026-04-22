export const idlFactory = ({ IDL }) => {
  const UserRole = IDL.Variant({
    'admin' : IDL.Null,
    'user' : IDL.Null,
    'guest' : IDL.Null,
  });
  const RegrasAcesso = IDL.Record({
    'usuariosAutorizados' : IDL.Vec(IDL.Principal),
    'periodoInatividade' : IDL.Int,
  });
  const Time = IDL.Int;
  const Nota = IDL.Record({
    'id' : IDL.Nat,
    'titulo' : IDL.Text,
    'conteudo' : IDL.Text,
    'dataModificacao' : Time,
    'dataCriacao' : Time,
  });
  const Cofre = IDL.Record({
    'id' : IDL.Nat,
    'regrasAcesso' : RegrasAcesso,
    'descricao' : IDL.Text,
    'nome' : IDL.Text,
    'notas' : IDL.Vec(Nota),
    'proprietario' : IDL.Principal,
  });
  const UserProfile = IDL.Record({
    'name' : IDL.Text,
    'principalId' : IDL.Text,
  });
  const Contato = IDL.Record({
    'nome' : IDL.Text,
    'principalId' : IDL.Principal,
  });
  return IDL.Service({
    'adicionarContato' : IDL.Func([IDL.Principal], [], []),
    'adicionarNota' : IDL.Func([IDL.Nat, IDL.Text, IDL.Text], [IDL.Nat], []),
    'assignCallerUserRole' : IDL.Func([IDL.Principal, UserRole], [], []),
    'atualizarUltimoAcessoBackend' : IDL.Func([IDL.Principal], [], []),
    'buscarCofrePorId' : IDL.Func([IDL.Nat], [Cofre], []),
    'criarCofre' : IDL.Func([IDL.Text, IDL.Text, RegrasAcesso], [IDL.Nat], []),
    'editarCofre' : IDL.Func(
        [IDL.Nat, IDL.Text, IDL.Text, RegrasAcesso],
        [],
        [],
      ),
    'editarNota' : IDL.Func([IDL.Nat, IDL.Nat, IDL.Text, IDL.Text], [], []),
    'excluirCofre' : IDL.Func([IDL.Nat], [], []),
    'excluirNota' : IDL.Func([IDL.Nat, IDL.Nat], [], []),
    'getCallerUserProfile' : IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    'getCallerUserRole' : IDL.Func([], [UserRole], ['query']),
    'getUserProfile' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(UserProfile)],
        ['query'],
      ),
    'initializeAccessControl' : IDL.Func([], [], []),
    'isCallerAdmin' : IDL.Func([], [IDL.Bool], ['query']),
    'listarCofresUsuario' : IDL.Func([], [IDL.Vec(Cofre)], []),
    'listarContatos' : IDL.Func([], [IDL.Vec(Contato)], ['query']),
    'listarNotas' : IDL.Func([IDL.Nat], [IDL.Vec(Nota)], []),
    'obterUltimoAcesso' : IDL.Func([IDL.Principal], [Time], ['query']),
    'removerContato' : IDL.Func([IDL.Principal], [], []),
    'revogarAutorizacao' : IDL.Func([IDL.Nat, IDL.Principal], [], []),
    'saveCallerUserProfile' : IDL.Func([UserProfile], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
