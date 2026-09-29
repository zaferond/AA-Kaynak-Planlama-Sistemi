@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js 24 bulunamadi. Kurun ve bu pencereyi yeniden acin.
 pause
 exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24 veya daha yenisi gerekir.');process.exit(1)}"
if errorlevel 1 goto error
node backend/setup.mjs
if errorlevel 1 goto error
if not exist node_modules\mssql (
 call npm.cmd ci --omit=dev
 if errorlevel 1 goto error
)
if not exist node_modules\sql.js (
 call npm.cmd ci --omit=dev
 if errorlevel 1 goto error
)
call npm.cmd start
if errorlevel 1 goto error
exit /b 0
:error
echo Baslatma tamamlanamadi. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
