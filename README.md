# SchoolLink powered by ASRO-Hub

学校の連絡事項や生徒間の情報共有を集約し、AI(Gemini API + RAG)で検索できるWebサービス。

## Phase 1 スコープ
- Docker環境 (Next.js / Fastify / PostgreSQL+pgvector / Redis)
- ログイン・アカウント登録 (Argon2id + Redisセッション)
- 学年・クラス管理 (1年1組のみ有効化)

## スタック
- Frontend: Next.js (App Router)
- Backend: Fastify + TypeScript + Prisma
- DB: PostgreSQL + pgvector
- Session/Rate Limit: Redis

## セットアップ
1. `.env.example` を `.env` にコピーして値を設定
2. `docker compose -f infra/docker-compose.dev.yml up -d`
3. `pnpm --filter backend prisma migrate dev`

## 注意
Gemini APIキー・DBパスワード等の秘密情報は絶対にコミットしないこと。
