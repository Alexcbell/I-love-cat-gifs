const db = require('../database/db');

function findDuplicate(guildId, normalizedUrl, currentMessageId) {
  return db.prepare(`
    SELECT * FROM gif_messages
    WHERE guild_id = ? AND normalized_url = ? AND message_id != ?
    ORDER BY created_at ASC
    LIMIT 1
  `).get(guildId, normalizedUrl, currentMessageId);
}

async function warnDuplicateUser(message, duplicateRow) {
  if (!duplicateRow) return;
  const body = [
    'Duplicate GIF detected.',
    '',
    `Your message: ${message.url}`,
    `Original message: ${duplicateRow.message_url}`
  ].join('\n');

  await message.author.send(body).catch(async () => {
    await message.reply('Duplicate GIF detected, but I could not DM you. Please check your privacy settings.').catch(() => null);
  });
}

module.exports = { findDuplicate, warnDuplicateUser };
