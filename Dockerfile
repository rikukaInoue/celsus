FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY .yarn ./.yarn
COPY .yarnrc.yml package.json yarn.lock ./
COPY packages/backend/package.json packages/backend/
COPY packages/app/package.json packages/app/
COPY plugins/ plugins/

RUN --mount=type=cache,target=/app/.yarn/cache \
    yarn install --immutable

COPY . .

RUN yarn build:all

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/.yarn ./.yarn
COPY --from=build /app/.yarnrc.yml /app/package.json /app/yarn.lock ./
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/package.json ./packages/backend/
COPY --from=build /app/packages/app/dist ./packages/app/dist
COPY --from=build /app/packages/app/package.json ./packages/app/

RUN --mount=type=cache,target=/app/.yarn/cache \
    yarn workspaces focus --all --production

COPY app-config.yaml app-config.production.yaml ./
COPY examples/ ./examples/
COPY catalog/ ./catalog/

ENV NODE_ENV=production

EXPOSE 7007

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
