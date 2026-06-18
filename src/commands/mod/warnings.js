'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                  = require('../../../shared/db')
const { infoCard, capList } = require('../../../shared/components')
const { relativeTime }    = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addBooleanOption(o => o.setName('include_expired').setDescription('Include decayed warnings').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target         = interaction.options.getUser('user')
    const includeExpired = interaction.options.getBoolean('include_expired') ?? false
    const config         = interaction.guildConfig
    const decayDays      = config?.warn_decay_days ?? 30

    const warns    = db.getWarnings(interaction.guild.id, target.id, includeExpired, decayDays)
    const totalPts = db.getActiveWarnPoints(interaction.guild.id, target.id, decayDays)

    if (!warns.length) {
      return interaction.editReply(infoCard(`\u26a0\ufe0f Warnings \u2014 ${target.tag}`, ['\u2705 No warnings found.']))
    }

    const warnLines = capList(warns.slice(0, 10), 10, w => {
      const status = w.pardoned ? '~~' : ''
      return `${status}**#${w.warn_id}** \u2014 ${relativeTime(w.created_at)} | Pts: ${w.points} | By: <@${w.mod_id}>\n> ${w.reason}${status}`
    })

    await interaction.editReply(infoCard(`\u26a0\ufe0f Warnings \u2014 ${target.tag}`, warnLines, {
      thumbnail: target.displayAvatarURL({ size: 64 }),
      subtext: `Active points: ${totalPts} / ${config?.warn_threshold ?? 3} threshold${warns.length > 10 ? ` \u2022 Showing 10 of ${warns.length}` : ''}`
    }))
  }
}
