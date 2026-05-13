const { enforceActiveJail } = require('../services/jailService');
const { logToModChannel } = require('../services/logService');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    const result = await enforceActiveJail(member).catch(error => {
      console.error('Failed to enforce active jail on join:', error);
      return null;
    });

    if (!result) return;
    await logToModChannel(
      member.guild,
      'Active jail reapplied',
      `User: ${member.user}\nAppeal: ${result.channel}`
    );
  }
};
