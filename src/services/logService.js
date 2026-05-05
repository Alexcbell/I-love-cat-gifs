const db = require('../database/db');
const { basicEmbed } = require('../utils/embeds');

async function logToModChannel(guild, title, description) {
  const config = db.prepare('SELECT modlog_channel_id FROM guild_config WHERE guild_id = ?').get(guild.id);
  if (!config?.modlog_channel_id) return;

  const channel = await guild.channels.fetch(config.modlog_channel_id).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel.send({ embeds: [basicEmbed(title, description)] }).catch(() => null);
}

module.exports = { logToModChannel };
