const { handleMediaShareMessage } = require('../services/mediaShareService');
const { handleLinkFilterMessage } = require('../services/linkFilterService');
const { awardMessageXp, announceLevelUp } = require('../services/levelingService');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const mediaResult = await handleMediaShareMessage(message);
    if (mediaResult.handled) {
      if (mediaResult.accepted) {
        const levelResult = awardMessageXp(message);
        await announceLevelUp(message, levelResult);
      }
      return;
    }

    const filtered = await handleLinkFilterMessage(message);
    if (filtered) return;

    const levelResult = awardMessageXp(message);
    await announceLevelUp(message, levelResult);
  }
};
