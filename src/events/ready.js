const { postPublicUpdates, postAdminUpdates } = require('../services/publicUpdateService');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    await postPublicUpdates(client);
    await postAdminUpdates(client);
  }
};
