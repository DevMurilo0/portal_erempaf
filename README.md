# Portal EREMPAF

Portal escolar estático em HTML, CSS e JavaScript. O frontend é publicado pela
Vercel, as funções de backend ficam na Netlify e a aplicação usa Firebase
Authentication e Cloud Firestore.

O portal oferece páginas por turma, calendário, matérias, avisos, anotações,
fotos, cardápio e notificações. As fotos são comprimidas no navegador e salvas
como Base64 no Firestore. Firebase Storage não é usado e o projeto não depende
do plano Blaze.

## Desenvolvimento local

Requisitos: Node.js 22+, npm e Python 3.

```sh
npm ci
npm run serve
```

Abra `http://localhost:8000`. Para usar os emuladores locais, acrescente
`?emulators` à URL de uma turma. Sem esse parâmetro, o frontend usa a
configuração Firebase normal do site; não use dados ou credenciais de produção
em testes.

## Testes

```sh
npm test
```

O teste de navegador exige Chromium do Playwright, servidor HTTP local e os
emuladores de Auth e Firestore em execução.

```sh
npx playwright install chromium
npx -y firebase-tools@15.29.0 emulators:start --project demo-erempaf --only auth,firestore
npm run test:browser
```

As Firestore Security Rules não fazem parte deste repositório público. Para
testá-las localmente, mantenha a versão privada em
`.firebase-local/firestore.rules` e execute:

```sh
npm run test:rules
```

O arquivo `firebase.json` aponta somente para essa cópia local ignorada e para
os emuladores de Auth e Firestore. Se for necessário usar o Firebase CLI fora
dos emuladores, informe o projeto explicitamente no comando.

## Estrutura

- `index.html`, `style.css` e `script.js`: página inicial.
- `series/`: páginas das turmas, calendário e notificações.
- `shared/`: Firebase, conteúdo, fotos Base64 e acessibilidade.
- `cardapio/`: interface atual do cardápio, integrada ao backend Netlify.
- `config/turmas.js`: cadastro das turmas e rotas.
- `tests/`: testes unitários, de navegador e de Rules locais.

Arquivos de ambiente, credenciais administrativas, Security Rules e artefatos
gerados ficam fora do controle de versão.
