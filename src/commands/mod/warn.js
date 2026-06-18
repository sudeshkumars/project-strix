'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const { modAction, modDm }  = require('../../../shared/embed')
const { safeSend }          = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    .addIntegerOption(o => o.setName('points').setDescription('Warning points (default 1)').setMinValue(1).setMaxValue(5).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const reason = interaction.options.getString('reason')
    const points = interaction.options.getInteger('points') ?? 1
    const guild  = interaction.guild
    const config = interaction.guildConfig

    let member
    try { member = await guild.members.fetch(target.id) } catch {
      return interaction.editReply({ content: '❌ Member not found.' })
    }

    if (member.id === interaction.user.id) return interaction.editReply({ content: '❌ You cannot warn yourself.' })

    const caseId   = db.createCase(guild.id, target.id, interaction.user.id, 'warn', reason)
    const warnId   = db.createWarning(guild.id, target.id, interaction.user.id, reason, points, caseId)
    const decayDays = config?.warn_decay_days ?? 30
    const totalPts = db.getActiveWarnPoints(guild.id, target.id, decayDays)
    const threshold = config?.warn_threshold ?? 3

    if (config?.dm_on_action) {
      await safeSend(target, {
        embeds: [modDm({ action: 'Warn', guildName: guild.name, reason })]
      })
    }

    const embed = modAction({
      action:    'Warn',
      target,
      mod:       interaction.user,
      reason,
      caseId,
      warnCount: totalPts
    })

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, { embeds: [embed] })
    }

    // ── Threshold auto-action ────────────────────────────────────────────────
    if (totalPts >= threshold) {
      const ch = config?.mod_channel ? guild.channels.cache.get(config.mod_channel) : null
      if (ch) {
        await safeSend(ch, {
          content: `⚠️ <@${target.id}> has reached **${totalPts} warning points** (threshold: ${threshold}). Consider escalating.`
        })
      }
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
