# Portal EREMPAF

Portal escolar em HTML, CSS e JavaScript: acesso às turmas, calendário mensal,
matérias, avisos, anotações, fotos com galeria/lightbox, cardápio e notificações push.
Os temas individuais das turmas são preservados. Não há etapa de limpeza estética.

## Executar

```sh
npm ci
npm run serve
```

Abra http://localhost:8000. **Sem `?emulators`, o portal aponta ao Firebase real.**
Não use credenciais de produção para testes de gravação.

## Testar sem produção

Requisitos: Node 22+, Python 3 e Java 21+. A Firebase CLI é executada de forma
portátil por `npx` no teste de Rules (CLI 15.29.0 apenas verificada nesta máquina;
os emuladores ainda dependem de Java, que precisa estar instalado separadamente).

```sh
npm test
npm run test:rules
npx -y firebase-tools@latest emulators:start --project demo-erempaf --only auth,firestore,storage
npx playwright install chromium
npm run test:browser
```

Mantenha `npm run serve` ativo para o teste de navegador. Use
`http://localhost:8000/series/1ano/a/index.html?emulators` para exploração manual.
O parâmetro só funciona em localhost/127.0.0.1, usa `demo-erempaf` e desativa push real.
O teste de navegador cria contas/dados fictícios somente nos emuladores; nunca em produção.
`npm run test:rules` inicia/encerra Firestore e Storage automaticamente. O teste de
navegador requer Auth, Firestore e Storage já ativos, além do servidor HTTP. Nesta
revisão, os testes integrados ainda não foram validados porque Java não estava disponível.

## Organização

- `config/turmas.js`: cadastro único de 17 turmas e rotas; home e calendário usam o cadastro.
- `series/*ano/*/index.html`: estrutura/tema de cada turma, sem inicializações Firebase duplicadas.
- `series/calendario.js` e `.css`: calendário, painel, matérias, salvamento e agenda mobile.
- `shared/firebase.js`: app/serviços, sessão única, login persistente e permissões.
- `shared/content.js`: saída segura de texto, fotos legadas/novas, comparação de dados.
- `shared/photos.js`: validação, compressão, upload e exclusão.
- `shared/accessibility.js`: foco, teclado e semântica dos modais.
- `cardapio/semana.js`: cardápio atual; `cardapio/cardapio.js`: formato semanal legado.
- `series/notificacoes.js` e `firebase-messaging-sw.js`: inscrição FCM e entrega push.
- `firestore.rules`, `storage.rules`, `firebase.json`: proposta testável, não publicada.
- `docs/`: auditoria, plano de produção e snapshot das regras anteriores.

A entrada usada pelos links atuais é `/cardapio/index.html`. As rotas antigas
`/cardapio/cardapio.html` e `/assets/cardapio/*` continuam acessíveis por compatibilidade,
mas seus scripts delegam aos mesmos módulos autorizados em `/cardapio/`; não mantêm cópia
da antiga verificação de senha do Firestore. Não remover essas rotas antes de verificar
analytics, favoritos e URLs externas.

Para adicionar turma: criar a página preservando o tema desejado, cadastrar em
`config/turmas.js` e executar testes. A lista permitida nas Rules de inscrições é gerada
por `node tests/sync-turmas.mjs`; alterações de Rules exigem revisão e testes.

## Firebase e autorização

Projeto `portal-erempaf` (124907592592), banco `(default)`, Standard, `southamerica-east1`.

Por segurança, `.firebaserc` não define o Firebase de produção como alias `default`. O alias configurado é `production`. Qualquer comando que altere produção deve ser explícito, por exemplo `firebase deploy --project portal-erempaf` ou após seleção consciente de `firebase use production`.

A configuração Web é pública; **não é credencial administrativa**.
Não existe senha administrativa no código novo nem comparação com senhas do Firestore.

A edição das turmas A–E aceita a conta fixa da própria turma (por exemplo,
`1anoa@erempaf.com` em `1ano-a`). Claims `editorTurmas` continuam compatíveis para
perfis administrativos, mas não são necessárias para as contas A–E já existentes.
As turmas 1º F e 3º F permanecem sem conta/editor enquanto não existirem na escola.
A conta genérica `turma@erempaf.com` não recebe permissão ampla.

