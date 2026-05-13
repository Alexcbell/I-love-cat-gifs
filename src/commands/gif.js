const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

function getVisibleTextChannelIds(interaction) {
  return interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .filter(channel => channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ViewChannel))
    .map(channel => channel.id);
}

function buildRandomGifQuery({ guildId, channelIds, channel, user }) {
  const conditions = ['guild_id = ?'];
  const params = [];

  params.push(guildId);

  if (channelIds.length === 0) return null;

  conditions.push(`channel_id IN (${channelIds.map(() => '?').join(', ')})`);
  params.push(...channelIds);

  if (channel) {
    conditions.push('channel_id = ?');
    params.push(channel.id);
  }

  if (user) {
    conditions.push('user_id = ?');
    params.push(user.id);
  }

  return {
    sql: `
      SELECT * FROM gif_messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    params
  };
}

async function getPosterName(interaction, userId) {
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (member) return member.displayName;

  const user = await interaction.client.users.fetch(userId).catch(() => null);
  return user?.username || `User ${userId}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Pull a random GIF from the archives')
    .addChannelOption(opt => opt.setName('channel').setDescription('Pick from a specific GIF channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addUserOption(opt => opt.setName('user').setDescription('Pick a GIF posted by this user').setRequired(false))
    .addBooleanOption(opt => opt.setName('mine').setDescription('Pick one of your own GIFs').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const mine = interaction.options.getBoolean('mine') ?? false;
    const user = mine ? interaction.user : interaction.options.getUser('user');
    const visibleChannelIds = getVisibleTextChannelIds(interaction);

    if (channel && !visibleChannelIds.includes(channel.id)) {
      return interaction.reply({ content: "Eep! I can't pull GIFs from a channel you can't see.", ephemeral: true });
    }

    const query = buildRandomGifQuery({
      guildId: interaction.guild.id,
      channelIds: visibleChannelIds,
      channel,
      user
    });

    if (!query) {
      return interaction.reply({ content: "I couldn't find any GIF channels you can see yet~", ephemeral: true });
    }

    const gif = db.prepare(query.sql).get(...query.params);
    if (!gif) {
      return interaction.reply({ content: "I peeked through the archives, but I couldn't find a matching GIF yet~", ephemeral: true });
    }

    const postedBy = await getPosterName(interaction, gif.user_id);
    const source = `<#${gif.channel_id}>`;
    return interaction.reply({
      content: `I found this one hiding in the archives~\n${gif.normalized_url}\nPosted by ${postedBy} in ${source}: ${gif.message_url}`,
      allowedMentions: { parse: [] }
    });
  }
};
