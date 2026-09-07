# Plano de produção — sem Blaze / sem cobrança

Nenhuma etapa abaixo foi executada em produção. As Rules novas são um protótipo
validável, com negação por padrão, autorização por claims e validação de dados.

## Decisões já confirmadas pelo proprietário

1. Contas das turmas A–E continuam sendo as contas editoras das próprias turmas.
2. 1º F e 3º F não existem atualmente: não criar conta e não conceder edição.
3. `turma@erempaf.com` permanece sem permissão ampla.
4. Cardápio: leitura pública; edição apenas por senha no backend Netlify via `CARDAPIO_PASSWORD`; sem conta Firebase e sem `cardapioEditor`.
5. **Não habilitar Blaze, não vincular Billing e não provisionar Firebase Storage. O proprietário não pode assumir qualquer risco de cobrança.**
6. O backend Netlify existe em repositório separado e contém a Function de cardápio/notifications; validar localmente antes de deploy.
7. Confirmar o domínio público definitivo apenas quando necessário para canonical/sitemap/OG.

## Alterações exatas propostas

- Authentication/Calendário: as contas A–E podem editar a própria turma pelo email autenticado; `editorTurmas` continua aceito como compatibilidade administrativa. Não conceder edição a 1º F, 3º F ou à conta genérica.
- Cardápio: o cliente apenas lê Firestore. Edição usa a Function Netlify com `CARDAPIO_PASSWORD` e Firebase Admin SDK; Rules bloqueiam toda escrita direta do navegador.
- Firestore Rules: aplicar somente após os testes finais; fechar escrita pública do cardápio, fechar `/config`, validar calendário e negar rotas desconhecidas.
- Storage: **não provisionar, não publicar `storage.rules` e não habilitar Blaze**.
- Fotos: comportamento original restaurado; novas fotos são comprimidas no navegador e salvas em Base64 no Firestore. Não usar Storage.
- Nenhuma migração/exclusão de dados existentes.

## Sequência e risco de indisponibilidade

Revalidar regras implantadas imediatamente antes do deploy; comparar com
`firestore.production-before.rules`. Se mudaram, reavaliar, não sobrescrever cegamente.
Validar o backend do cardápio e notificações. Confirmar que as contas A–E autenticadas
conseguem editar apenas a própria turma. Publicar frontend/backend e Firestore Rules em
janela curta coordenada, sem qualquer operação de Billing ou Storage.

Manter abas antigas abertas durante a transição pode produzir `permission-denied`;
solicitar recarregamento e monitorar. Nenhuma etapa desta documentação autoriza Blaze.

## Validação depois de autorização

- Login/leitura com leitor; negar gravação direta via SDK/REST desse leitor.
- Editor de A edita A, não B; editor do cardápio edita cardápio, não calendário.
- Cardápio abre sem login. Senhas/config não são retornadas pelo SDK.
- Foto legada abre; nova foto Base64 autorizada é salva e removida corretamente no Firestore.
- Backend push aceita credencial válida e rejeita token ausente/inválido/turma não permitida.
- Acompanhar erros e gastos. Não usar dados de alunos como fixture destrutiva.

## Rollback

Guardar versão do frontend pré-publicação e claims pré-alteração em local restrito.
O snapshot `firestore.production-before.rules` permite restaurar o comportamento anterior,
mas **reabre as vulnerabilidades**; só fazê-lo como decisão explícita de emergência.
Preferir corrigir a permissão específica ou voltar frontend em janela coordenada.
Remover claims indevidas e renovar/revogar sessões conforme plano aprovado.
Não desfazer faturamento/região de bucket ou excluir dados como rollback automático.
