# Build from the repo root so the relayer can read contracts/abi and contracts/deployments:
#   docker build -f relayer/Dockerfile -t prananet-relayer .
#   docker run --env-file relayer/.env -p 8080:8080 prananet-relayer
FROM node:24-slim
WORKDIR /app
COPY contracts/abi ./contracts/abi
COPY contracts/deployments ./contracts/deployments
COPY relayer/package.json relayer/package-lock.json ./relayer/
RUN cd relayer && npm ci --omit=dev --ignore-scripts && npm install --no-save --ignore-scripts tsx@4.23.15
COPY relayer/src ./relayer/src
COPY relayer/tsconfig.json ./relayer/
WORKDIR /app/relayer
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["npx", "tsx", "src/server.ts"]
