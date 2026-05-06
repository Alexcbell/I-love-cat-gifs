const { PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

function getGuildConfig(guildId) {
  db.prepare('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)').run(guildId);
  return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const config = getGuildConfig(member.guild.id);
  const staffRoleIds = [
    config.staff_role_id,
    config.helper_role_id,
    config.moderator_role_id,
    config.admin_role_id
  ].filter(Boolean);
  return staffRoleIds.some(roleId => member.roles.cache.has(roleId));
}

function isColumnOwnerOrStaff(member, channelId) {
  if (isStaff(member)) return true;
  const row = db.prepare('SELECT owner_id FROM columns WHERE guild_id = ? AND channel_id = ?')
    .get(member.guild.id, channelId);
  return Boolean(row && row.owner_id === member.id);
}

function isColumnMemberOrOwnerOrStaff(member, channelId) {
  if (isColumnOwnerOrStaff(member, channelId)) return true;
  const row = db.prepare('SELECT 1 FROM column_members WHERE guild_id = ? AND channel_id = ? AND user_id = ?')
    .get(member.guild.id, channelId, member.id);
  return Boolean(row);
}

function hasBoosterRole(member) {
  const config = getGuildConfig(member.guild.id);
  return Boolean(config.booster_role_id && member.roles.cache.has(config.booster_role_id));
}

async function hasServerManageMessageImmunity(message) {
  if (!message?.guild || !message.author) return false;

  let member = message.member;
  if (!member) {
    member = await message.guild.members.fetch(message.author.id).catch(() => null);
  }

  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator)
    || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  getGuildConfig,
  isStaff,
  isColumnOwnerOrStaff,
  isColumnMemberOrOwnerOrStaff,
  hasBoosterRole,
  hasServerManageMessageImmunity
};
