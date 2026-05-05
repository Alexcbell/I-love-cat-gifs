const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isColumnOwnerOrStaff } = require('../utils/permissions');
const { addColumnMember } = require('../services/columnService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('columnadd')
    .setDescription('Add a collaborator to a column you own')
    .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const user = interaction.options.getUser('user');
    if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
      return interaction.reply({ content: 'Only the column owner or staff can add collaborators.', ephemeral: true });
    }
    await addColumnMember(interaction.guild, channel, user);
    return interaction.reply({ content: `${user} added to ${channel}.`, ephemeral: true });
  }
};
