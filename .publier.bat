@echo off
cd /d "%~dp0"
git add .
git commit -m "FIX"
git push
echo.
echo Termine.
pause
