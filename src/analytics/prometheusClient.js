const client = require("prom-client");
const register = new client.Registry();

register.setDefaultLabels({
  app: "beatdock-bot",
});

client.collectDefaultMetrics({ register });

const metrics = {
  commandsExecuted: new client.Counter({
    name: "commands_executed_total",
    help: "Total number of commands executed",
    labelNames: ["command", "status"],
    registers: [register],
  }),

  songsPlayed: new client.Counter({
    name: "songs_played_total",
    help: "Total number of songs played",
    labelNames: ["guild_id", "source"],
    registers: [register],
  }),

  playlistsAdded: new client.Counter({
    name: "playlists_added_total",
    help: "Total number of playlists added",
    labelNames: ["guild_id"],
    registers: [register],
  }),

  activePlayers: new client.Gauge({
    name: "active_players_count",
    help: "Number of currently active music players",
    registers: [register],
  }),

  queueSize: new client.Histogram({
    name: "queue_size",
    help: "Size of music queues",
    labelNames: ["guild_id"],
    buckets: [1, 5, 10, 25, 50, 100],
    registers: [register],
  }),

  commandDuration: new client.Histogram({
    name: "command_duration_seconds",
    help: "Duration of command execution",
    labelNames: ["command"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),

  searchDuration: new client.Histogram({
    name: "search_duration_seconds",
    help: "Duration of music search operations",
    labelNames: ["guild_id"],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),

  errors: new client.Counter({
    name: "errors_total",
    help: "Total number of errors",
    labelNames: ["type", "command"],
    registers: [register],
  }),

  voiceChannelConnections: new client.Counter({
    name: "voice_channel_connections_total",
    help: "Total voice channel connections",
    labelNames: ["guild_id"],
    registers: [register],
  }),

  guildsCount: new client.Gauge({
    name: "discord_guilds_count",
    help: "Number of guilds the bot is in",
    registers: [register],
  }),

  usersCount: new client.Gauge({
    name: "discord_users_count",
    help: "Number of users the bot can see",
    registers: [register],
  }),
};

module.exports = {
  register,
  metrics,
};
