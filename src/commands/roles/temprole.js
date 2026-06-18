'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                                           = require('../../../shared/db')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')
const { parseDuration, formatDuration, relativeTime } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Assign a temporary role to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('give').setDescription('Give a temp role').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)).addStringOption(o => o.setName('duration').setDescription('Duration e.g. 7d, 12h').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active temp roles in this server')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'give') {
      const target  = interaction.options.getUser('user')
      const role    = interaction.options.getRole('role')
      const durStr  = interaction.options.getString('duration')

      const secs = parseDuration(durStr)
      if (!secs) return interaction.editReply(errorCard('Invalid duration', ['Use e.g. `7d`, `12h`, `30m`.']))
      if (role.managed) return interaction.editReply(errorCard('Invalid', ['Cannot assign bot-managed roles.']))

      let member
      try { member = await interaction.guild.members.fetch(target.id) } catch { return interaction.editReply(errorCard('Not found', ['Member not found.'])) }
      try { await member.roles.add(role.id, `Temp role by ${interaction.user.tag}`) } catch (e) { return interaction.editReply(errorCard('Failed', [e.message])) }

      const expiresAt = Math.floor(Date.now() / 1000) + secs
      db.createTempRole(guildId, target.id, role.id, expiresAt)

      return interaction.editReply(successCard('Temp Role Assigned', [
        `${role} assigned to ${target} for **${formatDuration(secs)}**.`,
        `Expires: ${relativeTime(expiresAt)}`
      ]))
    }

    if (sub === 'list') {
      const rows = db.getDb().prepare(`SELECT * FROM temp_roles WHERE guild_id = ? AND active = 1 ORDER BY expires_at ASC`).all(guildId)
      if (!rows.length) return interaction.editReply(infoCard('\u23f3 Active Temp Roles', ['No active temp roles.']))

      const lines = rows.slice(0, 20).map(r => `<@${r.user_id}> \u2192 <@&${r.role_id}> \u2014 Expires: ${relativeTime(r.expires_at)}`)
      return interaction.editReply(infoCard('\u23f3 Active Temp Roles', lines))
    }
  }
}
