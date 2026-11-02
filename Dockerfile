FROM node:22-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5002 \
    SHARE_ROOT=/share \
    DATA_DIR=/data

WORKDIR /app
COPY package.json package-lock.json ./
# sharp (thumbnails) is an optional dependency; it ships prebuilt binaries for this image
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js config.js app-config.json ./
COPY src ./src
COPY public ./public

# Folders to share and the app's own data (share links, chosen folders, thumbnail cache)
RUN mkdir -p /share /data && chown -R node:node /share /data
VOLUME ["/share", "/data"]

USER node
EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server.js"]