O cardápio não usa Firebase Auth nem `cardapioEditor`: a leitura é pública e a edição
é autorizada por uma senha enviada ao backend Netlify, armazenada somente na variável
`CARDAPIO_PASSWORD`; o navegador não escreve diretamente em `/cardapio`.
As Rules são a autoridade real; alterar variáveis ou localStorage não concede acesso.
A validação incremental aceita, por gravação, mudanças em até 10 dias de anotações,
5 dias de matérias e 3 dias com fotos; o documento continua limitado a 23 dias úteis.
Esses limites mantêm a avaliação abaixo do teto do Firestore e pedem salvamentos em
lotes menores quando uma edição mensal for excepcionalmente grande.
A leitura dos calendários continua autenticada, como nas regras anteriores;
a leitura do cardápio continua pública. Os documentos com senhas antigas ficam inacessíveis
a clientes, sem exclusão de dados.

## Fotos

As fotos do quadro voltaram ao comportamento original: são comprimidas no navegador e
salvas em Base64 diretamente no documento mensal do Firestore. Não há upload para
Firebase Storage, não é necessário Blaze e nenhuma foto existente precisa ser migrada.

O fluxo usa JPEG com largura/altura máxima de 900 px e qualidade 0.72, mantendo o formato
legado `{img, desc}` e também a leitura de strings Base64 antigas. O limite visual continua
em 6 fotos por dia; o Firestore continua sujeito ao limite de tamanho do documento, como
no sistema original.

`storage.rules` permanece apenas como arquivo legado local e não está ligado ao `firebase.json`;
não deve ser publicado nem provisionado Storage.

## Notificações

Inicialização idempotente; inscrição só após ação do usuário. Documentos mantêm o
identificador do aparelho e ganham `ownerUid`. Inscrições antigas podem ser vinculadas
na atualização somente quando o dispositivo apresentar o token que já consta no banco.
Rotação de token legado ou troca de conta proprietária pode exigir reconciliação administrativa.

O backend está em outro repositório, `erempafbackend.netlify.app`.
O frontend envia Bearer ID token, verifica HTTP e timeout; backend deve validar token e
claim da turma, além de permitir o header Authorization no CORS. Isso não pode ser
comprovado ou corrigido neste repositório. Não publicar sem teste integrado desse contrato.
Falha de push gera aviso separado e nunca transforma commit confirmado em falha de gravação.

## Sessão persistente

Ao entrar em uma página de turma sem sessão, o login é solicitado automaticamente e não
pode ser dispensado pelo modal. A sessão usa `browserLocalPersistence`, então depois de
um login válido ela é reaproveitada nas demais páginas e em novas visitas no mesmo
navegador. Não há botão visível “Entrar/Sair” no topo das turmas. A edição só é habilitada
quando a conta atual possui permissão para aquela turma.

## SEO e endereço público

Metadados descritivos locais estão presentes. `canonical`, sitemap e imagem social
absoluta aguardam a confirmação do domínio público definitivo. Não apontar esses campos
para GitHub/raw ou para um domínio presumido. `robots.txt` não é necessário para permitir
indexação, mas poderá referenciar o sitemap quando a URL pública for conhecida.

## HTML dinâmico e XSS

Os `innerHTML` restantes foram revisados: alguns montam somente ícones/markup constante;
os calendários e cardápios escapam texto persistido; fotos passam por `photoSource` e têm
descrições escapadas. Toasts inserem mensagens por `textContent`. Novos pontos que incluam
dados externos em templates devem usar `escapeHtml` ou criação explícita de nós.

## Deploy

**Não executar deploy genérico.** Esta etapa local não publica frontend, Rules, Auth ou Storage.
`firebase.json` intencionalmente não configura Hosting/Auth nem deploy de índices.
A lista de índices compostos consultada estava vazia; `firestore.indexes.json` registra
esse resultado, sem propor remoção de índices/configurações de campos.
Consulte `docs/PRODUCAO.md` antes de qualquer operação sensível.
