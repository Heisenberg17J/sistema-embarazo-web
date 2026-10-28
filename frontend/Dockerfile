# Interfaz web (Next.js). Contexto de construcción: frontend/
#   docker build --build-arg API_URL=https://api.tu-dominio.com/api/v1 -t embarazo-web frontend
FROM node:20-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS compilacion
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# El middleware de Next se compila a parte y puede incrustar las variables en el build:
# la URL de la API se pasa aquí Y al ejecutar el contenedor, con el mismo valor.
ARG API_URL=http://localhost:4000/api/v1
ARG REFRESH_DIAS=7
ENV API_URL=$API_URL REFRESH_DIAS=$REFRESH_DIAS NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# `output: "standalone"` deja en .next/standalone solo lo que la app usa.
COPY --from=compilacion /app/.next/standalone ./
COPY --from=compilacion /app/.next/static ./.next/static
COPY --from=compilacion /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
