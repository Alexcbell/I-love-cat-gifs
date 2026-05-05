const { PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { logToModChannel } = require('./logService');

async function createColumn(interaction, owner, typeName, channelName) {
  const guildId = interaction.guild.id;
  const type = db.prepare('SELECT * FROM channel_types WHERE guild_id = ? AND type_name = ?').get(guildId, typeName);
  if (!type) throw new Error(`Unknown column type: ${typeName}`);

  const safeName = channelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 90);

  const channel = await interaction.guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: type.category_id,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
      },
      {
        id: owner.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
      }
    ]
  });

  db.prepare(`
    INSERT INTO columns (guild_id, channel_id, owner_id, type_name, gif_limit)
    VALUES (?, ?, ?, ?, NULL)
  `).run(guildId, channel.id, owner.id, typeName);

  db.prepare(`
    INSERT OR IGNORE INTO media_share_channels (guild_id, channel_id, gif_limit)
    VALUES (?, ?, 50)
  `).run(guildId, channel.id);

  await logToModChannel(interaction.guild, 'Column created', `Channel: ${channel}\nOwner: ${owner}\nType: ${typeName}`);
  return channel;
}

async function addColumnMember(guild, channel, user) {
  const column = db.prepare('SELECT * FROM columns WHERE guild_id = ? AND channel_id = ?').get(guild.id, channel.id);
  if (!column) throw new Error('That channel is not a registered column.');

  db.prepare('INSERT OR IGNORE INTO column_members (guild_id, channel_id, user_id) VALUES (?, ?, ?)')
    .run(guild.id, channel.id, user.id);

  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
    AttachFiles: true,
    EmbedLinks: true
  });

  await logToModChannel(guild, 'Column member added', `Channel: ${channel}\nUser: ${user}`);
}

async function removeColumnMember(guild, channel, user) {
  db.prepare('DELETE FROM column_members WHERE guild_id = ? AND channel_id = ? AND user_id = ?')
    .run(guild.id, channel.id, user.id);

  await channel.permissionOverwrites.delete(user.id).catch(() => null);
  await logToModChannel(guild, 'Column member removed', `Channel: ${channel}\nUser: ${user}`);
}

function getColumnTeam(guildId, channelId) {
  const column = db.prepare('SELECT * FROM columns WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId);
  const members = db.prepare('SELECT * FROM column_members WHERE guild_id = ? AND channel_id = ?').all(guildId, channelId);
  return { column, members };
}

module.exports = { createColumn, addColumnMember, removeColumnMember, getColumnTeam };
