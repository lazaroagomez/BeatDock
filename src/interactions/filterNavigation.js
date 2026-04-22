const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { EQList } = require('lavalink-client');
const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
const logger = require('../utils/logger');

const EFFECTS = [
    { key: 'bassboost', label: 'Bass Boost', description: 'Boosted low frequencies', emoji: '🔊' },
    { key: 'nightcore', label: 'Nightcore', description: 'Faster speed + higher pitch', emoji: '🌙' },
    { key: 'vaporwave', label: 'Vaporwave', description: 'Slower speed + lower pitch', emoji: '🌊' },
    { key: '8d', label: '8D Audio', description: 'Rotating stereo effect', emoji: '🎧' },
    { key: 'karaoke', label: 'Karaoke', description: 'Removes vocals', emoji: '🎤' },
    { key: 'tremolo', label: 'Tremolo', description: 'Volume oscillation', emoji: '〰️' },
    { key: 'vibrato', label: 'Vibrato', description: 'Pitch oscillation', emoji: '🎵' },
    { key: 'lowpass', label: 'Low Pass', description: 'Muffled/underwater sound', emoji: '🌀' },
    { key: 'reset', label: 'Reset All', description: 'Clear all active filters', emoji: '🔄' },
];

const EQ_PRESETS = [
    { key: 'bassboost_low', label: 'Bass Boost Low', description: 'Light bass boost', emoji: '🔉' },
    { key: 'bassboost_high', label: 'Bass Boost High', description: 'Heavy bass boost', emoji: '🔊' },
    { key: 'rock', label: 'Rock', description: 'EQ preset for rock music', emoji: '🎸' },
    { key: 'pop', label: 'Pop', description: 'EQ preset for pop music', emoji: '🎶' },
    { key: 'electronic', label: 'Electronic', description: 'EQ preset for electronic music', emoji: '🎹' },
    { key: 'gaming', label: 'Gaming', description: 'EQ preset for gaming', emoji: '🎮' },
    { key: 'classic', label: 'Classic', description: 'EQ preset for classical music', emoji: '🎻' },
    { key: 'fullsound', label: 'Full Sound', description: 'Enhanced full-range audio', emoji: '🔈' },
    { key: 'bettermusic', label: 'Better Music', description: 'General audio enhancement', emoji: '✨' },
];

const PAGES = [EFFECTS, EQ_PRESETS];

const ALL_EQ_KEYS = ['bassboost', 'bassboost_low', 'bassboost_high', 'rock', 'pop', 'electronic', 'gaming', 'classic', 'fullsound', 'bettermusic'];

function isFilterActive(player, key) {
    const fm = player.filterManager;
    switch (key) {
        case 'bassboost':
        case 'bassboost_low':
        case 'bassboost_high':
        case 'rock':
        case 'pop':
        case 'electronic':
        case 'gaming':
        case 'classic':
        case 'fullsound':
        case 'bettermusic':
            return player._activeEqPreset === key;
        case 'nightcore': return fm.filters?.nightcore || false;
        case 'vaporwave': return fm.filters?.vaporwave || false;
        case '8d': return fm.filters?.rotation || false;
        case 'karaoke': return fm.filters?.karaoke || false;
        case 'tremolo': return fm.filters?.tremolo || false;
        case 'vibrato': return fm.filters?.vibrato || false;
        case 'lowpass': return fm.filters?.lowPass || false;
        default: return false;
    }
}

function getActiveFilters(player) {
    return [...EFFECTS, ...EQ_PRESETS]
        .filter(f => f.key !== 'reset' && isFilterActive(player, f.key))
        .map(f => f.label);
}

