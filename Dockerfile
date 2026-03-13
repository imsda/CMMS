FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --ignore-scripts

FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY app ./app
COPY components ./components
COPY docs ./docs
COPY lib ./lib
COPY messages ./messages
COPY prisma ./prisma
COPY public ./public
COPY scripts ./scripts
COPY types ./types
COPY auth.ts ./
COPY entrypoint.sh ./
COPY i18n.ts ./
COPY instrumentation.ts ./
COPY middleware.ts ./
COPY next-env.d.ts ./
COPY next.config.mjs ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./
COPY tsconfig.json ./

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

RUN chmod +x /app/entrypoint.sh /app/scripts/verify-db-config.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
