# This Dockerfile uses `serve` npm package to serve the static files with node process.
# You can find the Dockerfile for nginx in the following link:
# https://github.com/refinedev/dockerfiles/blob/main/vite/Dockerfile.nginx
# Base mirrors refinedev/node (WORKDIR /app/refine, non-root "refine" user) on a
# maintained Node LTS image.
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat \
  && addgroup -S refine && adduser -S refine -G refine \
  && mkdir -p /app/refine && chown -R refine:refine /app/refine

WORKDIR /app/refine

FROM base as deps

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base as builder

ENV NODE_ENV production

COPY --from=deps /app/refine/node_modules ./node_modules

COPY . .

RUN npm run build

FROM base as runner

ENV NODE_ENV production

RUN npm install -g serve@14.2.6

COPY --from=builder /app/refine/dist ./

USER refine

CMD ["serve"]
