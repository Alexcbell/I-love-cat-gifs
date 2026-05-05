const db = require('../database/db');
const { hasOnlyGifContent, getGifItemsFromMessage } = require('../utils/gifUtils');
const { hasBoosterRole } = require('../utils/permissions');
const { findDuplicate, warnDuplicateUser } = require('./duplicateService');
const { logToModChannel } = require('./logService');

function getMediaShareConfig(guildId, channelId) {
  return db.prepare('SELECT * FROM media_share_channels WHERE guild_id = ? AND channel_id = ?')
    .get(guildId, channelId);
}

function getColumn(guildId, channelId) {
  return db.prepare('SELECT * FROM columns WHERE guild_id = ? AND channel_id = ?')
    .get(guildId, channelId);
}

function getEffectiveLimit(message, mediaConfig) {
  const column = getColumn(message.guild.id, message.channel.id);
  if (column) {
    if (column.owner_id === message.author.id && hasBoosterRole(message.member)) return null;
    if (column.gif_limit === null || column.gif_limit === undefined) return mediaConfig.gif_limit;
    if (column.gif_limit < 0) return null;
    return column.gif_limit;
  }
  return mediaConfig.gif_limit;
}

async function deleteOrReply(message, reason) {
  const deleted = await message.delete().then(() => true).catch(() => false);
  if (!deleted) {
    await message.reply(`This message should not be here :(\nReason: ${reason}`).catch(() => null);
  }
  await logToModChannel(message.guild, 'Media-Share rule triggered', `Channel: ${message.channel}\nUser: ${message.author}\nReason: ${reason}\nDeleted: ${deleted ? 'yes' : 'no'}`);
}

function recordGifMessage(message, gifItem) {
  db.prepare(`
    INSERT OR REPLACE INTO gif_messages
    (guild_id, channel_id, message_id, user_id, normalized_url, message_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    message.guild.id,
    message.channel.id,
    message.id,
    message.author.id,
    gifItem.normalizedUrl,
    message.url,
    Math.floor(message.createdTimestamp / 1000)
  );
}

async function enforceLimit(message, limit) {
  if (limit === null || limit === undefined || limit < 0) return;

  const rows = db.prepare(`
    SELECT * FROM gif_messages
    WHERE guild_id = ? AND channel_id = ?
    ORDER BY created_at ASC
  `).all(message.guild.id, message.channel.id);

  const extra = rows.length - limit;
  if (extra <= 0) return;

  const rowsToDelete = rows.slice(0, extra);
  for (const row of rowsToDelete) {
    const oldMessage = await message.channel.messages.fetch(row.message_id).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => null);
    db.prepare('DELETE FROM gif_messages WHERE message_id = ?').run(row.message_id);
  }

  await logToModChannel(message.guild, 'GIF limit cleanup', `Channel: ${message.channel}\nLimit: ${limit}\nDeleted old GIF messages: ${rowsToDelete.length}`);
}

async function handleMediaShareMessage(message) {
  const mediaConfig = getMediaShareConfig(message.guild.id, message.channel.id);
  if (!mediaConfig) return false;

  const validation = hasOnlyGifContent(message, Boolean(mediaConfig.attachments_enabled));
  if (!validation.ok) {
    await deleteOrReply(message, validation.reason);
    return true;
  }

  const gifs = getGifItemsFromMessage(message);
  for (const gif of gifs) {
    if (mediaConfig.duplicate_warnings_enabled) {
      const duplicate = findDuplicate(message.guild.id, gif.normalizedUrl, message.id);
      if (duplicate) await warnDuplicateUser(message, duplicate);
    }
    recordGifMessage(message, gif);
  }

  await enforceLimit(message, getEffectiveLimit(message, mediaConfig));
  return true;
}

module.exports = { handleMediaShareMessage, getMediaShareConfig };