function buildFilterResponse(client, player, page) {
    const lang = client.defaultLanguage;
    const items = PAGES[page - 1];
    const totalPages = PAGES.length;
    const activeFilters = getActiveFilters(player);

    const activeText = activeFilters.length > 0
        ? `**${client.languageManager.get(lang, 'FILTER_ACTIVE')}:** ${activeFilters.join(', ')}`
        : client.languageManager.get(lang, 'FILTER_NONE_ACTIVE');

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(client.languageManager.get(lang, 'FILTER_TITLE'))
        .setDescription(`${activeText}\n\n${client.languageManager.get(lang, 'FILTER_SELECT')}`)
        .setFooter({ text: `${client.languageManager.get(lang, 'QUEUE_PAGE_FOOTER').replace('{0}', page).replace('{1}', totalPages)}` })
        .setTimestamp();

    const selectOptions = items.map(item => {
        const active = isFilterActive(player, item.key);
        return {
            label: `${item.label}${active ? ' ✓' : ''}`,
            description: item.description,
            value: item.key,
            emoji: item.emoji,
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('filter:select')
        .setPlaceholder(client.languageManager.get(lang, 'FILTER_SELECT'))
        .addOptions(selectOptions);

    const components = [new ActionRowBuilder().addComponents(selectMenu)];

    const navRow = new ActionRowBuilder();
    if (page > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`filter:prev:${page - 1}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (page < totalPages) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`filter:next:${page + 1}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (navRow.components.length > 0) {
        components.push(navRow);
    }

    return { embeds: [embed], components };
}

async function applyFilter(player, key) {
    const fm = player.filterManager;

    switch (key) {
        case 'bassboost':
            if (player._activeEqPreset === 'bassboost') {
                await fm.clearEQ();
                player._activeEqPreset = null;
                return false;
            }
            await fm.setEQ(EQList.BassboostMedium);
            player._activeEqPreset = 'bassboost';
            return true;

        case 'nightcore':
            await fm.toggleNightcore();
            return fm.filters?.nightcore || false;

        case 'vaporwave':
            await fm.toggleVaporwave();
            return fm.filters?.vaporwave || false;

        case '8d':
            await fm.toggleRotation(0.2);
            return fm.filters?.rotation || false;

        case 'karaoke':
            await fm.toggleKaraoke();
            return fm.filters?.karaoke || false;

        case 'tremolo':
            await fm.toggleTremolo();
            return fm.filters?.tremolo || false;

        case 'vibrato':
            await fm.toggleVibrato();
            return fm.filters?.vibrato || false;

        case 'lowpass':
            await fm.toggleLowPass();
            return fm.filters?.lowPass || false;

        case 'reset':
            await fm.resetFilters();
            player._activeEqPreset = null;
            return false;

        // EQ presets — toggle: if same preset active, clear it; otherwise apply new one
        case 'bassboost_low':
        case 'bassboost_high':
        case 'rock':
        case 'pop':
        case 'electronic':
        case 'gaming':
        case 'classic':
        case 'fullsound':
        case 'bettermusic': {
            if (player._activeEqPreset === key) {
                await fm.clearEQ();
                player._activeEqPreset = null;
                return false;
            }
            const presetMap = {
                bassboost_low: EQList.BassboostLow,
                bassboost_high: EQList.BassboostHigh,
                rock: EQList.Rock,
                pop: EQList.Pop,
                electronic: EQList.Electronic,
                gaming: EQList.Gaming,
                classic: EQList.Classic,
                fullsound: EQList.FullSound,
                bettermusic: EQList.BetterMusic,
            };
            await fm.setEQ(presetMap[key]);
            player._activeEqPreset = key;
            return true;
        }

        default: return false;
    }
}

function getFilterLabel(key) {
    const all = [...EFFECTS, ...EQ_PRESETS];
    return all.find(f => f.key === key)?.label || key;
}

async function handleFilterNavigation(interaction) {
    const { client, customId } = interaction;

    const player = await requirePlayer(interaction);
    if (!player) return;

    const sameVoice = await requireSameVoice(interaction, player);
    if (!sameVoice) return;

    const lang = client.defaultLanguage;
    const [, action, param] = customId.split(':');

    if (action === 'prev' || action === 'next') {
        const page = parseInt(param);
        if (isNaN(page)) return;

        const response = buildFilterResponse(client, player, page);
        await interaction.update({ ...response });
        return;
    }

    if (action === 'select') {
        const selectedKey = interaction.values[0];
        const label = getFilterLabel(selectedKey);

        try {
            const enabled = await applyFilter(player, selectedKey);

            let content;
            if (selectedKey === 'reset') {
                content = client.languageManager.get(lang, 'FILTER_RESET');
            } else if (enabled) {
                content = client.languageManager.get(lang, 'FILTER_APPLIED', label);
            } else {
                content = client.languageManager.get(lang, 'FILTER_REMOVED', label);
            }

            // Determine which page we're on based on the selected key
            const page = EQ_PRESETS.some(p => p.key === selectedKey) ? 2 : 1;
            const response = buildFilterResponse(client, player, page);

            await interaction.update({ ...response });
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        } catch (error) {
            logger.error('Error applying filter:', error);
            await interaction.followUp({
                content: client.languageManager.get(lang, 'GENERIC_ERROR'),
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}

module.exports = { handleFilterNavigation, buildFilterResponse };
