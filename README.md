# 📋 Dashboard de Pedidos

Sistema de gerenciamento de pedidos/demandas com Next.js, TypeScript e PostgreSQL.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)

## ✨ Funcionalidades

- 🔐 **Autenticação** - Login com email/senha
- 📝 **Pedidos** - CRUD completo com filtros e busca
- 👥 **Profissionais** - Gestão e atribuição de pedidos
- 💬 **Chat** - Mensagens em tempo real por pedido
- 📎 **Anexos** - Upload de arquivos
- 🏷️ **Tags** - Organização por categorias
- 📊 **Dashboard** - Estatísticas e visão geral

## 🚀 Início Rápido

### Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/download/)

### Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repo>
cd projeto-dash

# 2. Instale as dependências
npm install

# 3. Configure o banco de dados
# Crie um banco chamado "projeto_dash" no PostgreSQL

# 4. Configure as variáveis de ambiente
# Crie um arquivo .env na raiz:
```

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/projeto_dash"
NEXTAUTH_SECRET="sua-chave-secreta-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

```bash
# 5. Configure o Prisma
npx prisma generate
npx prisma db push

# 6. Popule com dados de teste
npm run db:seed

# 7. Inicie os servidores de desenvolvimento

Para rodar apenas o Next.js (sem funcionalidades em tempo real):
```bash
npm run dev
```

Para rodar o ambiente completo (Next.js + Socket.IO Server) - **Recomendado**:
```bash
npm run dev:all
```

Ou se preferir rodar em terminais separados:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:socket
```

Acesse: **http://localhost:3000**

## 🔔 Notificações em Tempo Real

O sistema utiliza um servidor Socket.IO dedicado (porta 3001) para funcionalidades em tempo real:
- Notificações instantâneas de novas mensagens
- Atualizações de status de pedidos
- Indicadores de digitação no chat

Certifique-se de que o comando `npm run dev:socket` ou `npm run dev:all` esteja rodando para que essas funcionalidades operem corretamente.

## 🧪 Testes

O projeto utiliza Jest para testes automatizados.

```bash
# Rodar todos os testes
 # 📋 Projeto: Dashboard de Pedidos

Aplicação para gerenciamento de pedidos/demandas, construída com Next.js, TypeScript e PostgreSQL. Inclui painel administrativo, chat em tempo real, uploads e relatórios.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)

## ✨ Principais Funcionalidades

- Autenticação com NextAuth.js (email/senha)
- CRUD completo de Pedidos com filtros e anexos
- Gestão de Profissionais e atribuição de demandas
- Chat por pedido (tempo real via Socket.IO)
- Tags para categorizar pedidos
- Uploads e visualização de arquivos
- Relatórios e dashboards com métricas

---

## 🚀 Pré-requisitos

- Node.js 18 ou superior
- PostgreSQL 14 ou superior
- (Opcional) Docker para facilitar setup de banco

---

## 🔧 Instalação e execução (desenvolvimento)

1. Clone o repositório e instale dependências:

```bash
git clone <url-do-repo>
cd projeto-dash
npm install
```

2. Crie o arquivo `.env` na raiz com pelo menos as variáveis abaixo:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/projeto_dash"
NEXTAUTH_SECRET="uma-chave-secreta-generica"
NEXTAUTH_URL="http://localhost:3000"
```

3. Inicialize o Prisma e aplique o schema:

```bash
npx prisma generate
npx prisma db push
```

4. (Opcional) Popule com dados de exemplo:

```bash
npm run db:seed
```

5. Execute em modo desenvolvimento:

- Rodar apenas o Next.js (UI/API):

```bash
npm run dev
```

- Rodar Next.js + servidor de sockets (recomendado para recursos em tempo real):

```bash
npm run dev:all
```

Ou em terminais separados:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:socket
```

Abra `http://localhost:3000` no navegador.

---

## ⚙️ Notas sobre tempo real (Socket.IO)

O projeto utiliza um servidor Socket.IO separado (padrão: porta 3001) para gerenciar notificações e chat em tempo real. Garanta que o processo do socket esteja rodando (`npm run dev:socket` ou `npm run dev:all`).

---

## 🧪 Testes

O repositório usa Jest para testes unitários e de integração.

```bash
# Rodar todos os testes
npm test

# Rodar em modo watch
npm run test:watch

# Gerar cobertura
npm run test:coverage
```

---

## 🛠️ Scripts úteis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia Next.js em modo desenvolvimento |
| `npm run dev:socket` | Inicia o servidor Socket separado |
| `npm run dev:all` | Inicia Next.js e Socket Server juntos |
| `npm run build` | Gera build de produção |
| `npm run start` | Inicia em modo produção |
| `npm run db:seed` | Popula o banco com dados de teste |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:reset` | Reseta o banco (use com cuidado) |

> Ajuste os comandos conforme seu `package.json` se necessário.

---

## 🗂 Estrutura do projeto (resumo)

Veja os diretórios mais relevantes:

```
app/                # Páginas e rotas (Next.js App Router)
   (dashboard)/      # Área protegida do dashboard
   api/               # Endpoints da API
components/         # Componentes React reutilizáveis
lib/                 # Utilitários e integrações (auth, prisma, socket)
prisma/              # Schema e seeds do Prisma
public/              # Recursos públicos (imagens, sons, etc.)
```

---

## ☁️ Deploy

Recomendado: Vercel para o frontend/API e Neon/Supabase ou outro PostgreSQL compatível para o banco.

No ambiente de produção, configure as variáveis:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="<seu-secret>"
NEXTAUTH_URL="https://seu-dominio"
```

---

## 👥 Usuários de exemplo

Após rodar o seed, existem contas de teste disponíveis (ver `prisma/seed.ts`). Exemplos comuns no projeto:

| Email | Senha |
|---|---|
| admin@example.com | senha123 |
| joao@example.com  | senha123 |
| carlos@example.com| senha123 |

---

## 📚 Referências e boas práticas

- Use `Prisma Studio` (`npm run db:studio`) para inspecionar dados locais.
- Para rodar em containers, considere um `docker-compose` com Postgres.
- Mantenha `NEXTAUTH_SECRET` seguro em produção.

---

## 📝 Licença

MIT
