# BeatDock

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue?style=flat-square)
![License](https://img.shields.io/github/license/lazaroagomez/BeatDock?style=flat-square)
![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue?style=flat-square)
![Lavalink](https://img.shields.io/badge/Lavalink-v4.1.1-orange?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ready-success?style=flat-square)
![Node.js](https://img.shields.io/badge/node-%3E%3D22.16.0-green?style=flat-square)

[🌐 **Live Documentation**](https://lazaroagomez.github.io/BeatDock) • [📥 **Quick Start**](#-quick-start) • [📋 **Commands**](#-commands) • [🐛 **Issues**](https://github.com/lazaroagomez/BeatDock/issues)

</div>

**BeatDock** is a modern, feature-rich Discord music bot built with **Discord.js v14** and powered by **Lavalink**. Designed for simplicity and reliability, it offers high-quality music playback, interactive search capabilities, and seamless Docker deployment.

## ✨ Features

- 🎵 **High-Quality Audio** – Powered by Lavalink for crystal-clear music playback with minimal latency
- ⚡ **Modern Slash Commands** – Fast, auto-completed slash commands with Discord's latest interaction system
- 🔍 **Interactive Search** – Advanced search with pagination, multi-selection, and auto-queue management
- 🌐 **Multi-Language Support** – Built-in support for English, Spanish, and Turkish with easy extensibility
- 🎮 **Visual Player Controller** – Rich embeds with interactive buttons for playback control
- 🛡️ **Role-Based Permissions** – Flexible permission system with admin override and role-based access control
- 🐳 **One-Command Deployment** – Deploy instantly with Docker Compose using pre-built images
- 📦 **Stateless Design** – No database required; perfect for containerized environments
- 🎧 **Optional Spotify Integration** – Smart track resolution with ISRC matching for accurate results
- 🔄 **Advanced Queue Management** – Loop modes, shuffle, history navigation, and queue manipulation
- 🔊 **Volume Control** – Per-server volume control with validation and persistence
- ⚙️ **Robust Connection Management** – Advanced Lavalink reconnection with exponential backoff

## 🔒 Prerequisites

### Discord Bot Setup Requirements

> ⚠️ **Critical**: BeatDock requires **all three** Discord Privileged Gateway Intents to function properly.

Before deploying BeatDock, you must enable these intents in your Discord Developer Portal:

1. **✅ Presence Intent** - Required for user presence information
2. **✅ Server Members Intent** - Required for server member data access  
3. **✅ Message Content Intent** - Required for message content access

**To enable these intents:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot application → **"Bot"** → **"Privileged Gateway Intents"**
3. Enable all three toggles → **"Save Changes"**

> 🚨 **The bot will not start without these intents enabled.**

### System Requirements

- **Node.js**: ≥22.16.0
- **npm**: ≥11.4.2
- **Docker**: Latest version (for containerized deployment)
- **Discord Bot Token** with the above intents enabled

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

### 2. Configure Environment Variables

Create a `.env` file from the example template:

```bash
cp .env.example .env
```

Edit `.env` with your bot credentials:

```env
# Discord Bot Configuration (Required)
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Lavalink Configuration (Required for Docker setup)
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# Optional: Spotify Integration
SPOTIFY_ENABLED=false
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# Optional: Additional Settings
DEFAULT_LANGUAGE=en
QUEUE_EMPTY_DESTROY_MS=30000
EMPTY_CHANNEL_DESTROY_MS=60000
DEFAULT_VOLUME=80
ALLOWED_ROLES=

# Optional: Lavalink Reconnection Settings
LAVALINK_MAX_RECONNECT_ATTEMPTS=10
LAVALINK_BASE_DELAY_MS=1000
LAVALINK_MAX_DELAY_MS=30000
LAVALINK_HEALTH_CHECK_INTERVAL_MS=30000
LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES=5
```

### 3. Deploy with Docker (Recommended)

```bash
# Deploy slash commands to Discord
docker compose run --rm bot npm run deploy

# Start the bot and Lavalink server
docker compose up -d
```

### 4. Verify Deployment

```bash
# Check logs
docker compose logs -f

# Check running containers
docker compose ps
```

## 🎵 Commands

BeatDock offers 12 comprehensive slash commands organized by category:

### 🎮 Playback Control

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `/play` | `<query>` `<next>?` | Play music from URL or search query. Optionally, specify whether this song should be appended at the top of the queue | `/play Rick Astley Never Gonna Give You Up` |
| `/pause` | None | Toggle pause/resume playback | `/pause` |
| `/skip` | None | Skip to the next track | `/skip` |
| `/back` | None | Play the previous track from history | `/back` |
| `/stop` | None | Stop playback and disconnect from voice | `/stop` |
| `/volume` | `<level>` (1-100) | Adjust playback volume | `/volume 75` |

### 🔍 Search & Discovery

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `/search` | `<query>` (max 200 chars) | Interactive search with pagination and multi-selection | `/search ambient music` |

### 📋 Queue Management

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `/queue` | None | Display current queue with pagination | `/queue` |
| `/clear` | None | Clear the entire queue | `/clear` |
| `/shuffle` | None | Shuffle the current queue | `/shuffle` |
| `/loop` | None | Cycle through loop modes (off → track → queue) | `/loop` |

### ℹ️ Information

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `/nowplaying` | None | Show detailed info about the current track | `/nowplaying` |

### 🎛️ Advanced Features

- **Interactive Search**: Use `/search` to browse results with navigation buttons, select multiple tracks, and add them to the queue
- **Visual Player Controller**: Automatic player interface with buttons for all playbook controls
- **Loop Modes**: 
  - `off` - No looping
  - `track` - Loop current track
  - `queue` - Loop entire queue
- **Queue Persistence**: Queue state maintained during voice channel switches
- **Permission Checks**: All commands respect the role-based permission system

## ⚙️ Setup Guides

### 🐳 Production Deployment (Docker)

The recommended deployment method using the official pre-built image:

#### Prerequisites
- Docker and Docker Compose installed
- Discord bot token with required intents
- Configured `.env` file

#### Deployment Steps

1. **Configure the environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your bot credentials
   ```

2. **Deploy slash commands**:
   ```bash
   docker compose run --rm bot npm run deploy
   ```

3. **Start services**:
   ```bash
   docker compose up -d
   ```

4. **Monitor logs**:
   ```bash
   docker compose logs -f
   ```

#### Docker Management Commands

```bash
# Stop services
docker compose down

# Restart services  
docker compose restart

# Update to latest image
docker compose pull && docker compose up -d

# View logs
docker compose logs -f bot
docker compose logs -f lavalink
```

### 🛠️ Local Development Setup

For development and testing purposes:

#### Prerequisites
- Node.js ≥22.16.0
- npm ≥11.4.2
- Local Lavalink server or Docker for Lavalink only

#### Setup Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment for local development**:
   ```env
   # .env for local development
   TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   
   # Point to local Lavalink (if running locally) or Docker Lavalink
   LAVALINK_HOST=localhost  # or 'lavalink' for Docker
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   ```

3. **Start Lavalink** (choose one):
   ```bash
   # Option A: Use Docker for Lavalink only
   docker compose up -d lavalink
   
   # Option B: Run Lavalink locally (requires Java)
   # Download Lavalink jar and run with application.yml
   ```

4. **Deploy commands and start bot**:
   ```bash
   npm run deploy
   npm start
   ```

### 🔧 Build from Source (Alternative)

If you prefer to build the Docker image yourself:

1. **Modify docker-compose.yml**:
   ```yaml
   services:
     bot:
       container_name: beatdock
       build:
         context: .
         dockerfile: Dockerfile
       # Remove the 'image' line
   ```

2. **Build and deploy**:
   ```bash
   docker compose run --rm bot npm run deploy
   docker compose up -d
   ```

## 🛡️ Configuration Reference

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TOKEN` | Discord bot token from Developer Portal | `MTAx...` |
| `CLIENT_ID` | Discord application/client ID | `123456789012345678` |

#### Lavalink Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LAVALINK_HOST` | `lavalink` | Lavalink server hostname |
| `LAVALINK_PORT` | `2333` | Lavalink server port |
| `LAVALINK_PASSWORD` | `youshallnotpass` | Lavalink server password |

#### Optional Spotify Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTIFY_ENABLED` | `false` | Enable Spotify track resolution |
| `SPOTIFY_CLIENT_ID` | - | Spotify application client ID |
| `SPOTIFY_CLIENT_SECRET` | - | Spotify application client secret |

#### Bot Behavior Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_LANGUAGE` | `en` | Default language (en/es/tr) |
| `DEFAULT_VOLUME` | `80` | Default playbook volume (0-100) |
| `QUEUE_EMPTY_DESTROY_MS` | `30000` | MS to wait before leaving when queue is empty |
| `EMPTY_CHANNEL_DESTROY_MS` | `60000` | MS to wait before leaving empty voice channel |

#### Permission System

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ROLES` | - | Comma-separated role IDs that can use the bot |

**Permission Behavior**:
- **Empty `ALLOWED_ROLES`**: Everyone can use the bot
- **Admin Override**: Users with Administrator permission always have access
- **Role-Based**: Only specified roles can use the bot

**Example**: `ALLOWED_ROLES=123456789012345678,234567890123456789`

#### Advanced Lavalink Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `LAVALINK_MAX_RECONNECT_ATTEMPTS` | `10` | Maximum reconnection attempts |
| `LAVALINK_BASE_DELAY_MS` | `1000` | Base delay for exponential backoff |
| `LAVALINK_MAX_DELAY_MS` | `30000` | Maximum delay for reconnection |
| `LAVALINK_HEALTH_CHECK_INTERVAL_MS` | `30000` | Health check interval |
| `LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES` | `5` | Reset attempts after N minutes |

## 🔧 Troubleshooting

### Common Issues

#### Bot doesn't respond to commands
1. **Check Discord Intents**: Ensure all three Privileged Gateway Intents are enabled
2. **Verify deployment**: Run `docker compose run --rm bot npm run deploy`
3. **Check permissions**: Ensure the bot has necessary Discord permissions in your server

#### Music doesn't play
1. **Lavalink connection**: Check `docker compose logs lavalink`
2. **Voice permissions**: Bot needs Connect and Speak permissions in voice channels
3. **Firewall**: Ensure port 2333 is accessible for Lavalink

#### Search command not working
1. **YouTube access**: Ensure your server can access YouTube
2. **Lavalink plugins**: Verify YouTube plugin is loaded in Lavalink logs

#### Permission errors
1. **Role configuration**: Check `ALLOWED_ROLES` environment variable
2. **Admin override**: Remember administrators always have access
3. **Bot permissions**: Ensure bot has Read Messages/Send Messages permissions

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/lazaroagomez/BeatDock/issues)
- **Documentation**: [Project Website](https://lazaroagomez.github.io/BeatDock)
- **Email**: lazaro98@duck.com

When reporting issues, please include:
- Docker logs: `docker compose logs`
- Environment: Docker version, OS
- Error messages: Full error output
- Steps to reproduce: What you were trying to do

## 🤝 Contributing

We welcome contributions! Please feel free to submit issues, feature requests, or pull requests.

### Development Setup

1. Fork the repository
2. Follow the [Local Development Setup](#️-local-development-setup)
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- Use ESLint configuration provided
- Follow existing code patterns
- Add comments for complex logic
- Test all changes locally

## 📄 License

This project is licensed under the [Apache-2.0 License](LICENSE).

## 🙏 Acknowledgments

- **Lavalink Team** - For the excellent audio server
- **Discord.js Contributors** - For the fantastic Discord library
- **@driftywinds** - For providing ARM64 community image support
- **[@salvarecuero](https://github.com/salvarecuero)** - For contributions and support
- **Community Contributors** - For bug reports, suggestions, and improvements

---

<div align="center">

**Built with ❤️ for the Discord community**

[⭐ Star this repository](https://github.com/lazaroagomez/BeatDock) • [🐛 Report Bug](https://github.com/lazaroagomez/BeatDock/issues) • [✨ Request Feature](https://github.com/lazaroagomez/BeatDock/issues)

</div>
