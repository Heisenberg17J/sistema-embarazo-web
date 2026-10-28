# API de seguimiento del embarazo.
#
# El contexto de construcción es la RAÍZ del repositorio, no backend/: las migraciones
# viven en db/ y scripts/migrate.js las busca en ../../db.
#   docker build -f backend/Dockerfile -t embarazo-api .
FROM node:20-alpine AS dependencias
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=dependencias /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY db /app/db

# Sin permisos de root dentro del contenedor.
USER node
EXPOSE 4000

# /api/v1/salud responde 503 si la base de datos no contesta.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Las migraciones NO corren al arrancar: se ejecutan como paso de despliegue
# (`node scripts/migrate.js`), para que varias réplicas no compitan por aplicarlas.
CMD ["node", "src/server.js"]
