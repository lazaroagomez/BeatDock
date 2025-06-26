# BeatDock

![license](https://img.shields.io/github/license/lazaroagomez/BeatDock?style=flat-square)
![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue?style=flat-square)
![Lavalink](https://img.shields.io/badge/Lavalink-v4.1.1-orange?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ready-success?style=flat-square)

[🌐 View the Website / Docs](https://lazaroagomez.github.io/BeatDock)

A modern, Docker-ready Discord music bot with **slash commands**, **multilingual support**, and a **role-based permission system** – all powered by **Lavalink**.

## Features

- 🎵 **Rich Music Playback** – YouTube search, playlists, queue management, shuffle, previous track, volume & more.
- ⚡ **Slash Commands** – Fast, auto-completed slash commands for every feature.
- 🌐 **Multi-language** – English & Spanish translations out of the box (easily extendable).
- 🛡️ **Permission System** – Admin override + role-based access controlled via `.env` (no database required).
- 🐳 **One-Command Deployment** – Ship with Docker & docker compose in seconds.
- 📦 **Stateless** – No database; all state kept in memory (perfect for containerised environments).

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

### 2. Create `.env` file

```dotenv
# Discord Bot Configuration
# Get these from https://discord.com/developers/applications
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Lavalink Server Configuration
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# Optional: Language Settings
#DEFAULT_LANGUAGE=en

# Optional: Disconnection Settings
QUEUE_EMPTY_DESTROY_MS=30000
EMPTY_CHANNEL_DESTROY_MS=60000

# Optional: Permission Settings
# Comma-separated list of role IDs that can use the bot
# Leave empty to allow everyone to use the bot
# Example: ALLOWED_ROLES=123456789012345678,234567890123456789
ALLOWED_ROLES=
```

### 3. Deploy commands & start the bot

```bash
# Deploy slash commands
docker compose run --rm bot npm run deploy

# Start the bot
docker compose up -d
```

## Permissions

The bot includes a modular permission system:

- **Admin Override**: Users with Administrator permissions always have access
- **Role-Based Access**: Configure allowed roles via `ALLOWED_ROLES` in `.env`
- **Default Behavior**: If no roles are specified, everyone can use the bot

### Configuring Permissions

To restrict bot usage to specific roles:

1. Get the role IDs from Discord (enable Developer Mode in Discord settings)
2. Add role IDs to your `.env` file:
   ```dotenv
   ALLOWED_ROLES=123456789012345678,234567890123456789
   ```
3. Restart the bot

## Commands

| Slash Command | Description |
|---|---|
| `/play <query>` | Play a song or playlist (searches YouTube if not a URL) |
| `/skip` | Skip the current song |
| `/stop` | Stop playback and clear the queue |
| `/pause` | Toggle pause/resume |
| `/queue` | Show the current queue |
| `/nowplaying` | Show info about the current song |
| `/shuffle` | Shuffle the queue |
| `/volume <0-100>` | Set playback volume |
| `/clear` | Clear the entire queue |
| `/back` | Play the previous track |

## Docker Setup

The bot runs in Docker with two services:

- **BeatDock**: Discord bot (Node.js 22.16)
- **Lavalink**: Audio server (v4.1.1)

### Managing the Bot

Stop the bot:
```bash
docker compose down
```

View logs:
```bash
docker compose logs -f
```

## Windows (Docker Desktop)

Running BeatDock on Windows:

### 1. Install Docker Desktop
Get it from the [official website](https://www.docker.com/products/docker-desktop/) and make sure the WSL2 backend is enabled.

### 2. Clone the repository
```powershell
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

### 3. Create & edit your `.env` file
You can copy the example:
```powershell
copy .env.example .env
notepad .env  # or open with VS Code
```

### 4. Deploy slash commands & start everything
```powershell
docker compose run --rm bot npm run deploy
docker compose up -d
```

### 5. Monitor logs / containers
```powershell
docker compose logs -f  # CTRL+C to stop viewing
```

Docker Desktop will automatically start the containers whenever you reboot (unless disabled in settings).

## Support

- **Issues**: [GitHub Issues](https://github.com/lazaroagomez/BeatDock/issues)
- **Email**: lazaroagomez@outlook.com

## License

Apache-2.0