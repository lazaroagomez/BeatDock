@echo off
docker compose build bot

:retry
echo Starting services...
docker compose up -d
timeout /t 15 /nobreak >nul

docker inspect -f "{{.State.Running}}" beatdock-lavalink 2>nul | findstr "true" >nul
if errorlevel 1 (
    echo Lavalink failed to start, retrying...
    docker compose down
    timeout /t 5 /nobreak >nul
    goto retry
)

echo All services running.
docker compose logs -f
pause
