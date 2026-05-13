const { getGuildConfig } = require('../utils/permissions');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild || !channel.permissionOverwrites) return;

    const config = getGuildConfig(channel.guild.id);
    if (!config.jail_role_id) return;
    if (channel.id === config.jail_category_id || channel.parentId === config.jail_category_id) return;

    await channel.permissionOverwrites.edit(config.jail_role_id, {
      ViewChannel: false,
      SendMessages: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false
    }, { reason: 'Jail role visibility lock' }).catch(() => null);
  }
};
