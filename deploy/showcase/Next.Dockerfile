ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_BASE_PATH=/knowledge-hub NEXT_PUBLIC_API_URL=/knowledge-hub-api \
    NEXT_PUBLIC_SUITE_ORIGIN=https://forge-flow.de FORGEFLOW_CONTAINER_BUILD=true
RUN npm run build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=127.0.0.1 PORT=3300
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
RUN node -e "const fs=require('fs'),path=require('path'); if(process.getuid()!==1000)throw new Error('Expected runtime UID 1000'); function check(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())check(file);else if(item.isFile()){const fd=fs.openSync(file,'r');fs.closeSync(fd);}}} check('/app'); console.log('Runtime-user application read check passed');"
CMD ["node", "server.js"]
