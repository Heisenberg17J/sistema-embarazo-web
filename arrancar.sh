#!/usr/bin/env bash
# Levanta todo el entorno de desarrollo:
#   base de datos (Docker) + API (:4000) + web (:3000)
#
# La contraseña de la base vive solo en backend/.env, que no se sube al
# repositorio; --env-file hace que Docker la lea de ahí y no haya que repetirla.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f backend/.env ]; then
    echo "Falta backend/.env. Cópielo de backend/.env.example y complete DB_PASSWORD y JWT_SECRET." >&2
    exit 1
fi

echo "→ Base de datos"
docker compose --env-file backend/.env up -d

# Sin esta espera, las migraciones corren antes de que la base acepte
# conexiones y fallan en el primer arranque.
echo "→ Esperando a PostgreSQL"
intentos=0
until docker compose --env-file backend/.env exec -T db pg_isready -U postgres >/dev/null 2>&1; do
    intentos=$((intentos + 1))
    if [ "$intentos" -ge 60 ]; then
        echo "PostgreSQL no respondió en 60 segundos." >&2
        exit 1
    fi
    sleep 1
done

echo "→ Migraciones"
(cd backend && npm run migrate)

# Los dos servidores corren en paralelo; Ctrl+C detiene ambos.
echo "→ API en http://localhost:4000/api/v1 y web en http://localhost:3000"
trap 'kill 0' EXIT
(cd backend && npm run dev) &
(cd frontend && npm run dev) &
wait
