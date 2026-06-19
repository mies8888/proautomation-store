@echo off
title NEXT_JS_SERVER
echo Starting Next.js...
call npm run dev
echo.
echo ========================================================
echo CRASH DETECTED! THE SERVER HAS STOPPED!
echo Please copy the error above and tell the AI what it says!
echo ========================================================
pause
