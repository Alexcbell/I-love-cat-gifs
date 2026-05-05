const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      modlog_channel_id TEXT,
      staff_role_id TEXT,
      booster_role_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS media_share_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      gif_limit INTEGER NOT NULL DEFAULT 50,
      attachments_enabled INTEGER NOT NULL DEFAULT 1,
      duplicate_warnings_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS link_filter_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS channel_types (
      guild_id TEXT NOT NULL,
      type_name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, type_name)
    );

    CREATE TABLE IF NOT EXISTS columns (
      guild_id TEXT NOT NULL,
      channel_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      type_name TEXT NOT NULL,
      gif_limit INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS column_members (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS gif_messages (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      normalized_url TEXT NOT NULL,
      message_url TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_gif_messages_channel_created
      ON gif_messages (guild_id, channel_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_gif_messages_url
      ON gif_messages (guild_id, normalized_url);
  `);
}

module.exports = { initSchema };
