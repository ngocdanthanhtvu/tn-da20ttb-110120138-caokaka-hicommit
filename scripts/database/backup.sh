#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

timestamp="$(date +'%Y-%m-%d_%H-%M-%S')"
backup_file="hicommit_backup_${timestamp}.sql"
checksum_file="${backup_file}.sha256"

docker compose --env-file .env.compose exec -T db \
  sh -c 'mariadb-dump \
    -uroot \
    -p"$MARIADB_ROOT_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    hicommit' \
  > "$backup_file"

if [ ! -s "$backup_file" ]; then
  echo "ERROR: backup file is empty"
  rm -f "$backup_file"
  exit 1
fi

sha256sum "$backup_file" > "$checksum_file"

echo "Backup created:"
ls -lh "$backup_file" "$checksum_file"
