# AGENTS.md

Guidance for AI coding agents (including GitHub Copilot/Copilot Coding Agent) working in this repository.

## Scope

- This file applies to the entire repository.
- If a subfolder has its own `AGENTS.md`, the subfolder file overrides this one for files in that subtree.

## Monorepo Facts

- Package manager: `pnpm@10.25.0`
- Required Node.js: `>=22.18.0`
- Workspaces: `apps/*`, `packages/*`
- Task runner: Turborepo (`turbo.json`)

---

## Folder Map

### `apps/api` — NestJS + Fastify

Each feature module follows DDD layering:

```
modules/{feature}/
  application/      # Services (use cases), ports (interfaces), DTOs
  domain/           # Entities, value objects, domain rules
  infrastructure/   # Drizzle repositories, Passport strategies, 3rd-party adapters
  presentation/     # Controllers, guards, decorators
```

- Layer flow is strictly `presentation` → `application` → `infrastructure`. No skipping layers.
- Keep controllers thin — business logic belongs in application services.
- Define external dependency interfaces as ports in `application/ports/`; implement them in `infrastructure/`.
- Add/maintain DTO validation and Swagger annotations when changing request/response shapes.
- Auth uses 3+2+1 design: multiple `auth_identities` per user, sessions in `auth_sessions`, single `users` aggregate root.
- Prefer extending existing module patterns over introducing new architectural styles.

### `apps/web` — React 19 + Vite + React Router

- Route/page code lives in `src/pages/`, feature logic in `src/features/`.
- Prefer composition with shared UI from `@workspace/ui`.
- Use theme tokens (`--color-*`, `--chart-*`) instead of hardcoded colors.
- Keep theme-specific styling isolated:
  - Base styles: `packages/ui/src/styles/index.css`
  - Optional themes: separate files (e.g. `neumorphism.css`), loaded only when needed.
- Generate API types from OpenAPI before adding new API calls: `pnpm --filter web generate:api` (requires API running on port 3000).

### `packages/ui` — Shared design system

- Keep components framework-agnostic; avoid app-specific coupling.
- Preserve accessibility semantics and keyboard/focus behavior.
- Prefer extending existing `data-slot` patterns for style targeting.
- Do not break published exports defined in `packages/ui/package.json`.

### `packages/database` — Drizzle ORM

- Schema changes and migrations are always a pair — never one without the other.
- Generate migrations via `pnpm db:generate`; do not manually edit existing migration files.
- Keep schema exports in sync: `src/schemas/index.ts` and related entry points.
- Add relations to `src/relations.ts` when linking tables.

### `packages/eslint-config` and `packages/typescript-config`

- Central source of lint/type conventions — prefer changes here over per-app overrides.

---

## Library Conventions

These are **required** patterns. Do not substitute with alternatives or hand-roll equivalents.

### Validation — Zod

- Use Zod for all validation: API inputs, env vars, form schemas, runtime data parsing.
- Define schemas in a colocated `*.schema.ts` file.
- Derive TypeScript types with `z.infer<typeof Schema>` — do not duplicate type definitions.
- Do not use manual `if`/`typeof` checks or `class-validator` alone for data shape validation.

### Dates — date-fns

- Never use `new Date()` arithmetic, `.toLocaleDateString()`, or manual date math.
- Use date-fns: `format`, `parseISO`, `differenceInDays`, `addDays`, `isAfter`, `isBefore`, etc.
- Import only what you need: `import { format } from 'date-fns'`

### Utilities — lodash

- Prefer lodash over hand-rolled array/object manipulation.
- Common functions: `groupBy`, `uniqBy`, `omit`, `pick`, `merge`, `cloneDeep`, `debounce`, `chunk`.
- Import per-method to keep bundles small: `import groupBy from 'lodash/groupBy'`
- Never reimplement: deduplication, deep clone, grouping, flattening, object diffing.

### Shared utilities — check before writing

Before writing any helper, check these locations first:

- `apps/api/src/lib/` — backend utilities
- `apps/web/src/lib/` — frontend utilities
- `packages/ui/src/` — shared UI helpers

If a utility already exists, import it. Do not duplicate it. If you create a new generic utility, add it to the appropriate `lib/` folder — never inline it.

---

## Change Discipline

- Make the smallest safe change that solves the task.
- Do not refactor, rename, or reorganize code outside the scope of the task.
- Do not change dependency versions unless required.
- Do not modify unrelated files.
- Match existing file conventions: imports, naming, formatting, patterns.
- Keep public APIs stable unless a breaking change is explicitly requested.

---

## Generated & Derived Files

Do not hand-edit generated artifacts — regenerate them instead:

| Artifact                                              | Command                              |
| ----------------------------------------------------- | ------------------------------------ |
| Web OpenAPI types (`apps/web/src/types/openapi.d.ts`) | `pnpm --filter web generate:api`     |
| Drizzle migrations (`packages/database/drizzle/*`)    | `pnpm --filter database db:generate` |

Do not commit build output directories (`dist/`, etc.) unless explicitly requested.

---

## Validation Checklist

Run these before marking a task complete:

```bash
pnpm lint                          # ESLint (whole repo)
pnpm check-types                   # TypeScript (whole repo)
pnpm --filter api test             # API unit tests
pnpm --filter web test:unit        # Web unit tests
pnpm build                         # Full build
```

If environment limitations prevent running checks, state that explicitly in the PR summary.

---

## PR Expectations

Every agent-authored PR must include:

- **What** changed
- **Why** it changed
- **How** it was validated (commands run + outcome)
- **Limitations** or follow-ups if any

Keep diffs review-friendly: one logical change per commit, no unrelated noise.
