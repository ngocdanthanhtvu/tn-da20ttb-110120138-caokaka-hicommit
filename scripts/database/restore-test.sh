#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

backup_file="${1:-}"

if [ -z "$backup_file" ]; then
  backup_file="$(ls -1t hicommit_backup_*.sql 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "ERROR: backup file not found"
  exit 1
fi

checksum_file="${backup_file}.sha256"

if [ -f "$checksum_file" ]; then
  sha256sum -c "$checksum_file"
fi

test_db="hicommit_restore_test"

cleanup() {
  docker compose --env-file .env.compose exec -T db \
    sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "
      DROP DATABASE IF EXISTS hicommit_restore_test;
    "' >/dev/null
}

trap cleanup EXIT

docker compose --env-file .env.compose exec -T db \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "
    DROP DATABASE IF EXISTS hicommit_restore_test;
    CREATE DATABASE hicommit_restore_test;
  "'

docker compose --env-file .env.compose exec -T db \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" hicommit_restore_test' \
  < "$backup_file"

table_count="$(
  docker compose --env-file .env.compose exec -T db \
    sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N -e "
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = '\''hicommit_restore_test'\'';
    "'
)"

echo "Backup restored successfully: $backup_file"
echo "Restored table count: $table_count"
