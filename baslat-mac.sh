#!/bin/bash
set -e
cd "$(dirname "$0")"
trap 'echo "İşlem durdu. Yukarıdaki hata mesajını kontrol edin."' ERR
if ! command -v node >/dev/null; then echo 'Node.js 24 kurun ve Terminali yeniden açın.'; exit 1; fi
node -e "if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24 veya daha yenisi gerekir.');process.exit(1)}"
node backend/setup.mjs
if [ ! -d node_modules/mssql ] || [ ! -d node_modules/sql.js ]; then npm ci --omit=dev; fi
if [ ! -d frontend/node_modules/vite ]; then npm --prefix frontend ci; fi
npm run build
npm start
