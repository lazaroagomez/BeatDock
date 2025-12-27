# BeatDock

A Discord music bot powered by Lavalink. Simple to deploy, easy to use.

## Quick Start

### 1. Setup Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create an application and add a bot
3. Enable **all 3 Privileged Gateway Intents** (Presence, Server Members, Message Content)
4. Copy the bot token and client ID

### 2. Deploy

```bash
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

Create `.env` file with your credentials:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
```

Run:

```bash
docker compose run --rm bot npm run deploy
docker compose up -d
```

Done. Invite the bot to your server and use `/play`.

## Commands

| Command | Description |
|---------|-------------|
| `/play <query>` | Play a song |
| `/search <query>` | Search and select tracks |
| `/pause` | Pause/resume |
| `/skip` | Skip track |
| `/back` | Previous track |
| `/stop` | Stop and disconnect |
| `/queue` | Show queue |
| `/shuffle` | Shuffle queue |
| `/loop` | Toggle loop mode |
| `/clear` | Clear queue |
| `/volume <1-100>` | Set volume |
| `/nowplaying` | Current track info |
| `/about` | Bot info |

## Optional Configuration

Add to `.env` if needed:

```env
# Spotify support
SPOTIFY_ENABLED=true
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret

# Restrict to specific roles (comma-separated IDs)
ALLOWED_ROLES=123456789,987654321

# Language: en, es, tr
DEFAULT_LANGUAGE=en
```

## Useful Commands

```bash
docker compose logs -f          # View logs
docker compose restart          # Restart
docker compose down             # Stop
docker compose pull && docker compose up -d  # Update
```

## Links

- [Documentation](https://lazaroagomez.github.io/BeatDock)
- [Issues](https://github.com/lazaroagomez/BeatDock/issues)

## License

[Apache-2.0](LICENSE)
