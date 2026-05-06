const { PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { getGuildConfig } = require('../utils/permissions');
const { logToModChannel } = require('./logService');

const DEFAULT_MEMBER_ROLE_ID = '1501345523368464456';
const DEFAULT_UNVERIFIED_ROLE_ID = '1501346525819699342';

function getColumnRoleIds(guildId) {
  const config = getGuildConfig(guildId);
  return {
    staffRoleId: config.staff_role_id,
    memberRoleId: config.member_role_id || DEFAULT_MEMBER_ROLE_ID,
    unverifiedRoleId: config.unverified_role_id || DEFAULT_UNVERIFIED_ROLE_ID
  };
}

function getWriterOverwrite(id, canWrite = true) {
  return {
    id,
    allow: [PermissionFlagsBits.ViewChannel, ...(canWrite ? [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] : [])],
    deny: canWrite ? [] : [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
  };
}

function getColumnPermissionOverwrites(guild, column, members = []) {
  const { staffRoleId, memberRoleId, unverifiedRoleId } = getColumnRoleIds(guild.id);
  const canWrite = !column.locked && !column.archived;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
    },
    getWriterOverwrite(column.owner_id, canWrite)
  ];

  if (guild.roles.cache.has(memberRoleId)) {
    overwrites.push({
      id: memberRoleId,
      allow: [PermissionFlagsBits.ViewChannel],
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
    });
  }

  if (guild.roles.cache.has(unverifiedRoleId)) {
    overwrites.push({
      id: unverifiedRoleId,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
    });
  }

  if (staffRoleId && guild.roles.cache.has(staffRoleId)) overwrites.push(getWriterOverwrite(staffRoleId, !column.archived));
  for (const member of members) overwrites.push(getWriterOverwrite(member.user_id, canWrite));

  return overwrites;
}

async function createColumn(interaction, owner, typeName, channelName) {
  const guildId = interaction.guild.id;
  const type = db.prepare('SELECT * FROM channel_types WHERE guild_id = ? AND type_name = ?').get(guildId, typeName);
  if (!type) throw new Error(`Unknown column type: ${typeName}`);

  const safeName = channelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 90);

  const columnTemplate = { owner_id: owner.id, locked: 0, archived: 0 };
  const channel = await interaction.guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: type.category_id,
    permissionOverwrites: getColumnPermissionOverwrites(interaction.guild, columnTemplate)
  });

  db.prepare(`
    INSERT INTO columns (guild_id, channel_id, owner_id, type_name, gif_limit)
    VALUES (?, ?, ?, ?, NULL)
  `).run(guildId, channel.id, owner.id, typeName);

  db.prepare(`
    INSERT OR IGNORE INTO media_share_channels (guild_id, channel_id, gif_limit)
    VALUES (?, ?, 50)
  `).run(guildId, channel.id);

  await channel.send(`${owner}! Your channel is ready~ have fun posting your GIFs!`).catch(() => null);
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
    SendMessages: !column.locked && !column.archived,
    AttachFiles: !column.locked && !column.archived,
    EmbedLinks: !column.locked && !column.archived
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

async function syncColumnPermissions(guild, channel) {
  const { column, members } = getColumnTeam(guild.id, channel.id);
  if (!column) throw new Error('That channel is not a registered column.');

  await channel.permissionOverwrites.set(getColumnPermissionOverwrites(guild, column, members));
  await logToModChannel(guild, 'Column permissions synced', `Channel: ${channel}`);
}

async function setColumnLocked(guild, channel, locked) {
  const column = db.prepare('SELECT * FROM columns WHERE guild_id = ? AND channel_id = ?').get(guild.id, channel.id);
  if (!column) throw new Error('That channel is not a registered column.');
  if (column.archived) throw new Error('Archived columns cannot be locked or unlocked.');

  db.prepare('UPDATE columns SET locked = ? WHERE guild_id = ? AND channel_id = ?').run(locked ? 1 : 0, guild.id, channel.id);
  await syncColumnPermissions(guild, channel);
  await logToModChannel(guild, locked ? 'Column locked' : 'Column unlocked', `Channel: ${channel}`);
}

async function archiveColumn(guild, channel) {
  const column = db.prepare('SELECT * FROM columns WHERE guild_id = ? AND channel_id = ?').get(guild.id, channel.id);
  if (!column) throw new Error('That channel is not a registered column.');

  db.prepare('UPDATE columns SET archived = 1, locked = 1 WHERE guild_id = ? AND channel_id = ?').run(guild.id, channel.id);
  await syncColumnPermissions(guild, channel);
  await channel.setName(`archived-${channel.name}`.slice(0, 100)).catch(() => null);
  await logToModChannel(guild, 'Column archived', `Channel: ${channel}`);
}

module.exports = {
  createColumn,
  addColumnMember,
  removeColumnMember,
  getColumnTeam,
  syncColumnPermissions,
  setColumnLocked,
  archiveColumn,
  getColumnRoleIds
};
