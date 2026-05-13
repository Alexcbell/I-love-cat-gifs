const db = require('../database/db');
const { getGuildConfig } = require('../utils/permissions');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    const jailCase = db.prepare('SELECT 1 FROM jail_cases WHERE guild_id = ? AND user_id = ? AND active = 1')
      .get(newMember.guild.id, newMember.id);
    if (!jailCase) return;

    const config = getGuildConfig(newMember.guild.id);
    if (config.jail_role_id && !newMember.roles.cache.has(config.jail_role_id)) return;

    if (!config.member_role_id || !newMember.roles.cache.has(config.member_role_id)) return;
    if (oldMember.roles.cache.has(config.member_role_id)) return;

    const memberRole = await newMember.guild.roles.fetch(config.member_role_id).catch(() => null);
    if (!memberRole) return;

    await newMember.roles.remove(memberRole, 'Member role removed because user has an active jail case')
      .catch(error => console.error('Failed to remove member role from active jail case:', error));
  }
};
