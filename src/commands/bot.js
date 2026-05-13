const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { getGuildConfig, isStaff } = require('../utils/permissions');

function roleStatus(guild, label, roleId) {
  if (!roleId) return `${label}: not set`;
  return guild.roles.cache.has(roleId) ? `${label}: <@&${roleId}>` : `${label}: missing (${roleId})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot utilities')
    .addSubcommand(sub => sub.setName('health').setDescription('Check bot configuration and registered channels'))
    .addSubcommand(sub => sub.setName('announce').setDescription('Post a public bot update')
      .addStringOption(opt => opt.setName('message').setDescription('Update message to post').setRequired(true).setMaxLength(1800)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'announce') {
      const config = getGuildConfig(guildId);
      const channelId = config.public_updates_channel_id;
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.reply({ content: 'I could not find the public updates channel. Set it with `/config updateschannel`.', ephemeral: true });
      }

      const message = interaction.options.getString('message');
      await channel.send(message);
      return interaction.reply({ content: `Posted the update in ${channel}.`, ephemeral: true });
    }

    const config = getGuildConfig(guildId);
    const columns = db.prepare('SELECT * FROM columns WHERE guild_id = ?').all(guildId);
    const mediaChannels = db.prepare('SELECT * FROM media_share_channels WHERE guild_id = ?').all(guildId);
    const types = db.prepare('SELECT * FROM channel_types WHERE guild_id = ?').all(guildId);
    const linkFilters = db.prepare('SELECT * FROM link_filter_channels WHERE guild_id = ?').all(guildId);
    const gifCount = db.prepare('SELECT COUNT(*) AS count FROM gif_messages WHERE guild_id = ?').get(guildId).count;
    const levelUserCount = db.prepare('SELECT COUNT(*) AS count FROM level_users WHERE guild_id = ?').get(guildId).count;
    const levelMessageCount = db.prepare('SELECT COUNT(*) AS count FROM level_messages WHERE guild_id = ?').get(guildId).count;

    const missingColumns = columns.filter(column => !interaction.guild.channels.cache.has(column.channel_id));
    const missingMedia = mediaChannels.filter(channel => !interaction.guild.channels.cache.has(channel.channel_id));
    const missingTypes = types.filter(type => !interaction.guild.channels.cache.has(type.category_id));
    const missingLinkFilters = linkFilters.filter(channel => !interaction.guild.channels.cache.has(channel.channel_id));

    const lines = [
      'Health check:',
      roleStatus(interaction.guild, 'Staff role', config.staff_role_id),
      roleStatus(interaction.guild, 'Helper role', config.helper_role_id),
      roleStatus(interaction.guild, 'Moderator role', config.moderator_role_id),
      roleStatus(interaction.guild, 'Admin role', config.admin_role_id),
      roleStatus(interaction.guild, 'Booster role', config.booster_role_id),
      roleStatus(interaction.guild, 'Jail role', config.jail_role_id),
      roleStatus(interaction.guild, 'Member view role', config.member_role_id),
      roleStatus(interaction.guild, 'Unverified hidden role', config.unverified_role_id),
      `Mod-log: ${config.modlog_channel_id ? `<#${config.modlog_channel_id}>` : 'not set'}`,
      `Jail appeals: ${config.jail_category_id ? `<#${config.jail_category_id}>` : 'not set'}`,
      `Public updates: ${config.public_updates_channel_id ? `<#${config.public_updates_channel_id}>` : 'not set'}`,
      `Admin updates: ${config.admin_updates_channel_id ? `<#${config.admin_updates_channel_id}>` : 'not set'}`,
      `Columns: ${columns.length} (${missingColumns.length} missing channels)`,
      `Media-share channels: ${mediaChannels.length} (${missingMedia.length} missing channels)`,
      `Column types: ${types.length} (${missingTypes.length} missing categories)`,
      `Link filters: ${linkFilters.length} (${missingLinkFilters.length} missing channels)`,
      `Archived GIF records: ${gifCount}`,
      `Level users: ${levelUserCount}`,
      `Level message records: ${levelMessageCount}`
    ];

    const problems = [
      ...missingColumns.map(column => `Missing column channel: ${column.channel_id}`),
      ...missingMedia.map(channel => `Missing media-share channel: ${channel.channel_id}`),
      ...missingTypes.map(type => `Missing category for type ${type.type_name}: ${type.category_id}`),
      ...missingLinkFilters.map(channel => `Missing link-filter channel: ${channel.channel_id}`)
    ];

    if (problems.length) {
      lines.push('', 'Things to clean up:', ...problems.slice(0, 10));
      if (problems.length > 10) lines.push(`...and ${problems.length - 10} more.`);
    }

    return interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }
};
