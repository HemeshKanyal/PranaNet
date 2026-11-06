# Build from the repo root (needs contracts/abi and contracts/deployments):
#   docker build --network host -f api/Dockerfile -t prananet-api .
#   docker run --env-file api/.env -p 8082:8082 prananet-api
FROM node:24-slim
WORKDIR /app
COPY --chown=node:node contracts/abi ./contracts/abi
COPY --chown=node:node contracts/deployments ./contracts/deployments
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --omit=dev --ignore-scripts && npm install --no-save --ignore-scripts tsx@4.23.15
COPY --chown=node:node api/src ./api/src
COPY --chown=node:node api/mocks ./api/mocks
COPY api/tsconfig.json ./api/
RUN mkdir -p /app/api/data && chown node:node /app/api/data
WORKDIR /app/api
ENV NODE_ENV=production PORT=8082
EXPOSE 8082
USER node
CMD ["npx", "tsx", "src/server.ts"]
