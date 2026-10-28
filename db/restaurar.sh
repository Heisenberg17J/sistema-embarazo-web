#!/usr/bin/env bash
# Restaura un volcado de db/respaldo.sh en una base de datos VACÍA.
#
#   PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=... ./db/restaurar.sh respaldo.dump
#
# Se niega a restaurar sobre una base que ya tiene el esquema: restaurar encima de datos vivos
# los mezclaría o los pisaría. Cree una base nueva (o límpiela a propósito) y vuelva a intentar.
set -euo pipefail

archivo="${1:?Indique el archivo de respaldo: ./db/restaurar.sh respaldo.dump}"
: "${PGDATABASE:?Falta PGDATABASE (y PGHOST, PGUSER, PGPASSWORD)}"
[ -f "$archivo" ] || { echo "No existe $archivo" >&2; exit 1; }

existe=$(psql -Atq -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'seguimiento_embarazo'")
if [ "$existe" != "0" ]; then
    echo "La base $PGDATABASE ya tiene el esquema seguimiento_embarazo; no se restaura encima." >&2
    exit 1
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$PGDATABASE" "$archivo"
echo "Restauración terminada en $PGDATABASE."
