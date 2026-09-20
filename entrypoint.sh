#!/bin/sh
mkdir -p /data /var/log
node /app/dashboard.mjs >> /var/log/dashboard.log 2>&1 &
exec crond -f -d 8
