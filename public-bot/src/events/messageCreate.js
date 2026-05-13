const { getGifItemsFromMessage } = require('../utils/gifUtils');
const { recordGifMessage } = require('../services/gifStore');
const { handleGifReply } = require('../services/imageToGifService');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const handledGifReply = await handleGifReply(message);
    if (handledGifReply) return;

    const gifs = getGifItemsFromMessage(message);
    for (const gif of gifs) recordGifMessage(message, gif);
  }
};
