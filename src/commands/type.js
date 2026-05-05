const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('type')
    .setDescription('Manage column types and categories')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a column type')
      .addStringOption(opt => opt.setName('name').setDescription('Type name').setRequired(true))
      .addChannelOption(opt => opt.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a column type')
      .addStringOption(opt => opt.setName('name').setDescription('Type name').setRequired(true)))
    .addSubcommand(sub => sub.setName('setcategory').setDescription('Update a type category')
      .addStringOption(opt => opt.setName('name').setDescription('Type name').setRequired(true))
      .addChannelOption(opt => opt.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List column types'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const name = interaction.options.getString('name').toLowerCase();
      const category = interaction.options.getChannel('category');
      db.prepare('INSERT OR REPLACE INTO channel_types (guild_id, type_name, category_id) VALUES (?, ?, ?)').run(guildId, name, category.id);
      return interaction.reply({ content: `Type **${name}** now points to ${category}.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name').toLowerCase();
      db.prepare('DELETE FROM channel_types WHERE guild_id = ? AND type_name = ?').run(guildId, name);
      return interaction.reply({ content: `Type **${name}** deleted.`, ephemeral: true });
    }

    if (sub === 'setcategory') {
      const name = interaction.options.getString('name').toLowerCase();
      const category = interaction.options.getChannel('category');
      db.prepare('UPDATE channel_types SET category_id = ? WHERE guild_id = ? AND type_name = ?').run(category.id, guildId, name);
      return interaction.reply({ content: `Type **${name}** category updated to ${category}.`, ephemeral: true });
    }

    const rows = db.prepare('SELECT * FROM channel_types WHERE guild_id = ?').all(guildId);
    const text = rows.length ? rows.map(r => `**${r.type_name}** → <#${r.category_id}>`).join('\n') : 'No column types configured.';
    return interaction.reply({ content: text, ephemeral: true });
  }
};
