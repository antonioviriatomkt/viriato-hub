# Viriato Hub

Espaço interno das equipas Viriato. Aplicação web instalável (Safari → Ficheiro → Adicionar à Dock).

## Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4, PWA (`vite-plugin-pwa`)
- **Backend:** Supabase (Postgres + Auth + Realtime + RLS) — projeto `viriato-hub`
- **Hosting:** Vercel (deploy automático a cada push para `main`)

## Modelo de dados

| Tabela | Para quê |
| --- | --- |
| `profiles` | Utilizadores (`admin` / `member` / `pending`). O 1.º utilizador é admin; os seguintes ficam pendentes até aprovação. |
| `teams` | Espaços de equipa (ex.: Equipa de Vendas). |
| `team_members` | Quem pertence a que equipa. |
| `meetings` | Reuniões: título, data, **objetivo**, estado (`planned` / `done` / `cancelled`). |
| `meeting_notes` | **Notas** registadas depois da reunião (várias por reunião, por autor). |
| `meeting_log` | **Registo** automático e append-only (triggers) + entradas manuais. |

Permissões via Row Level Security: cada pessoa só vê as equipas a que pertence; admins veem tudo. As funções auxiliares (`is_admin`, `is_team_member`, …) vivem no schema `private`.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencher com URL + publishable key do Supabase
npm install
npm run dev
```

Após alterar o schema: regenerar `src/lib/database.types.ts` (Supabase → *Generate types*).

## Adicionar um novo módulo (ex.: Equipa de Marketing)

1. Admin → Administração → Criar equipa — não precisa de código.
2. Para novas funcionalidades (ex.: tarefas): nova tabela com `team_id`, políticas RLS iguais às de `meetings`, página em `src/pages/`.
