const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Initialize Lavalink
        await client.lavalink.init({ ...client.user });
        console.log('Lavalink initialized');
        
        // No initial presence - will be set when music starts playing
        client.user.setActivity(null);
    },
}; 