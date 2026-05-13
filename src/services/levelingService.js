const { ChannelType } = require('discord.js');
const db = require('../database/db');
const { getGifItemsFromMessage } = require('../utils/gifUtils');

const BASE_MESSAGE_XP = 10;
const GIF_MESSAGE_XP = BASE_MESSAGE_XP * 2;
const LEVEL_XP_STEP = 100;

function getLevelFromXp(xp = 0) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / LEVEL_XP_STEP));
}

function getXpForLevel(level = 0) {
  return Math.max(0, level * level * LEVEL_XP_STEP);
}

function getRank(guildId, userId) {
  return db.prepare(`
    SELECT COUNT(*) + 1 AS rank
    FROM level_users
    WHERE guild_id = ? AND xp > COALESCE(
      (SELECT xp FROM level_users WHERE guild_id = ? AND user_id = ?),
      -1
    )
  `).get(guildId, guildId, userId).rank;
}

function getUserLevel(guildId, userId) {
  const row = db.prepare('SELECT * FROM level_users WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  const xp = row?.xp ?? 0;
  const level = getLevelFromXp(xp);
  const nextLevelXp = getXpForLevel(level + 1);
  return {
    guildId,
    userId,
    xp,
    level,
    rank: row ? getRank(guildId, userId) : null,
    messageCount: row?.message_count ?? 0,
    gifCount: row?.gif_count ?? 0,
    nextLevelXp,
    xpToNext: nextLevelXp - xp
  };
}

function getLeaderboard(guildId, limit = 10) {
  return db.prepare(`
    SELECT user_id, xp, message_count, gif_count
    FROM level_users
    WHERE guild_id = ?
    ORDER BY xp DESC, message_count DESC, user_id ASC
    LIMIT ?
  `).all(guildId, limit).map((row, index) => ({
    ...row,
    rank: index + 1,
    level: getLevelFromXp(row.xp)
  }));
}

function awardMessageXp(message, { silent = false } = {}) {
  if (!message.guild || message.author.bot) return { awarded: false, reason: 'ignored' };

  const existing = db.prepare('SELECT 1 FROM level_messages WHERE message_id = ?').get(message.id);
  if (existing) return { awarded: false, reason: 'duplicate' };

  const hasGif = getGifItemsFromMessage(message).length > 0;
  const xpAwarded = hasGif ? GIF_MESSAGE_XP : BASE_MESSAGE_XP;
  const createdAt = Math.floor(message.createdTimestamp / 1000);

  const previous = getUserLevel(message.guild.id, message.author.id);

  const insertMessage = db.prepare(`
    INSERT INTO level_messages
    (guild_id, message_id, channel_id, user_id, xp_awarded, has_gif, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertUser = db.prepare(`
    INSERT INTO level_users
    (guild_id, user_id, xp, message_count, gif_count, last_message_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, unixepoch())
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      xp = xp + excluded.xp,
      message_count = message_count + 1,
      gif_count = gif_count + excluded.gif_count,
      last_message_at = MAX(COALESCE(last_message_at, 0), excluded.last_message_at),
      updated_at = unixepoch()
  `);

  const record = db.transaction(() => {
    insertMessage.run(
      message.guild.id,
      message.id,
      message.channel.id,
      message.author.id,
      xpAwarded,
      hasGif ? 1 : 0,
      createdAt
    );
    upsertUser.run(
      message.guild.id,
      message.author.id,
      xpAwarded,
      hasGif ? 1 : 0,
      createdAt
    );
  });

  record();

  const current = getUserLevel(message.guild.id, message.author.id);
  return {
    awarded: true,
    xpAwarded,
    hasGif,
    previousLevel: previous.level,
    currentLevel: current.level,
    leveledUp: !silent && current.level > previous.level
  };
}

async function announceLevelUp(message, result) {
  if (!result?.leveledUp) return;
  await message.channel.send(`${message.author} reached level ${result.currentLevel}!`).catch(() => null);
}

function canScanChannel(channel) {
  return channel?.type === ChannelType.GuildText && channel.messages?.fetch;
}

async function scanChannelHistory(channel, { limit = 1000, before } = {}) {
  if (!canScanChannel(channel)) {
    return { channelId: channel?.id, scanned: 0, awarded: 0, skipped: 0 };
  }

  let scanned = 0;
  let awarded = 0;
  let skipped = 0;
  let cursor = before;

  while (scanned < limit) {
    const batchSize = Math.min(100, limit - scanned);
    const options = { limit: batchSize };
    if (cursor) options.before = cursor;

    const messages = await channel.messages.fetch(options).catch(() => null);
    if (!messages?.size) break;

    const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const message of ordered) {
      scanned += 1;
      const result = awardMessageXp(message, { silent: true });
      if (result.awarded) awarded += 1;
      else skipped += 1;
    }

    cursor = messages.last()?.id;
    if (messages.size < batchSize) break;
  }

  return { channelId: channel.id, scanned, awarded, skipped };
}

module.exports = {
  BASE_MESSAGE_XP,
  GIF_MESSAGE_XP,
  LEVEL_XP_STEP,
  getLevelFromXp,
  getXpForLevel,
  getUserLevel,
  getLeaderboard,
  awardMessageXp,
  announceLevelUp,
  scanChannelHistory
};
