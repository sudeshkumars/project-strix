'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db          = require('../../../shared/db')
const { info }    = require('../../../shared/embed')
const { relativeTime } = require('../../../shared/utils')

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
      return interaction.editReply({ content: `✅ **${target.tag}** has no warnings.` })
    }

    const embed = info(`⚠️ Warnings — ${target.tag}`, null)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .setFooter({ text: `Active points: ${totalPts} / ${config?.warn_threshold ?? 3} threshold` })

    for (const w of warns.slice(0, 10)) {
      const status = w.pardoned ? '~~' : ''
      embed.addFields({
        name:  `#${w.warn_id} — ${relativeTime(w.created_at)}`,
        value: `${status}**Reason:** ${w.reason} | **Points:** ${w.points} | **By:** <@${w.mod_id}>${status}`,
        inline: false
      })
    }

    if (warns.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${warns.length} warnings | Active points: ${totalPts}` })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
