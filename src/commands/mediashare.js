const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { isStaff } = require('../utils/permissions');
const { logToModChannel } = require('../services/logService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mediashare')
    .setDescription('Manage Media-Share GIF channels')
    .addSubcommand(sub => sub.setName('add').setDescription('Add a Media-Share channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(opt => opt.setName('limit').setDescription('GIF limit').setMinValue(1).setRequired(false)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a Media-Share channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('setlimit').setDescription('Set GIF limit')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(opt => opt.setName('limit').setDescription('GIF limit').setMinValue(1).setRequired(true)))
    .addSubcommand(sub => sub.setName('attachments').setDescription('Enable or disable GIF attachments')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Whether GIF attachments are allowed').setRequired(true)))
    .addSubcommand(sub => sub.setName('duplicates').setDescription('Enable or disable duplicate GIF DM warnings')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Whether duplicate DM warnings are enabled').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List Media-Share channels'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      const limit = interaction.options.getInteger('limit') ?? 50;
      db.prepare('INSERT OR REPLACE INTO media_share_channels (guild_id, channel_id, gif_limit) VALUES (?, ?, ?)')
        .run(guildId, channel.id, limit);
      await logToModChannel(interaction.guild, 'Media-Share added', `Channel: ${channel}\nLimit: ${limit}`);
      return interaction.reply({ content: `${channel} is now a Media-Share channel with limit ${limit}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('DELETE FROM media_share_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      return interaction.reply({ content: `${channel} is no longer a Media-Share channel.`, ephemeral: true });
    }

    if (sub === 'setlimit') {
      const channel = interaction.options.getChannel('channel');
      const limit = interaction.options.getInteger('limit');
      db.prepare('UPDATE media_share_channels SET gif_limit = ? WHERE guild_id = ? AND channel_id = ?').run(limit, guildId, channel.id);
      return interaction.reply({ content: `${channel} GIF limit set to ${limit}.`, ephemeral: true });
    }

    if (sub === 'attachments') {
      const channel = interaction.options.getChannel('channel');
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      db.prepare('UPDATE media_share_channels SET attachments_enabled = ? WHERE guild_id = ? AND channel_id = ?').run(enabled, guildId, channel.id);
      return interaction.reply({ content: `${channel} attachments are now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }

    if (sub === 'duplicates') {
      const channel = interaction.options.getChannel('channel');
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      db.prepare('UPDATE media_share_channels SET duplicate_warnings_enabled = ? WHERE guild_id = ? AND channel_id = ?').run(enabled, guildId, channel.id);
      return interaction.reply({ content: `${channel} duplicate warnings are now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }

    const rows = db.prepare('SELECT * FROM media_share_channels WHERE guild_id = ?').all(guildId);
    const text = rows.length ? rows.map(r => `<#${r.channel_id}> limit=${r.gif_limit} attachments=${Boolean(r.attachments_enabled)} duplicateDMs=${Boolean(r.duplicate_warnings_enabled)}`).join('\n') : 'No Media-Share channels configured.';
    return interaction.reply({ content: text, ephemeral: true });
  }
};
