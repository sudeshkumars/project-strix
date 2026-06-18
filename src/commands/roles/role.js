'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const { success, error, COLORS } = require('../../../shared/embed')
const { fullTime }               = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles for members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a role to a member')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a role from a member')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('info')
      .setDescription('View info about a role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    ),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub   = interaction.options.getSubcommand()
    const guild = interaction.guild

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const target = interaction.options.getUser('user')
      const role   = interaction.options.getRole('role')

      if (role.managed) {
        return interaction.editReply({ embeds: [error('Invalid', 'Cannot assign bot-managed roles.')] })
      }
      if (role.id === guild.roles.everyone.id) {
        return interaction.editReply({ embeds: [error('Invalid', 'Cannot assign @everyone.')] })
      }

      let member
      try { member = await guild.members.fetch(target.id) }
      catch { return interaction.editReply({ embeds: [error('Not found', 'Member not found in this server.')] }) }

      if (member.roles.cache.has(role.id)) {
        return interaction.editReply({ embeds: [error('Already has role', `${target} already has ${role}.`)] })
      }

      try {
        await member.roles.add(role.id, `Role added by ${interaction.user.tag}`)
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', `Could not add role: ${e.message}`)] })
      }

      return interaction.editReply({
        embeds: [success('Role Added', `${role} was added to ${target}.`)]
      })
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const target = interaction.options.getUser('user')
      const role   = interaction.options.getRole('role')

      if (role.managed) {
        return interaction.editReply({ embeds: [error('Invalid', 'Cannot remove bot-managed roles.')] })
      }

      let member
      try { member = await guild.members.fetch(target.id) }
      catch { return interaction.editReply({ embeds: [error('Not found', 'Member not found in this server.')] }) }

      if (!member.roles.cache.has(role.id)) {
        return interaction.editReply({ embeds: [error('Missing role', `${target} doesn't have ${role}.`)] })
      }

      try {
        await member.roles.remove(role.id, `Role removed by ${interaction.user.tag}`)
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', `Could not remove role: ${e.message}`)] })
      }

      return interaction.editReply({
        embeds: [success('Role Removed', `${role} was removed from ${target}.`)]
      })
    }

    // ── info ──────────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const role = interaction.options.getRole('role')

      const perms = role.permissions.toArray()
        .slice(0, 8)
        .map(p => `\`${p}\``)
        .join(', ') || 'None'

      const embed = new EmbedBuilder()
        .setColor(role.color || COLORS.info)
        .setTitle(`🎭 ${role.name}`)
        .addFields(
          { name: 'ID',          value: role.id,                                       inline: true },
          { name: 'Color',       value: role.hexColor,                                 inline: true },
          { name: 'Position',    value: String(role.position),                         inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No',              inline: true },
          { name: 'Hoisted',     value: role.hoist ? 'Yes' : 'No',                    inline: true },
          { name: 'Managed',     value: role.managed ? 'Yes (bot role)' : 'No',       inline: true },
          { name: 'Members',     value: String(role.members.size),                     inline: true },
          { name: 'Created',     value: fullTime(Math.floor(role.createdTimestamp / 1000)), inline: true },
          { name: 'Permissions', value: perms,                                         inline: false }
        )
        .setTimestamp()

      return interaction.editReply({ embeds: [embed] })
    }
  }
}
