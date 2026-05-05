const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkfilter')
    .setDescription('Manage non-GIF link filtering')
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable link filtering in a channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable link filtering in a channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List filtered channels'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'enable') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('INSERT OR IGNORE INTO link_filter_channels (guild_id, channel_id) VALUES (?, ?)').run(guildId, channel.id);
      return interaction.reply({ content: `Non-GIF link filtering enabled in ${channel}.`, ephemeral: true });
    }

    if (sub === 'disable') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('DELETE FROM link_filter_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      return interaction.reply({ content: `Non-GIF link filtering disabled in ${channel}.`, ephemeral: true });
    }

    const rows = db.prepare('SELECT * FROM link_filter_channels WHERE guild_id = ?').all(guildId);
    const text = rows.length ? rows.map(r => `<#${r.channel_id}>`).join('\n') : 'No link-filter channels configured.';
    return interaction.reply({ content: text, ephemeral: true });
  }
};
