# Portal EREMPAF

Portal institucional e escolar da **EREM Professor Antônio Farias (EREMPAF)**, em Gravatá — PE.

O projeto reúne a apresentação institucional da escola e um portal por turma para apoiar a rotina dos estudantes com calendário, avisos, links importantes, anotações, matérias, fotos, notificações e histórico de alterações.

## Produção

- **Frontend:** Vercel
- **URL atual:** https://portalerempaf.vercel.app/
- **Backend:** Netlify Functions
- **Backend atual:** https://erempafbackend.netlify.app/
- **Banco e autenticação:** Firebase
- **Repositório do backend:** https://github.com/DevMurilo0/erempaf-backend

A aplicação continua propositalmente simples: **HTML, CSS e JavaScript nativo**, sem React, Vite ou framework de frontend.

## Arquitetura

Fluxo principal:

```text
Navegador
   │
   ├── Vercel
   │     └── HTML / CSS / JavaScript
   │
   ├── Firebase Authentication
   │     └── login das turmas
   │
   ├── Cloud Firestore
   │     ├── calendário
   │     ├── cardápio
   │     ├── inscrições de notificações
   │     └── dados das salas
   │
   ├── Firebase Cloud Messaging
   │     └── notificações push
   │
   └── Netlify Functions
         ├── calendário e edição
         ├── histórico de alterações
         ├── cardápio
         └── envio imediato de notificações
```

O frontend não recebe credenciais administrativas do Firebase. Operações sensíveis passam pelo backend usando Firebase Admin.

## Funcionalidades

### Página institucional

A Home apresenta a EREMPAF e concentra acessos para:

- Portal das turmas
- Cardápio
- Notas / SIEPE
- Sobre
- Contato
- localização da escola

As páginas institucionais compartilham a mesma identidade visual.

### Portal das turmas

Cada turma possui sua própria página e identidade de cor.

Recursos atuais:

- calendário mensal
- visualização adaptada para desktop e celular
- matérias por dia
- anotações
- fotos
- avisos importantes
- links importantes
- notificações push
- histórico de alterações
- modo de edição protegido

O cadastro central das turmas fica em:

```text
config/turmas.js
```

O arquivo atualmente mantém as rotas das turmas A–F conforme a estrutura histórica do projeto. A existência de uma rota no código não significa necessariamente que a turma esteja ativa naquele ano letivo.

### Edição das turmas

Existem duas etapas separadas:

1. **Login da turma** com Firebase Authentication.
2. **Senha de edição da sala** antes de liberar alterações.

A senha de edição não deve ser colocada em HTML, JavaScript público ou documentação pública.

O salvamento do calendário passa pela função:

```text
netlify/functions/calendario.js
```

no repositório do backend.

### Histórico de alterações

As alterações relevantes são registradas pelo backend em uma subcoleção do Firestore:

```text
salas/{turma}/historico/{registro}
```

O histórico pode registrar alterações em:

- avisos
- links importantes
- anotações
- matérias
- fotos

O registro usa timestamp do servidor e não deve armazenar senha, token ou conteúdo Base64 das fotos.

### Links importantes

A área **Importantes** possui as abas:

```text
Avisos | Links
```

Os links úteis da turma são armazenados em `linksImportantes` no documento do mês.

### Fotos

As fotos:

1. são selecionadas no navegador;
2. são comprimidas antes do envio;
3. são convertidas para Base64;
4. são armazenadas no Firestore.

**Firebase Storage não é utilizado.**

O projeto não depende do plano Blaze para esse recurso.

### Cardápio

O cardápio é público para leitura.

A edição é protegida por uma senha tratada no backend. O frontend envia a tentativa de senha para a Netlify Function, que valida antes de gravar no Firestore.

### Notificações

O portal utiliza:

- Firebase Cloud Messaging
- `firebase-messaging-sw.js`
- registros de dispositivos no Firestore
- função Netlify para disparo imediato

As notificações dependem da permissão concedida pelo navegador/dispositivo.

## Plataformas e serviços externos

O projeto atualmente possui integração ou dependência com:

| Serviço | Uso |
| --- | --- |
| GitHub | código-fonte e histórico |
| Vercel | hospedagem do frontend |
| Netlify | hospedagem das funções de backend |
| Firebase Authentication | login das turmas |
| Cloud Firestore | dados do portal |
| Firebase Cloud Messaging | notificações push |
| Google Maps | mapa e localização institucional |
| Google Fonts | fontes usadas na interface |
| SIEPE | link externo para notas |
| ENEM Planner | link externo disponível nas páginas das turmas |

O **Google Search Console não é configurado pelo código atual deste repositório**. Caso seja adotado oficialmente, o acesso e a propriedade devem ser documentados separadamente.

## Estrutura principal

```text
.
├── index.html
├── style.css
├── script.js
├── logo.png
├── config/
│   └── turmas.js
├── series/
│   ├── calendario.js
│   ├── calendario.css
│   ├── notificacoes.js
│   ├── historico.js
│   ├── 1ano/
│   ├── 2ano/
│   └── 3ano/
├── shared/
│   ├── firebase.js
│   ├── content.js
│   ├── photos.js
│   └── accessibility.js
├── cardapio/
├── contato/
├── sobre/
└── firebase-messaging-sw.js
```

## Segurança e credenciais

**Nunca colocar no repositório público:**

- senhas das turmas
- senha do cardápio
- arquivo de Service Account
- variáveis de ambiente
- tokens
- chaves privadas
- documentos internos com credenciais
- dados pessoais desnecessários

A configuração Web do Firebase presente no frontend identifica o projeto cliente e não substitui as regras de segurança ou as credenciais administrativas.

As credenciais administrativas e segredos do backend devem existir apenas no ambiente privado de hospedagem.

## Documentação operacional privada

Para continuidade do projeto dentro da escola, recomenda-se manter fora deste repositório público uma pasta privada com:

1. **Acessos e responsáveis**
   - contas das plataformas
   - responsáveis autorizados
   - processo de recuperação de acesso

2. **Turmas**
   - turma
   - e-mail de login
   - senha de login
   - senha de edição
   - responsável por receber ou atualizar a credencial

3. **Infraestrutura**
   - GitHub
   - Vercel
   - Netlify
   - Firebase
   - domínio, caso exista
   - Search Console, caso seja configurado

4. **Procedimento de operação**
   - publicar nova versão
   - editar uma turma
   - alterar cardápio
   - trocar senha
   - criar/remover conta de turma
   - recuperar acesso
   - conferir notificações
   - consultar histórico

5. **Plano de continuidade**
   - quem assume o portal se o desenvolvedor principal estiver indisponível
   - onde estão os documentos privados
   - quais acessos a gestão possui
   - contatos técnicos

Esse material não deve ser publicado neste GitHub.

## Desenvolvimento local

Requisitos atuais:

- Node.js 22+
- npm
- Python 3

Instale as dependências:

```sh
npm ci
```

Inicie um servidor local:

```sh
npm run serve
```

Abra:

```text
http://localhost:8000
```

## Testes

Testes unitários:

```sh
npm test
```

Existem também scripts para testes de navegador e regras locais. Eles são ferramentas de desenvolvimento e não são necessários para utilizar o portal em produção.

## Observações

- O frontend de produção está na Vercel.
- O backend é um projeto separado na Netlify.
- As Security Rules de produção não devem depender de segredo por obscuridade.
- Credenciais administrativas devem permanecer fora do GitHub.
- O portal foi desenvolvido de forma independente por **Murilo Gabriel**.

---

**Desenvolvimento:** [Murilo Gabriel](https://murilogabriel.com.br/)
