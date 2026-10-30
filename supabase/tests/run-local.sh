#!/usr/bin/env bash
# Rejoue TOUTES les migrations (0001 → dernière) sur une base PostgreSQL locale VIERGE, puis chaque
# scénario supabase/tests/*.test.sql dans sa propre base neuve.
#
# Usage (PostgreSQL local, sans Supabase) :
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/run-local.sh
#
# La sortie liste chaque vérification (« OK » ou « FAIL ») ; le script se termine en erreur s'il
# y a au moins un « FAIL ». NE PAS lancer sur un vrai projet Supabase (il crée des bases de test).
set -uo pipefail
cd "$(dirname "$0")/../.."

failures=0
for test in supabase/tests/*.test.sql; do
  db="m3ak_test_$(basename "$test" .test.sql | tr -c 'a-z0-9\n' '_')"
  psql -q -d postgres -c "drop database if exists $db" -c "create database $db" 2>&1 | grep -v NOTICE
  export PGDATABASE="$db"
  psql -q -v ON_ERROR_STOP=1 -f supabase/tests/stub.sql || exit 1
  for migration in supabase/migrations/*.sql; do
    out=$(psql -q -v ON_ERROR_STOP=1 -f "$migration" 2>&1 | grep -v NOTICE)
    if [ -n "$out" ]; then echo "ERREUR migration $migration"; echo "$out"; exit 1; fi
  done
  echo "== $test"
  out=$(psql -q -f "$test" 2>&1)
  echo "$out" | grep -E "^ (OK|FAIL)"
  fails=$(echo "$out" | grep -cE "^ FAIL" || true)
  failures=$((failures + fails))
done
unset PGDATABASE
echo "Échecs : $failures"
exit $((failures > 0 ? 1 : 0))
