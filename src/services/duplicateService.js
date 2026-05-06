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
    'Hii~ just wanted to let you know this GIF has been posted before!',
    '',
    `Your post: ${message.url}`,
    `Original post: ${duplicateRow.message_url}`,
    '',
    "You don't have to delete it or anything. I just thought you should know!"
  ].join('\n');

  await message.author.send(body).catch(async () => {
    await message.reply('I tried to whisper you about a duplicate GIF, but your DMs seem closed~').catch(() => null);
  });
}

module.exports = { findDuplicate, warnDuplicateUser };
