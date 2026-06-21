#!/bin/sh
set -eu

mkdir -p /data/cache /data/logs

node dist-seed/prisma/seed.js

exec node server.js
