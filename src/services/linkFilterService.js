const db = require('../database/db');
const { extractUrls, isGifUrl, hasAnyLink } = require('../utils/gifUtils');
const { hasServerManageMessageImmunity } = require('../utils/permissions');
const { logToModChannel } = require('./logService');

function isLinkFiltered(guildId, channelId) {
  return Boolean(db.prepare('SELECT 1 FROM link_filter_channels WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId));
}

async function handleLinkFilterMessage(message) {
  if (!isLinkFiltered(message.guild.id, message.channel.id)) return false;
  if (!hasAnyLink(message)) return false;

  const urls = extractUrls(message.content);
  const hasNonGif = urls.some(url => !isGifUrl(url));
  if (!hasNonGif) return false;

  const warning = 'Links other than gifs are not allowed, if this was a mistake, please make a ticket.';
  const immune = await hasServerManageMessageImmunity(message);
  const deleted = immune ? false : await message.delete().then(() => true).catch(() => false);
  await message.channel.send({ content: `${message.author} ${warning}` }).then(sent => {
    setTimeout(() => sent.delete().catch(() => null), 10000);
  }).catch(() => null);

  await logToModChannel(message.guild, 'Non-GIF link filtered', `Channel: ${message.channel}\nUser: ${message.author}\nDeleted: ${deleted ? 'yes' : 'no'}${immune ? '\nSkipped delete: user has server management permissions' : ''}`);
  return true;
}

module.exports = { handleLinkFilterMessage };
