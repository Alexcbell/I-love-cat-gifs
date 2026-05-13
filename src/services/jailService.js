const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { getGuildConfig } = require('../utils/permissions');

const DEFAULT_JAIL_MESSAGE = 'You have been jailed. Use this channel to appeal your punishment or explain your actions. A Moderator or Admin will review it when available.';

function safeChannelName(user) {
  const base = user.username || user.globalName || 'user';
  const safe = base.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safe || 'user'}-appeal`.slice(0, 100);
}

async function ensureJailRole(guild) {
  const config = getGuildConfig(guild.id);
  let role = config.jail_role_id ? await guild.roles.fetch(config.jail_role_id).catch(() => null) : null;
  if (!role) role = guild.roles.cache.find(candidate => candidate.name.toLowerCase() === 'jail') || null;

  if (!role) {
    role = await guild.roles.create({
      name: 'Jail',
      permissions: [],
      reason: 'Jail system setup'
    });
  }

  if (role.id !== config.jail_role_id) {
    db.prepare('UPDATE guild_config SET jail_role_id = ? WHERE guild_id = ?').run(role.id, guild.id);
  }

  return role;
}

async function ensureJailCategory(guild) {
  const config = getGuildConfig(guild.id);
  let category = config.jail_category_id ? await guild.channels.fetch(config.jail_category_id).catch(() => null) : null;

  if (!category || category.type !== ChannelType.GuildCategory) {
    category = await guild.channels.create({
      name: 'Jail Appeals',
      type: ChannelType.GuildCategory,
      permissionOverwrites: getAppealStaffOverwrites(guild)
    });
    db.prepare('UPDATE guild_config SET jail_category_id = ? WHERE guild_id = ?').run(category.id, guild.id);
  }

  return category;
}

function getAppealStaffOverwrites(guild, jailedUserId = null) {
  const config = getGuildConfig(guild.id);
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    }
  ];

  for (const roleId of [config.moderator_role_id, config.admin_role_id].filter(Boolean)) {
    if (!guild.roles.cache.has(roleId)) continue;
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  if (jailedUserId) {
    overwrites.push({
      id: jailedUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    });
  }

  return overwrites;
}

async function syncJailRoleDenies(guild, jailRoleId, appealCategoryId) {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const edits = [];

  for (const channel of channels.values()) {
    if (!channel?.permissionOverwrites || channel.id === appealCategoryId || channel.parentId === appealCategoryId) continue;
    edits.push(channel.permissionOverwrites.edit(jailRoleId, {
      ViewChannel: false,
      SendMessages: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false
    }, { reason: 'Jail role visibility lock' }).catch(() => null));
  }

  await Promise.all(edits);
}

async function createAppealChannel(guild, member, category, jailRole, jailedBy, reason) {
  const existing = db.prepare('SELECT channel_id FROM jail_cases WHERE guild_id = ? AND user_id = ? AND active = 1')
    .get(guild.id, member.id);
  const existingChannel = existing?.channel_id ? await guild.channels.fetch(existing.channel_id).catch(() => null) : null;
  if (existingChannel) return existingChannel;

  const channel = await guild.channels.create({
    name: safeChannelName(member.user),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      ...getAppealStaffOverwrites(guild, member.id),
      {
        id: jailRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      }
    ],
    reason: `Jail appeal channel for ${member.user.tag}`
  });

  const config = getGuildConfig(guild.id);
  await channel.send([
    `${member}`,
    config.jail_appeal_message || DEFAULT_JAIL_MESSAGE,
    '',
    `Reason: ${reason}`,
    `Jailed by: ${jailedBy}`
  ].join('\n')).catch(() => null);

  return channel;
}

async function removeMemberRoleForJail(member, jailedBy, reason) {
  const config = getGuildConfig(member.guild.id);
  const memberRoleId = config.member_role_id;
  if (!memberRoleId || !member.roles.cache.has(memberRoleId)) return false;

  const memberRole = await member.guild.roles.fetch(memberRoleId).catch(() => null);
  if (!memberRole) return false;

  await member.roles.remove(memberRole, `Jailed by ${jailedBy.tag}: ${reason}`);
  return true;
}

async function restoreMemberRoleAfterJail(member, releasedBy, jailCase) {
  if (!jailCase?.removed_member_role) return false;

  const config = getGuildConfig(member.guild.id);
  const memberRoleId = config.member_role_id;
  if (!memberRoleId || member.roles.cache.has(memberRoleId)) return false;

  const memberRole = await member.guild.roles.fetch(memberRoleId).catch(() => null);
  if (!memberRole) return false;

  await member.roles.add(memberRole, `Released from jail by ${releasedBy.tag}`);
  return true;
}

async function jailMember({ guild, member, jailedBy, reason, publicAnnounce }) {
  const jailRole = await ensureJailRole(guild);
  const category = await ensureJailCategory(guild);
  await syncJailRoleDenies(guild, jailRole.id, category.id);
  const removedMemberRole = await removeMemberRoleForJail(member, jailedBy, reason);
  await member.roles.add(jailRole, `Jailed by ${jailedBy.tag}: ${reason}`);
  const channel = await createAppealChannel(guild, member, category, jailRole, jailedBy, reason);

  db.prepare(`
    INSERT INTO jail_cases (guild_id, user_id, channel_id, jailed_by, released_by, reason, public_announce, removed_member_role, active, created_at, released_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 1, unixepoch(), NULL)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      jailed_by = excluded.jailed_by,
      released_by = NULL,
      reason = excluded.reason,
      public_announce = excluded.public_announce,
      removed_member_role = CASE
        WHEN jail_cases.removed_member_role = 1 OR excluded.removed_member_role = 1 THEN 1
        ELSE 0
      END,
      active = 1,
      created_at = unixepoch(),
      released_at = NULL
  `).run(guild.id, member.id, channel.id, jailedBy.id, reason, publicAnnounce ? 1 : 0, removedMemberRole ? 1 : 0);

  return { jailRole, channel };
}

async function releaseMember({ guild, member, releasedBy }) {
  const config = getGuildConfig(guild.id);
  const jailRole = config.jail_role_id ? await guild.roles.fetch(config.jail_role_id).catch(() => null) : null;
  if (jailRole && member.roles.cache.has(jailRole.id)) {
    await member.roles.remove(jailRole, `Released from jail by ${releasedBy.tag}`);
  }

  const jailCase = db.prepare('SELECT channel_id, removed_member_role FROM jail_cases WHERE guild_id = ? AND user_id = ? AND active = 1')
    .get(guild.id, member.id);
  await restoreMemberRoleAfterJail(member, releasedBy, jailCase);

  const channel = jailCase?.channel_id ? await guild.channels.fetch(jailCase.channel_id).catch(() => null) : null;
  if (channel?.isTextBased()) {
    await channel.permissionOverwrites.edit(member.id, {
      SendMessages: false,
      AttachFiles: false
    }, { reason: 'Jail release' }).catch(() => null);
    await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => null);
  }

  db.prepare('UPDATE jail_cases SET active = 0, released_by = ?, released_at = unixepoch() WHERE guild_id = ? AND user_id = ?')
    .run(releasedBy.id, guild.id, member.id);

  return { channel };
}

async function enforceActiveJail(member) {
  const jailCase = db.prepare('SELECT * FROM jail_cases WHERE guild_id = ? AND user_id = ? AND active = 1')
    .get(member.guild.id, member.id);
  if (!jailCase) return null;

  const jailRole = await ensureJailRole(member.guild);
  const category = await ensureJailCategory(member.guild);
  await syncJailRoleDenies(member.guild, jailRole.id, category.id);

  const removedMemberRole = await removeMemberRoleForJail(
    member,
    member.client.user,
    jailCase.reason || 'Active jail case'
  );

  if (!member.roles.cache.has(jailRole.id)) {
    await member.roles.add(jailRole, 'Rejoined with an active jail case');
  }

  if (removedMemberRole && !jailCase.removed_member_role) {
    db.prepare('UPDATE jail_cases SET removed_member_role = 1 WHERE guild_id = ? AND user_id = ?')
      .run(member.guild.id, member.id);
  }

  let channel = jailCase.channel_id ? await member.guild.channels.fetch(jailCase.channel_id).catch(() => null) : null;
  if (!channel) {
    channel = await createAppealChannel(
      member.guild,
      member,
      category,
      jailRole,
      member.client.user,
      jailCase.reason || 'Active jail case'
    );
    db.prepare('UPDATE jail_cases SET channel_id = ? WHERE guild_id = ? AND user_id = ?')
      .run(channel.id, member.guild.id, member.id);
  }

  return { jailRole, channel };
}

module.exports = {
  ensureJailRole,
  ensureJailCategory,
  jailMember,
  releaseMember,
  enforceActiveJail
};
