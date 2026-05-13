const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { isStaff, isModeratorOrAbove, isColumnOwnerOrStaff } = require('../utils/permissions');
const {
  createColumn,
  addColumnMember,
  removeColumnMember,
  getColumnTeam,
  syncColumnPermissions,
  setColumnLocked,
  archiveColumn,
  getColumnRoleIds
} = require('../services/columnService');
const { logToModChannel } = require('../services/logService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('column')
    .setDescription('Manage owned GIF columns')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a user-owned GIF column')
      .addUserOption(opt => opt.setName('owner').setDescription('Column owner').setRequired(true))
      .addStringOption(opt => opt.setName('type').setDescription('Column type').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('Channel name').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a registered column')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('transfer').setDescription('Transfer column ownership')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addUserOption(opt => opt.setName('new_owner').setDescription('New owner').setRequired(true)))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a collaborator to your column')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a collaborator from your column')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(sub => sub.setName('team').setDescription('Show a column team')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('info').setDescription('Show column settings and status')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('limit').setDescription('Set a column limit, or unlimited')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(opt => opt.setName('limit').setDescription('Number or unlimited').setRequired(true)))
    .addSubcommand(sub => sub.setName('gifonly').setDescription('Turn GIF-only message deletion on or off')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Whether to delete non-GIF messages').setRequired(true)))
    .addSubcommand(sub => sub.setName('captions').setDescription('Turn GIF captions on or off')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Whether text with GIFs is allowed').setRequired(true)))
    .addSubcommand(sub => sub.setName('syncperms').setDescription('Repair a column permission setup')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('lock').setDescription('Pause owner and collaborator posting')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('unlock').setDescription('Resume owner and collaborator posting')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('rename').setDescription('Rename a column')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true)))
    .addSubcommand(sub => sub.setName('archive').setDescription('Freeze a column without deleting it')
      .addChannelOption(opt => opt.setName('channel').setDescription('Column channel').addChannelTypes(ChannelType.GuildText).setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (['create', 'delete', 'transfer', 'limit', 'archive'].includes(sub) && !isModeratorOrAbove(interaction.member)) {
      return interaction.reply({ content: 'Moderator and above can approve or manage column requests.', ephemeral: true });
    }

    if (sub === 'create') {
      const owner = interaction.options.getUser('owner');
      const typeName = interaction.options.getString('type').toLowerCase();
      const name = interaction.options.getString('name');
      const channel = await createColumn(interaction, owner, typeName, name);
      return interaction.reply({ content: `Created ${channel} for ${owner}.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('DELETE FROM columns WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      db.prepare('DELETE FROM column_members WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      db.prepare('DELETE FROM media_share_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      db.prepare('DELETE FROM gif_messages WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      await channel.delete('Column deleted by bot command').catch(() => null);
      await logToModChannel(interaction.guild, 'Column deleted', `Channel ID: ${channel.id}\nBy: ${interaction.user}`);
      return interaction.reply({ content: 'Column deleted and unregistered.', ephemeral: true });
    }

    if (sub === 'transfer') {
      const channel = interaction.options.getChannel('channel');
      const newOwner = interaction.options.getUser('new_owner');
      const old = db.prepare('SELECT owner_id FROM columns WHERE guild_id = ? AND channel_id = ?').get(guildId, channel.id);
      if (!old) return interaction.reply({ content: 'That channel is not a registered column.', ephemeral: true });
      db.prepare('UPDATE columns SET owner_id = ? WHERE guild_id = ? AND channel_id = ?').run(newOwner.id, guildId, channel.id);
      await channel.permissionOverwrites.delete(old.owner_id).catch(() => null);
      await syncColumnPermissions(interaction.guild, channel);
      await logToModChannel(interaction.guild, 'Column transferred', `Channel: ${channel}\nNew owner: ${newOwner}`);
      return interaction.reply({ content: `${channel} ownership transferred to ${newOwner}.`, ephemeral: true });
    }

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      const user = interaction.options.getUser('user');
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can add collaborators.', ephemeral: true });
      }
      await addColumnMember(interaction.guild, channel, user);
      return interaction.reply({ content: `${user} added to ${channel}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      const user = interaction.options.getUser('user');
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can remove collaborators.', ephemeral: true });
      }
      await removeColumnMember(interaction.guild, channel, user);
      return interaction.reply({ content: `${user} removed from ${channel}.`, ephemeral: true });
    }

    if (sub === 'team') {
      const channel = interaction.options.getChannel('channel');
      const { column, members } = getColumnTeam(guildId, channel.id);
      if (!column) return interaction.reply({ content: 'That channel is not a registered column.', ephemeral: true });
      const text = [`Owner: <@${column.owner_id}>`, members.length ? `Collaborators:\n${members.map(m => `<@${m.user_id}>`).join('\n')}` : 'Collaborators: none'].join('\n');
      return interaction.reply({ content: text, ephemeral: true });
    }

    if (sub === 'info') {
      const channel = interaction.options.getChannel('channel');
      const { column, members } = getColumnTeam(guildId, channel.id);
      if (!column) return interaction.reply({ content: 'That channel is not a registered column.', ephemeral: true });
      const media = db.prepare('SELECT * FROM media_share_channels WHERE guild_id = ? AND channel_id = ?').get(guildId, channel.id);
      const gifCount = db.prepare('SELECT COUNT(*) AS count FROM gif_messages WHERE guild_id = ? AND channel_id = ?').get(guildId, channel.id).count;
      const roles = getColumnRoleIds(guildId);
      const limit = column.gif_limit === -1 ? 'unlimited' : column.gif_limit ?? media?.gif_limit ?? 50;
      const text = [
        `Owner: <@${column.owner_id}>`,
        `Type: ${column.type_name}`,
        `Collaborators: ${members.length}`,
        `GIFs archived: ${gifCount}`,
        `Limit: ${limit}`,
        `Locked: ${Boolean(column.locked)}`,
        `Archived: ${Boolean(column.archived)}`,
        `GIF-only deletion: ${Boolean(media?.gif_only_enabled)}`,
        `Captions: ${Boolean(media?.captions_enabled)}`,
        `Member view role: <@&${roles.memberRoleId}>`,
        `Unverified hidden role: <@&${roles.unverifiedRoleId}>`
      ].join('\n');
      return interaction.reply({ content: text, ephemeral: true });
    }

    if (['gifonly', 'captions'].includes(sub)) {
      const channel = interaction.options.getChannel('channel');
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can change that setting.', ephemeral: true });
      }

      const column = db.prepare('SELECT 1 FROM columns WHERE guild_id = ? AND channel_id = ?').get(guildId, channel.id);
      if (!column) return interaction.reply({ content: 'That channel is not a registered column.', ephemeral: true });

      db.prepare('INSERT OR IGNORE INTO media_share_channels (guild_id, channel_id) VALUES (?, ?)').run(guildId, channel.id);
      const columnName = sub === 'gifonly' ? 'gif_only_enabled' : 'captions_enabled';
      db.prepare(`UPDATE media_share_channels SET ${columnName} = ? WHERE guild_id = ? AND channel_id = ?`).run(enabled, guildId, channel.id);
      return interaction.reply({ content: `${channel} ${sub === 'gifonly' ? 'GIF-only deletion' : 'GIF captions'} are now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }

    if (sub === 'syncperms') {
      const channel = interaction.options.getChannel('channel');
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can sync permissions.', ephemeral: true });
      }
      await syncColumnPermissions(interaction.guild, channel);
      return interaction.reply({ content: `${channel} permissions are synced. Nice and tidy~`, ephemeral: true });
    }

    if (['lock', 'unlock'].includes(sub)) {
      const channel = interaction.options.getChannel('channel');
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can lock or unlock this column.', ephemeral: true });
      }
      await setColumnLocked(interaction.guild, channel, sub === 'lock');
      return interaction.reply({ content: `${channel} is now ${sub === 'lock' ? 'locked' : 'unlocked'}.`, ephemeral: true });
    }

    if (sub === 'rename') {
      const channel = interaction.options.getChannel('channel');
      if (!isColumnOwnerOrStaff(interaction.member, channel.id)) {
        return interaction.reply({ content: 'Only the column owner or staff can rename this column.', ephemeral: true });
      }
      const column = db.prepare('SELECT 1 FROM columns WHERE guild_id = ? AND channel_id = ?').get(guildId, channel.id);
      if (!column) return interaction.reply({ content: 'That channel is not a registered column.', ephemeral: true });
      const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 90);
      await channel.setName(name);
      await logToModChannel(interaction.guild, 'Column renamed', `Channel: ${channel}\nNew name: ${name}\nBy: ${interaction.user}`);
      return interaction.reply({ content: `${channel} has a fresh new name~`, ephemeral: true });
    }

    if (sub === 'archive') {
      const channel = interaction.options.getChannel('channel');
      await archiveColumn(interaction.guild, channel);
      return interaction.reply({ content: `${channel} is archived and frozen.`, ephemeral: true });
    }

    if (sub === 'limit') {
      const channel = interaction.options.getChannel('channel');
      const rawLimit = interaction.options.getString('limit').toLowerCase();
      let limit;
      if (rawLimit === 'unlimited') limit = -1;
      else {
        limit = Number.parseInt(rawLimit, 10);
        if (!Number.isInteger(limit) || limit < 1) return interaction.reply({ content: 'Limit must be a positive number or `unlimited`.', ephemeral: true });
      }
      db.prepare('UPDATE columns SET gif_limit = ? WHERE guild_id = ? AND channel_id = ?').run(limit, guildId, channel.id);
      return interaction.reply({ content: `${channel} column limit set to ${limit === -1 ? 'unlimited' : limit}.`, ephemeral: true });
    }
  }
};
