@echo off
title TUNNEL
echo Starting LocalTunnel...
call npx -y localtunnel --port 3000 --local-host localhost
echo.
echo ========================================================
echo TUNNEL CRASHED OR DISCONNECTED!
echo Please tell the AI what the error says!
echo ========================================================
pause
