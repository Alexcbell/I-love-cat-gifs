const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addSubcommand(sub => sub.setName('modlog').setDescription('Set mod-log channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Mod-log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('staffrole').setDescription('Set staff role')
      .addRoleOption(opt => opt.setName('role').setDescription('Staff role').setRequired(true)))
    .addSubcommand(sub => sub.setName('helperrole').setDescription('Set Helper role')
      .addRoleOption(opt => opt.setName('role').setDescription('Helper role').setRequired(true)))
    .addSubcommand(sub => sub.setName('moderatorrole').setDescription('Set Moderator role')
      .addRoleOption(opt => opt.setName('role').setDescription('Moderator role').setRequired(true)))
    .addSubcommand(sub => sub.setName('adminrole').setDescription('Set Admin role')
      .addRoleOption(opt => opt.setName('role').setDescription('Admin role').setRequired(true)))
    .addSubcommand(sub => sub.setName('boosterrole').setDescription('Set Server Booster role')
      .addRoleOption(opt => opt.setName('role').setDescription('Booster role').setRequired(true)))
    .addSubcommand(sub => sub.setName('memberrole').setDescription('Set member role for column visibility')
      .addRoleOption(opt => opt.setName('role').setDescription('Member role').setRequired(true)))
    .addSubcommand(sub => sub.setName('unverifiedrole').setDescription('Set unverified role hidden from columns')
      .addRoleOption(opt => opt.setName('role').setDescription('Unverified role').setRequired(true)))
    .addSubcommand(sub => sub.setName('updateschannel').setDescription('Set public bot updates channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Public updates channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('adminupdates').setDescription('Set admin bot updates channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Admin updates channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    db.prepare('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)').run(guildId);

    if (sub === 'modlog') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_config SET modlog_channel_id = ? WHERE guild_id = ?').run(channel.id, guildId);
      return interaction.reply({ content: `Mod-log channel set to ${channel}.`, ephemeral: true });
    }

    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET staff_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Staff role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'helperrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET helper_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Helper role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'moderatorrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET moderator_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Moderator role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'adminrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET admin_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Admin role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'boosterrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET booster_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Booster role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'memberrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_config SET member_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({ content: `Column member view role set to ${role}.`, ephemeral: true });
    }

    if (sub === 'updateschannel') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_config SET public_updates_channel_id = ? WHERE guild_id = ?').run(channel.id, guildId);
      return interaction.reply({ content: `Public bot updates channel set to ${channel}.`, ephemeral: true });
    }

    if (sub === 'adminupdates') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_config SET admin_updates_channel_id = ? WHERE guild_id = ?').run(channel.id, guildId);
      return interaction.reply({ content: `Admin bot updates channel set to ${channel}.`, ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    db.prepare('UPDATE guild_config SET unverified_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
    return interaction.reply({ content: `Column hidden unverified role set to ${role}.`, ephemeral: true });
  }
};
