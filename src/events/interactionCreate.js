const { checkInteractionPermission } = require('../utils/permissionChecker');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        const { client } = interaction;

        // Handle slash commands
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            // Check permissions
            const hasPermission = await checkInteractionPermission(interaction);
            if (!hasPermission) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ 
                    content: client.languageManager.get(client.defaultLanguage, 'ERROR_COMMAND_EXECUTION'), 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            if (!interaction.customId.startsWith('player_')) return;

            // Check permissions
            const hasPermission = await checkInteractionPermission(interaction);
            if (!hasPermission) return;

            const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
            const { playPrevious, shuffleQueue, clearQueue, formattedQueue } = require('../utils/PlayerActions');

            const player = await requirePlayer(interaction);
            if (!player) return;

            const lang = client.defaultLanguage;

            const sameVoice = await requireSameVoice(interaction, player);
            if (!sameVoice) return;

            let responded = false;
            
            try {
                switch (interaction.customId) {
                    case 'player_back':
                        const track = await playPrevious(player);
                        if (!track) {
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'NO_PREVIOUS_SONG'), 
                                ephemeral: true 
                            });
                        } else {
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'PLAYING_PREVIOUS', track.info?.title || 'Unknown'), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_playpause':
                        if (player.paused) {
                            await player.resume();
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'RESUMED'), 
                                ephemeral: true 
                            });
                        } else {
                            await player.pause();
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'PAUSED'), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_skip':
                        if (player.queue.tracks.length === 0) {
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'QUEUE_EMPTY'), 
                                ephemeral: true 
                            });
                        } else {
                            await player.skip();
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'SONG_SKIPPED'), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_stop':
                        await player.destroy();
                        await interaction.reply({ 
                            content: client.languageManager.get(lang, 'STOPPED_PLAYBACK'), 
                            ephemeral: true 
                        });
                        responded = true;
                        break;

                    case 'player_shuffle':
                        if (player.queue.tracks.length === 0) {
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'QUEUE_EMPTY'), 
                                ephemeral: true 
                            });
                        } else {
                            shuffleQueue(player);
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'QUEUE_SHUFFLED'), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_queue':
                        if (player.queue.tracks.length === 0) {
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'QUEUE_EMPTY'), 
                                ephemeral: true 
                            });
                        } else {
                            const queueString = formattedQueue(player, 10);
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'PLAYER_QUEUE_DISPLAY', queueString), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_clear':
                        try {
                            if (player.queue.tracks.length === 0) {
                                await interaction.reply({ 
                                    content: client.languageManager.get(lang, 'QUEUE_EMPTY'), 
                                    ephemeral: true 
                                });
                            } else {
                                clearQueue(player);
                                await interaction.reply({ 
                                    content: client.languageManager.get(lang, 'QUEUE_CLEARED'), 
                                    ephemeral: true 
                                });
                            }
                        } catch (clearError) {
                            console.error('Error clearing queue:', clearError);
                            await interaction.reply({ 
                                content: client.languageManager.get(lang, 'BUTTON_ERROR'), 
                                ephemeral: true 
                            });
                        }
                        responded = true;
                        break;

                    case 'player_loop':
                        // Cycle through loop modes
                        let newMode;
                        let modeMessage;
                        
                        switch (player.repeatMode || 'off') {
                            case 'off':
                                newMode = 'track';
                                modeMessage = client.languageManager.get(lang, 'LOOP_TRACK_ENABLED');
                                break;
                            case 'track':
                                newMode = 'queue';
                                modeMessage = client.languageManager.get(lang, 'LOOP_QUEUE_ENABLED');
                                break;
                            case 'queue':
                                newMode = 'off';
                                modeMessage = client.languageManager.get(lang, 'LOOP_DISABLED');
                                break;
                            default:
                                newMode = 'track';
                                modeMessage = client.languageManager.get(lang, 'LOOP_TRACK_ENABLED');
                        }

                        player.setRepeatMode(newMode);
                        await interaction.reply({ 
                            content: modeMessage, 
                            ephemeral: true 
                        });
                        responded = true;
                        break;

                }

                // Update the player message after any action
                if (!interaction.customId.includes('stop')) {
                    setTimeout(() => {
                        client.playerController.updatePlayer(interaction.guild.id);
                    }, 500);
                }
                
            } catch (error) {
                console.error('Error handling button:', error);
                if (!responded) {
                    await interaction.reply({ 
                        content: client.languageManager.get(lang, 'BUTTON_ERROR'), 
                        ephemeral: true 
                    }).catch(() => {});
                }
            }
        }
    },
}; 