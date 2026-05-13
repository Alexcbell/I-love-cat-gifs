const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const {
  BASE_MESSAGE_XP,
  GIF_MESSAGE_XP,
  getUserLevel,
  getLeaderboard,
  scanChannelHistory
} = require('../services/levelingService');

function formatRank(user, stats) {
  const rank = stats.rank ? `#${stats.rank}` : 'unranked';
  return [
    `${user} is level ${stats.level} (${rank})`,
    `XP: ${stats.xp}/${stats.nextLevelXp} (${stats.xpToNext} to next level)`,
    `Messages: ${stats.messageCount} | GIFs: ${stats.gifCount}`
  ].join('\n');
}

function getReadableChannels(interaction) {
  return interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .filter(channel => channel.permissionsFor(interaction.guild.members.me)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory
    ]));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check levels and scan message history for XP')
    .addSubcommand(sub => sub.setName('rank').setDescription('Check a member level')
      .addUserOption(opt => opt.setName('user').setDescription('Member to check').setRequired(false)))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Show the server XP leaderboard')
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of members to show').setMinValue(1).setMaxValue(20).setRequired(false)))
    .addSubcommand(sub => sub.setName('scan').setDescription('Staff: scan old messages and award XP')
      .addChannelOption(opt => opt.setName('channel').setDescription('Scan one text channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addIntegerOption(opt => opt.setName('limit').setDescription('Messages per channel to scan').setMinValue(1).setMaxValue(10000).setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'rank') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const stats = getUserLevel(interaction.guild.id, user.id);
      return interaction.reply(formatRank(user, stats));
    }

    if (sub === 'leaderboard') {
      const limit = interaction.options.getInteger('limit') ?? 10;
      const rows = getLeaderboard(interaction.guild.id, limit);
      if (!rows.length) {
        return interaction.reply(`No levels yet. Messages are worth ${BASE_MESSAGE_XP} XP, and GIFs are worth ${GIF_MESSAGE_XP} XP.`);
      }

      const lines = rows.map(row => {
        return `#${row.rank} <@${row.user_id}> - level ${row.level}, ${row.xp} XP (${row.gif_count} GIFs)`;
      });
      return interaction.reply(`Leaderboard:\n${lines.join('\n')}`);
    }

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to scan message history.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const limit = interaction.options.getInteger('limit') ?? 1000;
    await interaction.deferReply({ ephemeral: true });

    const channels = channel ? [channel] : [...getReadableChannels(interaction).values()];
    if (!channels.length) {
      return interaction.editReply('I could not find any text channels I can read.');
    }

    let scanned = 0;
    let awarded = 0;
    let skipped = 0;
    const summaries = [];

    for (const textChannel of channels) {
      const result = await scanChannelHistory(textChannel, { limit });
      scanned += result.scanned;
      awarded += result.awarded;
      skipped += result.skipped;
      if (summaries.length < 8) {
        summaries.push(`<#${result.channelId}>: ${result.awarded}/${result.scanned} new`);
      }
    }

    const lines = [
      'History scan complete.',
      `Channels: ${channels.length}`,
      `Messages scanned: ${scanned}`,
      `New XP records: ${awarded}`,
      `Already counted or ignored: ${skipped}`,
      `XP rules: normal messages ${BASE_MESSAGE_XP}, GIF messages ${GIF_MESSAGE_XP}`
    ];

    if (summaries.length) lines.push('', ...summaries);
    if (channels.length > summaries.length) lines.push(`...and ${channels.length - summaries.length} more channels.`);

    return interaction.editReply(lines.join('\n'));
  }
};
