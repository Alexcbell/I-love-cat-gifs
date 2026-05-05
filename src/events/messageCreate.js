const { handleMediaShareMessage } = require('../services/mediaShareService');
const { handleLinkFilterMessage } = require('../services/linkFilterService');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const handledMedia = await handleMediaShareMessage(message);
    if (handledMedia) return;

    await handleLinkFilterMessage(message);
  }
};
