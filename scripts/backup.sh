#!/bin/sh
# Runs in the backup service of docker-compose.yml: dumps the database once a
# day and keeps two weeks of dumps. Restoring is covered in the README.
umask 077

while true; do
  file="/backups/statslk-$(date +%F).dump"
  if pg_dump -h db -U statslk -d statslk -Fc -f "$file.tmp"; then
    mv "$file.tmp" "$file"
    find /backups -name 'statslk-*.dump' -mtime +14 -delete
    echo "Saved $file"
  else
    rm -f "$file.tmp"
    echo "Backup failed" >&2
  fi
  sleep 86400
done
