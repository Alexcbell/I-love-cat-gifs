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
    .addSubcommand(sub => sub.setName('boosterrole').setDescription('Set Server Booster role')
      .addRoleOption(opt => opt.setName('role').setDescription('Booster role').setRequired(true)))
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

    const role = interaction.options.getRole('role');
    db.prepare('UPDATE guild_config SET booster_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
    return interaction.reply({ content: `Booster role set to ${role}.`, ephemeral: true });
  }
};
