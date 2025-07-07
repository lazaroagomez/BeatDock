const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Initialize Lavalink
        await client.lavalink.init({ ...client.user });
        console.log('Lavalink initialized');
        
        // Set default presence using translation
        const defaultPresence = client.t('LISTENING_TO_MUSIC');
        client.user.setActivity(defaultPresence, { type: ActivityType.Listening });
    },
}; 