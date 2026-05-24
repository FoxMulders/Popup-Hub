@echo off
cd /d "%~dp0"
echo Starting Popup Hub at https://localhost:3000
node node_modules\next\dist\bin\next dev --experimental-https --experimental-https-key ./.cert/localhost-key.pem --experimental-https-cert ./.cert/localhost.pem %*
