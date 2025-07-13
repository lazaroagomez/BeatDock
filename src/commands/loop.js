const { SlashCommandBuilder } = require("discord.js");
const { metrics } = require("../analytics/prometheusClient");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Toggle loop mode for the current track or queue."),
  async execute(interaction) {
    const { client } = interaction;
    const { requirePlayer } = require("../utils/interactionHelpers");

    const player = await requirePlayer(interaction);
    if (!player) return;

    // Cycle through loop modes: off -> track -> queue -> off
    let newMode;
    let modeMessage;

    switch (player.repeatMode) {
      case "off":
        newMode = "track";
        modeMessage = client.languageManager.get(
          client.defaultLanguage,
          "LOOP_TRACK_ENABLED"
        );
        break;
      case "track":
        newMode = "queue";
        modeMessage = client.languageManager.get(
          client.defaultLanguage,
          "LOOP_QUEUE_ENABLED"
        );
        break;
      case "queue":
        newMode = "off";
        modeMessage = client.languageManager.get(
          client.defaultLanguage,
          "LOOP_DISABLED"
        );
        break;
      default:
        newMode = "track";
        modeMessage = client.languageManager.get(
          client.defaultLanguage,
          "LOOP_TRACK_ENABLED"
        );
    }

    // Set the new repeat mode
    player.setRepeatMode(newMode);

    // Update the player display
    setTimeout(() => {
      client.playerController.updatePlayer(interaction.guild.id);
    }, 100);
    metrics.commandsExecuted.inc({ command: "loop", status: "success" });
    return interaction.reply({ content: modeMessage, ephemeral: true });
  },
};
