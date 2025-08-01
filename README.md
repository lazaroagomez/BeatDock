# BeatDock

<div align="center">

![license](https://img.shields.io/github/license/lazaroagomez/BeatDock?style=flat-square)
![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue?style=flat-square)
![Lavalink](https://img.shields.io/badge/Lavalink-v4.1.1-orange?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ready-success?style=flat-square)

[🌐 **View the Website / Docs**](https://lazaroagomez.github.io/BeatDock)

</div>

A modern, Docker-ready Discord music bot with **slash commands**, **multilingual support**, and a **role-based permission system** – all powered by **Lavalink**.

## ✨ Features

- 🎵 **Rich Music Playback** – YouTube search, playlists, queue management, shuffle, previous track, volume control
- ⚡ **Slash Commands** – Fast, auto-completed slash commands for every feature
- 🌐 **Multi-language Support** – English & Spanish translations (easily extendable)
- 🛡️ **Permission System** – Admin override + role-based access via `.env` (no database required)
- 🐳 **One-Command Deployment** – Deploy with Docker Compose in seconds
- 📦 **Stateless Design** – No database; all state in memory (perfect for containerized environments)
- 🎧 **Spotify Integration** – Optional Spotify support with smart track resolution

## 🔒 Discord Bot Setup Requirements

> ⚠️ **Important**: Before setting up BeatDock, enable the required Discord Privileged Gateway Intents.

BeatDock requires **all three** Discord Privileged Gateway Intents:

- **✅ Presence Intent** - User presence information
- **✅ Server Members Intent** - Server member data access  
- **✅ Message Content Intent** - Message content access

**To enable these intents:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot application → **"Bot"** → **"Privileged Gateway Intents"**
3. Enable all three toggles → **"Save Changes"**

> 🚨 **The bot will not function without these intents enabled.**

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

### 2. Configure environment variables

Create a `.env` file (copy from `.env.example`):

```dotenv
# Discord Bot Configuration
# Get these from https://discord.com/developers/applications
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Optional: Spotify Configuration
# To enable Spotify support, set SPOTIFY_ENABLED=true and provide your credentials
# Get your credentials from: https://developer.spotify.com/dashboard/applications
SPOTIFY_ENABLED=false
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# Lavalink Server Configuration
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# Optional: Language Settings
#DEFAULT_LANGUAGE=en

# Optional: Disconnection Settings
QUEUE_EMPTY_DESTROY_MS=30000
EMPTY_CHANNEL_DESTROY_MS=60000

# Optional: Lavalink Reconnection Settings
# Maximum number of reconnection attempts (default: 10)
LAVALINK_MAX_RECONNECT_ATTEMPTS=10
# Base delay for exponential backoff in milliseconds (default: 1000)
LAVALINK_BASE_DELAY_MS=1000
# Maximum delay for exponential backoff in milliseconds (default: 30000)
LAVALINK_MAX_DELAY_MS=30000
# Health check interval in milliseconds (default: 30000)
LAVALINK_HEALTH_CHECK_INTERVAL_MS=30000
# Reset reconnection attempts after this many minutes (default: 5)
LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES=5

# Optional: Permission Settings
# Comma-separated list of role IDs that can use the bot
# Leave empty to allow everyone to use the bot
# Example: ALLOWED_ROLES=123456789012345678,234567890123456789
ALLOWED_ROLES=

# Optional: Audio Settings
# Default volume for music playback (0-100, defaults to 80 if not set or invalid)
DEFAULT_VOLUME=80
```

### 3. Start with Docker (recommended)

```bash
# Deploy slash commands
docker compose run --rm bot npm run deploy

# Start the bot
docker compose up -d
```

> 💡 **Note**: The default `docker-compose.yml` uses the official pre-built image `ghcr.io/lazaroagomez/beatdock:latest`

## ⚙️ Advanced Setup

### Build from Source (Alternative)

If you prefer to build the Docker image yourself:

1. **Modify docker-compose.yml** to use build instead of image:
   ```yaml
   services:
     bot:
       container_name: beatdock
       build:
         context: .
         dockerfile: Dockerfile
   ```

2. **Build and start**:
   ```bash
   docker compose run --rm bot npm run deploy
   docker compose up -d
   ```

### Community ARM64 Image

Thanks to **@driftywinds** for providing an ARM64 community image:
- Image: `ghcr.io/driftywinds/beatdock-bot:latest`
- Details: [Issue #32](https://github.com/lazaroagomez/BeatDock/issues/32)

## 🛡️ Permission System

The bot includes a flexible permission system:

- **Admin Override**: Users with Administrator permissions always have access
- **Role-Based Access**: Configure allowed roles via `ALLOWED_ROLES` in `.env`
- **Default Behavior**: If no roles specified, everyone can use the bot

**To restrict access to specific roles:**
1. Enable Developer Mode in Discord settings
2. Get role IDs from Discord
3. Add to `.env`: `ALLOWED_ROLES=123456789012345678,234567890123456789`
4. Restart the bot

## 🎵 Available Commands

| Command | Description |
|---------|-------------|
| `/play <query>` | Play a song or playlist (searches YouTube if not a URL) |
| `/skip` | Skip the current song |
| `/stop` | Stop playback and clear the queue |
| `/pause` | Toggle pause/resume |
| `/loop` | Toggle loop mode (off/track/queue) |
| `/queue` | Show the current queue |
| `/nowplaying` | Show info about the current song |
| `/shuffle` | Shuffle the queue |
| `/volume <0-100>` | Set playback volume |
| `/clear` | Clear the entire queue |
| `/back` | Play the previous track |

## 🐳 Docker Management

### Basic Operations

```bash
# Stop the bot
docker compose down

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Update to latest image
docker compose pull && docker compose up -d
```

### Services Overview

- **BeatDock**: Discord bot (Node.js 22.16+)
- **Lavalink**: Audio server (v4.1.1)

## 🖥️ Platform-Specific Instructions

### Windows (Docker Desktop)

1. **Install Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/) (ensure WSL2 backend is enabled)

2. **Setup**:
   ```powershell
   git clone https://github.com/lazaroagomez/BeatDock.git
   cd BeatDock
   copy .env.example .env
   notepad .env  # or code .env
   ```

3. **Deploy**:
   ```powershell
   docker compose run --rm bot npm run deploy
   docker compose up -d
   ```

4. **Monitor**:
   ```powershell
   docker compose logs -f
   ```

### Linux/macOS

Follow the standard [Quick Start](#-quick-start) instructions above.

## 📞 Support & Contributing

- **Issues**: [GitHub Issues](https://github.com/lazaroagomez/BeatDock/issues)
- **Email**: lazaro98@duck.com
- **Documentation**: [Project Website](https://lazaroagomez.github.io/BeatDock)

## 📄 License

[Apache-2.0](LICENSE)

---

<div align="center">
<b>Built with ❤️ for the Discord community</b>
</div>
