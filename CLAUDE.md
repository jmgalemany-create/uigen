# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps + generate Prisma client + run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Build for production (requires NODE_OPTIONS polyfill)
npm run build

# Run all tests
npm test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Run tests in watch mode
npx vitest

# Reset the database (destructive)
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Create a new migration after schema changes
npx prisma migrate dev --name <migration-name>
```

The app runs without an `ANTHROPIC_API_KEY` — it returns static mock responses instead of calling Claude.

## Architecture

### Request flow

1. User types a message → `ChatContext` (`src/lib/contexts/chat-context.tsx`) calls `/api/chat` via Vercel AI SDK's `useChat`
2. `POST /api/chat` (`src/app/api/chat/route.ts`) calls Claude with streaming, injecting `generationPrompt` as the system message and two tools: `str_replace_editor` and `file_manager`
3. Claude calls those tools to write/edit files in a **server-side** `VirtualFileSystem` instance that was reconstructed from the serialized client state sent in the request body
4. Tool calls stream back to the client; `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) intercepts them via `onToolCall` and applies mutations to its own **client-side** `VirtualFileSystem` instance
5. On `onFinish`, if a `projectId` was supplied and the user is authenticated, the full message history and serialized filesystem are saved to the `Project` row in SQLite

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is an in-memory tree (`Map<string, FileNode>`). It exists in two places simultaneously:
- **Server**: reconstructed from the serialized `files` payload in each POST request body, mutated by tool calls, then re-serialized and saved to DB on finish
- **Client**: kept in `FileSystemContext` state, mutated in real-time as tool calls stream in

Serialization drops the `Map` children (they are rebuilt on `deserializeFromNodes` by sorting paths and re-inserting in order).

### Preview rendering

`PreviewFrame` takes the client-side filesystem, calls `createImportMap` (`src/lib/transform/jsx-transformer.ts`) which:
1. Transforms every `.js/.jsx/.ts/.tsx` file with `@babel/standalone` (TypeScript + React JSX presets)
2. Creates Blob URLs for each file and builds a native browser `importmap`
3. Third-party packages resolve via `https://esm.sh/<package>`
4. Missing local imports get placeholder stub modules
5. Injects everything into a full HTML document rendered inside an `<iframe>` via `srcdoc`

The preview HTML loads Tailwind CSS from CDN and mounts the app at `/App.jsx` (the required entry point for all generated projects).

### Claude's tools

- `str_replace_editor` (`src/lib/tools/str-replace.ts`): `view`, `create`, `str_replace`, `insert` commands — mirrors the Anthropic text editor tool API
- `file_manager` (`src/lib/tools/file-manager.ts`): `rename`, `delete` commands

The system prompt (`src/lib/prompts/generation.tsx`) enforces:
- Every project must have `/App.jsx` as the root entry point
- Local imports use the `@/` alias (e.g., `@/components/Button`)
- Style with Tailwind, no hardcoded styles

### Auth

JWT-based sessions using `jose`. Passwords hashed with `bcrypt`. Session is stored in an HTTP-only cookie. Anonymous users can work freely — their in-progress messages and filesystem are persisted to `sessionStorage` via `anon-work-tracker.ts` so they can be recovered after sign-up.

### Data model

The database schema is defined in @prisma/schema.prisma. Reference it anytime you need to understand the structure of data stored in the database.

Two Prisma models:
- `User`: email + hashed password
- `Project`: belongs to optional `User`, stores `messages` (JSON string array) and `data` (JSON string of serialized `VirtualFileSystem`)

### Key context boundaries

- `FileSystemProvider` wraps both the editor and preview panels — it owns the client-side VFS
- `ChatProvider` wraps the chat UI — it reads `fileSystem.serialize()` to include current state in every API call
- Both providers are initialized in `src/app/[projectId]/page.tsx` with data fetched server-side

### Testing

Tests use Vitest + jsdom + Testing Library. Config is in `vitest.config.mts`. Test files live in `__tests__/` subdirectories next to the source they test.
