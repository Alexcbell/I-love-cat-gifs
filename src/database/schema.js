const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      modlog_channel_id TEXT,
      staff_role_id TEXT,
      helper_role_id TEXT NOT NULL DEFAULT '1459616304179712104',
      moderator_role_id TEXT NOT NULL DEFAULT '1459616304179712105',
      admin_role_id TEXT NOT NULL DEFAULT '1459616304179712106',
      booster_role_id TEXT,
      member_role_id TEXT NOT NULL DEFAULT '1501345523368464456',
      unverified_role_id TEXT NOT NULL DEFAULT '1501346525819699342',
      public_updates_channel_id TEXT NOT NULL DEFAULT '1501699868224131184',
      admin_updates_channel_id TEXT NOT NULL DEFAULT '1501702021374546071',
      jail_role_id TEXT,
      jail_category_id TEXT,
      jail_appeal_message TEXT NOT NULL DEFAULT 'You have been jailed. Use this channel to appeal your punishment or explain your actions. A Moderator or Admin will review it when available.',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS media_share_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      gif_limit INTEGER NOT NULL DEFAULT 50,
      attachments_enabled INTEGER NOT NULL DEFAULT 1,
      duplicate_warnings_enabled INTEGER NOT NULL DEFAULT 1,
      gif_only_enabled INTEGER NOT NULL DEFAULT 0,
      captions_enabled INTEGER NOT NULL DEFAULT 0,
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
      locked INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS public_update_posts (
      guild_id TEXT NOT NULL,
      update_id TEXT NOT NULL,
      posted_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, update_id)
    );

    CREATE TABLE IF NOT EXISTS level_users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      gif_count INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS level_messages (
      guild_id TEXT NOT NULL,
      message_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp_awarded INTEGER NOT NULL,
      has_gif INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS jail_cases (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      jailed_by TEXT NOT NULL,
      released_by TEXT,
      reason TEXT NOT NULL,
      public_announce INTEGER NOT NULL DEFAULT 0,
      removed_member_role INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      released_at INTEGER,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_gif_messages_channel_created
      ON gif_messages (guild_id, channel_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_gif_messages_url
      ON gif_messages (guild_id, normalized_url);

    CREATE INDEX IF NOT EXISTS idx_level_users_guild_xp
      ON level_users (guild_id, xp DESC);

    CREATE INDEX IF NOT EXISTS idx_level_messages_guild_channel_created
      ON level_messages (guild_id, channel_id, created_at);
  `);

  addColumnIfMissing('guild_config', 'member_role_id', "TEXT NOT NULL DEFAULT '1501345523368464456'");
  addColumnIfMissing('guild_config', 'unverified_role_id', "TEXT NOT NULL DEFAULT '1501346525819699342'");
  addColumnIfMissing('guild_config', 'public_updates_channel_id', "TEXT NOT NULL DEFAULT '1501699868224131184'");
  addColumnIfMissing('guild_config', 'admin_updates_channel_id', "TEXT NOT NULL DEFAULT '1501702021374546071'");
  addColumnIfMissing('guild_config', 'helper_role_id', "TEXT NOT NULL DEFAULT '1459616304179712104'");
  addColumnIfMissing('guild_config', 'moderator_role_id', "TEXT NOT NULL DEFAULT '1459616304179712105'");
  addColumnIfMissing('guild_config', 'admin_role_id', "TEXT NOT NULL DEFAULT '1459616304179712106'");
  addColumnIfMissing('guild_config', 'jail_role_id', 'TEXT');
  addColumnIfMissing('guild_config', 'jail_category_id', 'TEXT');
  addColumnIfMissing('guild_config', 'jail_appeal_message', "TEXT NOT NULL DEFAULT 'You have been jailed. Use this channel to appeal your punishment or explain your actions. A Moderator or Admin will review it when available.'");
  addColumnIfMissing('jail_cases', 'removed_member_role', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('media_share_channels', 'gif_only_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('media_share_channels', 'captions_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('columns', 'locked', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('columns', 'archived', 'INTEGER NOT NULL DEFAULT 0');
}

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some(column => column.name === columnName);
  if (!exists) db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

module.exports = { initSchema };
