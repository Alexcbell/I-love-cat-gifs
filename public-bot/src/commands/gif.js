const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getRandomGif } = require('../services/gifStore');

function getVisibleTextChannelIds(interaction) {
  return interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .filter(channel => channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ViewChannel))
    .map(channel => channel.id);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Pull a random GIF from this server archive')
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Pick from a specific channel')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addUserOption(option => option
      .setName('user')
      .setDescription('Pick a GIF posted by this user')
      .setRequired(false))
    .addBooleanOption(option => option
      .setName('mine')
      .setDescription('Pick one of your own GIFs')
      .setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const mine = interaction.options.getBoolean('mine') ?? false;
    const user = mine ? interaction.user : interaction.options.getUser('user');
    const visibleChannelIds = getVisibleTextChannelIds(interaction);

    if (channel && !visibleChannelIds.includes(channel.id)) {
      return interaction.reply({ content: "I can't pull GIFs from a channel you can't see.", ephemeral: true });
    }

    const gif = getRandomGif({
      guildId: interaction.guild.id,
      visibleChannelIds,
      channelId: channel?.id,
      userId: user?.id
    });

    if (!gif) {
      return interaction.reply({ content: "I don't have a matching GIF archived yet.", ephemeral: true });
    }

    const source = `<#${gif.channelId}>`;
    return interaction.reply({
      content: `I found this one hiding in the archives~\n${gif.url}\nPosted by ${gif.username} in ${source}: ${gif.messageUrl}`,
      allowedMentions: { parse: [] }
    });
  }
};
