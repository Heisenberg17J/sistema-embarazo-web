#!/usr/bin/env bash
# Volcado completo de la base de datos en formato personalizado de PostgreSQL (comprimido).
#
#   PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=... ./db/respaldo.sh [carpeta]
#
# Requiere pg_dump (cliente de PostgreSQL 16 o superior). Deja un archivo
# respaldo-AAAAMMDD-HHMMSS.dump en la carpeta (por defecto ./respaldos), con permisos solo para
# quien lo creó: contiene datos de salud. Guárdelo CIFRADO y FUERA de la cuenta del proveedor.
set -euo pipefail

: "${PGDATABASE:?Falta PGDATABASE (y PGHOST, PGUSER, PGPASSWORD)}"
carpeta="${1:-respaldos}"
umask 077
mkdir -p "$carpeta"
archivo="$carpeta/respaldo-$(date +%Y%m%d-%H%M%S).dump"

pg_dump --format=custom --no-owner --no-privileges --file="$archivo"

# Un volcado que no se puede leer no es un respaldo: se comprueba antes de darlo por bueno.
pg_restore --list "$archivo" >/dev/null
echo "Respaldo listo: $archivo ($(du -h "$archivo" | cut -f1))"
