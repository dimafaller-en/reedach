# Reedach server: docker build -t reedach . && docker run -e REEDACH_KEYS=... -p 3000:3000 reedach
# Node comes from Alpine's own package: the image is ~100 MB smaller than the official Node one.
FROM alpine:3.23 AS build
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/widget/package.json packages/widget/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages packages
RUN npm run build -w reedach-widget && npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
 && rm -rf node_modules/az/demo node_modules/az/src node_modules/az/test node_modules/az/coverage.html

FROM alpine:3.23
RUN apk add --no-cache nodejs hunspell && adduser -D -H -u 1000 reedach
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY LICENSE NOTICE.md ./
USER reedach
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "packages/server/src/cli.mjs"]
