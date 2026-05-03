# Celsus

知識を整理し、導き、育てる開発プラットフォーム。

名前の由来は[ケルスス図書館](https://ja.wikipedia.org/wiki/%E3%82%B1%E3%83%AB%E3%82%B9%E3%82%B9%E5%9B%B3%E6%9B%B8%E9%A4%A8) — 古代エフェソスに建てられた、知恵と知識を象徴する図書館。

## 構成

[Backstage](https://backstage.io) をベースに、組織の技術知識を管理・活用するためのプラグインとサービスを載せている。

```
packages/
  app/              # Backstage frontend
  backend/          # Backstage backend

plugins/
  librarian/        # 司書プラグイン (frontend)
  librarian-backend/# 司書プラグイン (backend)

services/
  critic/           # AI相互レビューサービス

infra/
  *.tf              # AWS (EC2 + RDS) Terraform
```

## Librarian

Backstageカタログの利用状況を追跡する司書プラグイン。

- エンティティ閲覧数の記録・ランキング
- FAQ管理
- 全文検索 / 類似エンティティ発見
- 依存関係グラフ（影響分析）

## Critic

2つのAIエージェント（Mitra / Aria）が異なる視点でレビュー・アドバイスするサービス。

- **Mitra** — 行動を促す人。具体的な1アクションを提案する（Double Diamondの2nd Diamond）
- **Aria** — 構造を見せる人。問いを投げて理解を深める（Double Diamondの1st Diamond）

特徴:
- 入力タイプ自動判定（code / consultation / debate）
- ローカルONNX embedding（API不要）
- フィードバック学習（選択→キャラ成長）
- CLI + Slack Bot（キャラ別Slack App）

詳細: [services/critic/](services/critic/)

## セットアップ

```bash
# Backstage
yarn install
yarn dev

# Critic
cd services/critic
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm dev          # CLI
pnpm dev:slack    # Slack bots
```

## インフラ

AWS EC2 (t4g.small) + RDS (PostgreSQL + pgvector) にデプロイ。Terraform管理。Google OAuth認証。

## ライセンス

MIT
