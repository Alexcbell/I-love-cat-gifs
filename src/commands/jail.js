const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, isHelperOrAbove, isModeratorOrAbove } = require('../utils/permissions');
const { jailMember, releaseMember } = require('../services/jailService');
const { logToModChannel } = require('../services/logService');
const db = require('../database/db');

function getStaffTier(member) {
  if (!member) return 0;
  if (member.guild.ownerId === member.id) return 4;

  const config = getGuildConfig(member.guild.id);
  if (member.permissions.has(PermissionFlagsBits.Administrator) || (config.admin_role_id && member.roles.cache.has(config.admin_role_id))) return 3;
  if (config.moderator_role_id && member.roles.cache.has(config.moderator_role_id)) return 2;
  if (
    member.permissions.has(PermissionFlagsBits.ManageChannels)
    || (config.helper_role_id && member.roles.cache.has(config.helper_role_id))
    || (config.staff_role_id && member.roles.cache.has(config.staff_role_id))
  ) return 1;

  return 0;
}

function canActOnMember(actor, target) {
  if (!actor || !target) return false;
  if (target.id === actor.id) return false;
  if (target.user.bot) return false;
  if (actor.guild.ownerId === actor.id) return true;
  if (getStaffTier(actor) <= getStaffTier(target)) return false;
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail members and manage jail appeals')
    .addSubcommand(sub => sub.setName('user').setDescription('Jail a member')
      .addUserOption(opt => opt.setName('member').setDescription('Member to jail').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for the jail').setRequired(true).setMaxLength(900))
      .addBooleanOption(opt => opt.setName('public').setDescription('Publicly announce this jail in the current channel')))
    .addSubcommand(sub => sub.setName('release').setDescription('Approve an appeal and release a jailed member')
      .addUserOption(opt => opt.setName('member').setDescription('Member to release').setRequired(true)))
    .addSubcommand(sub => sub.setName('approve').setDescription('Approve an appeal and release a jailed member')
      .addUserOption(opt => opt.setName('member').setDescription('Member to release').setRequired(true)))
    .addSubcommand(sub => sub.setName('deny').setDescription('Deny a jail appeal')
      .addUserOption(opt => opt.setName('member').setDescription('Member whose appeal is denied').setRequired(true))
      .addStringOption(opt => opt.setName('note').setDescription('Optional note for the denial').setMaxLength(900))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('member');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: 'I could not find that member in this server.', ephemeral: true });
    }

    if (sub === 'user') {
      if (!isHelperOrAbove(interaction.member)) {
        return interaction.reply({ content: 'Helper and above can jail members.', ephemeral: true });
      }

      if (!canActOnMember(interaction.member, targetMember)) {
        return interaction.reply({ content: 'You can only jail members below your highest role, and you cannot jail bots or yourself.', ephemeral: true });
      }

      if (!targetMember.manageable) {
        return interaction.reply({ content: 'I cannot add the Jail role to that member. Check my role position and Manage Roles permission.', ephemeral: true });
      }

      const reason = interaction.options.getString('reason');
      const publicAnnounce = interaction.options.getBoolean('public') || false;
      await interaction.deferReply({ ephemeral: !publicAnnounce });

      const { channel } = await jailMember({
        guild: interaction.guild,
        member: targetMember,
        jailedBy: interaction.user,
        reason,
        publicAnnounce
      });

      await logToModChannel(interaction.guild, 'Member jailed', `User: ${targetUser}\nBy: ${interaction.user}\nReason: ${reason}\nAppeal: ${channel}`);

      const publicText = `${targetUser} has been jailed.\nReason: ${reason}`;
      const privateText = `${targetUser} has been jailed. Appeal channel: ${channel}`;
      return interaction.editReply(publicAnnounce ? publicText : privateText);
    }

    if (!isModeratorOrAbove(interaction.member)) {
      return interaction.reply({ content: 'Moderator and above can approve or deny jail appeals.', ephemeral: true });
    }

    if (sub === 'release' || sub === 'approve') {
      await interaction.deferReply({ ephemeral: true });
      const { channel, restoredMemberRole } = await releaseMember({
        guild: interaction.guild,
        member: targetMember,
        releasedBy: interaction.user
      });
      await logToModChannel(interaction.guild, 'Jail appeal approved', `User: ${targetUser}\nBy: ${interaction.user}${channel ? `\nAppeal: ${channel}` : ''}`);
      return interaction.editReply(`${targetUser} has been released from jail.${restoredMemberRole ? ' Member role restored.' : ' Member role was already present or could not be changed.'}${channel ? ` Appeal channel closed: ${channel}` : ''}`);
    }

    const jailCase = db.prepare('SELECT channel_id FROM jail_cases WHERE guild_id = ? AND user_id = ? AND active = 1')
      .get(interaction.guild.id, targetUser.id);
    const channel = jailCase?.channel_id ? await interaction.guild.channels.fetch(jailCase.channel_id).catch(() => null) : null;
    const note = interaction.options.getString('note') || 'No note provided.';

    if (channel?.isTextBased()) {
      await channel.send(`Appeal denied by ${interaction.user}.\n${note}`).catch(() => null);
      await channel.permissionOverwrites.edit(targetUser.id, {
        SendMessages: false,
        AttachFiles: false
      }, { reason: 'Jail appeal denied' }).catch(() => null);
      await channel.setName(`denied-${channel.name}`.slice(0, 100)).catch(() => null);
    }

    await logToModChannel(interaction.guild, 'Jail appeal denied', `User: ${targetUser}\nBy: ${interaction.user}\nNote: ${note}${channel ? `\nAppeal: ${channel}` : ''}`);
    return interaction.reply({ content: `${targetUser}'s jail appeal has been denied.${channel ? ` Appeal channel locked: ${channel}` : ''}`, ephemeral: true });
  }
};
