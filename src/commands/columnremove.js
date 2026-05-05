const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isColumnOwnerOrStaff } = require('../utils/permissions');
const { removeColumnMember } = require('../services/columnService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('columnremove')
    .setDescription('Remove a collaborator from a column you own')
    .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const user = interaction.options.getUser('user');
    if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
      return interaction.reply({ content: 'Only the column owner or staff can remove collaborators.', ephemeral: true });
    }
    await removeColumnMember(interaction.guild, channel, user);
    return interaction.reply({ content: `${user} removed from ${channel}.`, ephemeral: true });
  }
};
