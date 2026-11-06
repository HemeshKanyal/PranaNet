# Build from the repo root (needs contracts/abi and contracts/deployments):
#   docker build --network host -f verifier/Dockerfile -t prananet-verifier .
#   docker run --env-file verifier/.env -p 8081:8081 prananet-verifier
FROM node:24-slim
WORKDIR /app
COPY --chown=node:node contracts/abi ./contracts/abi
COPY --chown=node:node contracts/deployments ./contracts/deployments
COPY verifier/package.json verifier/package-lock.json ./verifier/
RUN cd verifier && npm ci --omit=dev --ignore-scripts && npm install --no-save --ignore-scripts tsx@4.23.15
COPY --chown=node:node verifier/src ./verifier/src
COPY --chown=node:node verifier/mocks ./verifier/mocks
COPY verifier/tsconfig.json ./verifier/
RUN mkdir -p /app/verifier/data && chown node:node /app/verifier/data
WORKDIR /app/verifier
ENV NODE_ENV=production PORT=8081
EXPOSE 8081
USER node
CMD ["npx", "tsx", "src/server.ts"]
