const db = require('../database/db');

const DEFAULT_PUBLIC_UPDATES_CHANNEL_ID = '1501699868224131184';
const DEFAULT_ADMIN_UPDATES_CHANNEL_ID = '1501702021374546071';

const PUBLIC_UPDATES = [
  {
    id: '2026-05-member-gif-tools',
    content: [
      'Hii~ I got a few new toys for everyone!',
      '',
      '- `/gif` can pull a random GIF from the archives.',
      '- `/gif mine:true` finds one of your own saved GIFs.',
      '- `/gif user:@someone` or `/gif channel:#channel` can narrow the search.',
      '- Column owners can now use `/column lock`, `/column unlock`, `/column rename`, `/column syncperms`, `/column gifonly`, and `/column captions`.',
      '',
      "Duplicate GIF notices are just friendly heads-ups. You don't have to delete anything unless you want to!"
    ].join('\n')
  }
];

const ADMIN_UPDATES = [
  {
    id: '2026-05-member-gif-tools-admin',
    content: [
      'Bot update report: member GIF tools and column controls',
      '',
      'Member-facing changes:',
      '- Added `/gif` random archived GIF picker.',
      '- Added `/gif mine:true`, `/gif user:@user`, and `/gif channel:#channel` filters.',
      '- Duplicate GIF DMs now clarify deletion is optional.',
      '- Public update notes post once to the configured public updates channel.',
      '',
      'Column changes:',
      '- Added `/column info`, `/column syncperms`, `/column lock`, `/column unlock`, `/column rename`, `/column archive`, `/column gifonly`, and `/column captions`.',
      '- New and synced column permissions hide @everyone and unverified, give member role view-only, and give owner/collabs write unless locked or archived.',
      '- Helper, Moderator, Admin, and configured staff roles are recognized as staff.',
      '',
      'Media-share changes:',
      '- GIF-only deletion now defaults off.',
      '- `/mediashare gifonly` toggles non-GIF deletion.',
      '- `/mediashare captions` allows text captions alongside GIFs.',
      '- Users with Administrator or Manage Server permissions are protected from bot message deletion.',
      '',
      'Admin tools:',
      '- Added `/bot health`.',
      '- Added `/bot announce` for manual public update posts.',
      '- Added configurable member, unverified, public updates, and admin updates channels.',
      '',
      'Deployment reminder:',
      '- Run `npm run deploy` after pulling this update so Discord receives the new slash commands.'
    ].join('\n')
  }
];

async function postPublicUpdates(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = db.prepare('SELECT public_updates_channel_id FROM guild_config WHERE guild_id = ?').get(guild.id);
    const channelId = config?.public_updates_channel_id || DEFAULT_PUBLIC_UPDATES_CHANNEL_ID;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) continue;

    for (const update of PUBLIC_UPDATES) {
      const alreadyPosted = db.prepare('SELECT 1 FROM public_update_posts WHERE guild_id = ? AND update_id = ?').get(guild.id, update.id);
      if (alreadyPosted) continue;

      const sent = await channel.send(update.content).then(() => true).catch(() => false);
      if (sent) {
        db.prepare('INSERT INTO public_update_posts (guild_id, update_id) VALUES (?, ?)').run(guild.id, update.id);
      }
    }
  }
}

async function postAdminUpdates(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = db.prepare('SELECT admin_updates_channel_id FROM guild_config WHERE guild_id = ?').get(guild.id);
    const channelId = config?.admin_updates_channel_id || DEFAULT_ADMIN_UPDATES_CHANNEL_ID;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) continue;

    for (const update of ADMIN_UPDATES) {
      const alreadyPosted = db.prepare('SELECT 1 FROM public_update_posts WHERE guild_id = ? AND update_id = ?').get(guild.id, update.id);
      if (alreadyPosted) continue;

      const sent = await channel.send(update.content).then(() => true).catch(() => false);
      if (sent) {
        db.prepare('INSERT INTO public_update_posts (guild_id, update_id) VALUES (?, ?)').run(guild.id, update.id);
      }
    }
  }
}

module.exports = { postPublicUpdates, postAdminUpdates };
