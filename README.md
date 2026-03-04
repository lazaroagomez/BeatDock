# BeatDock

A Discord music bot powered by Lavalink. Simple to deploy, easy to use.

## Features

- Play music from YouTube, SoundCloud, Bandcamp, Twitch, and Vimeo
- Optional Spotify support (search and resolve via YouTube)
- Queue management with shuffle, loop, and play-next
- Interactive search with track selection
- Multi-language support (English, Spanish, Turkish, Italian)
- Role-based access control
- Runs entirely in Docker — no host dependencies

## Quick Start

### Prerequisites

- A Discord bot token and client ID from the [Developer Portal](https://discord.com/developers/applications)
- [Docker](https://docs.docker.com/get-docker/) installed

When creating your bot, enable **all 3 Privileged Gateway Intents** (Presence, Server Members, Message Content).

### Option A: Deploy with Docker (recommended)

Uses the pre-built GHCR image — no cloning needed.

**1. Create a project directory:**

```bash
mkdir beatdock && cd beatdock
```

**2. Create `.env`:**

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
```

**3. Create `docker-compose.yml`:**

```yaml
services:
  bot:
    container_name: beatdock
    image: ghcr.io/lazaroagomez/beatdock:latest
    depends_on:
      lavalink:
        condition: service_healthy
    networks:
      - beatdock-network
    env_file: .env

  lavalink:
    container_name: beatdock-lavalink
    image: ghcr.io/lavalink-devs/lavalink:4
    ports:
      - "2333:2333"
    networks:
      - beatdock-network
    volumes:
      - ./application.yml:/opt/Lavalink/application.yml
    environment:
      - LAVALINK_PASSWORD=${LAVALINK_PASSWORD:-youshallnotpass}
      - SPOTIFY_ENABLED=${SPOTIFY_ENABLED:-false}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID:-}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET:-}
    healthcheck:
      test: ["CMD-SHELL", "bash -c 'echo > /dev/tcp/localhost/2333'"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

networks:
  beatdock-network:
    name: beatdock_network
```

**4. Create `application.yml`:**

```yaml
server:
  port: 2333
  address: 0.0.0.0

plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowDirectPlaylistIds: true
    clients:
      - MUSIC
      - WEB
      - ANDROID_VR

lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.16.0"
      snapshot: false
  server:
    password: "${LAVALINK_PASSWORD:youshallnotpass}"
    sources:
      youtube: false
      soundcloud: true
      bandcamp: true
      twitch: true
      vimeo: true
      http: true
      local: false
    bufferDurationMs: 200
    frameBufferDurationMs: 1000
    youtubePlaylistLoadLimit: 3
    playerUpdateInterval: 2
    trackStuckThresholdMs: 5000
    useSeekGhosting: true
    youtubeSearchEnabled: true

logging:
  level:
    root: INFO
    lavalink: INFO
```

**5. Deploy:**

```bash
docker compose run --rm bot npm run deploy
docker compose up -d
```

### Option B: Deploy from Source

```bash
git clone https://github.com/lazaroagomez/BeatDock.git
cd BeatDock
```

Create `.env` with your credentials (see [`.env.example`](.env.example) for all options):

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
```

```bash
docker compose run --rm bot npm run deploy
docker compose up -d
```

## Commands

| Command | Description |
|---------|-------------|
| `/play <query> [next]` | Play a song (optionally add to front of queue) |
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

## Configuration

All configuration is done through the `.env` file. Only `TOKEN` and `CLIENT_ID` are required.

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKEN` | — | Discord bot token (**required**) |
| `CLIENT_ID` | — | Discord application client ID (**required**) |
| `SPOTIFY_ENABLED` | `false` | Enable Spotify search support |
| `SPOTIFY_CLIENT_ID` | — | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | — | Spotify app client secret |
| `DEFAULT_LANGUAGE` | `en` | Bot language (`en`, `es`, `tr`, `it`) |
| `DEFAULT_VOLUME` | `80` | Default playback volume (0–100) |
| `ALLOWED_ROLES` | — | Comma-separated role IDs to restrict access |
| `LAVALINK_PASSWORD` | `youshallnotpass` | Lavalink server password |
| `QUEUE_EMPTY_DESTROY_MS` | `30000` | Disconnect after queue empties (ms) |
| `EMPTY_CHANNEL_DESTROY_MS` | `60000` | Disconnect from empty channel (ms) |

## Managing the Bot

```bash
docker compose logs -f                              # View logs
docker compose restart                              # Restart
docker compose down                                 # Stop
docker compose pull && docker compose up -d          # Update
```

## Links

- [Website](https://lazaroagomez.github.io/BeatDock)
- [Issues](https://github.com/lazaroagomez/BeatDock/issues)

## License

[Apache-2.0](LICENSE)
