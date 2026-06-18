'use strict'

const { EmbedBuilder } = require('discord.js')
const db               = require('../../../shared/db')
const { COLORS }       = require('../../../shared/embed')
const { resolveTier, TIERS } = require('../../../shared/permissions')

const HANDLED = ['report_action_warn', 'report_action_kick', 'report_action_dismiss']

module.exports = HANDLED.map(id => ({
  id,
  async execute (client, interaction, config) {
    await interaction.deferUpdate()

    if (resolveTier(interaction.member, config) < TIERS.MOD) {
      return interaction.followUp({ content: '❌ Only mods can action reports.', ephemeral: true })
    }

    const [,, action, targetId] = interaction.customId.split(':')
    const guild = interaction.guild

    let result = '✅ Dismissed — no action taken.'

    if (action === 'warn') {
      const caseId = db.createCase(guild.id, targetId, interaction.user.id, 'warn', '[Report] Warned via report system')
      db.createWarning(guild.id, targetId, interaction.user.id, '[Report] Warned via report system', 1, caseId)
      result = `⚠️ User \`${targetId}\` warned (Case #${caseId}).`
    }

    if (action === 'kick') {
      try {
        const member = await guild.members.fetch(targetId)
        await member.kick(`[Report] Kicked via report system by ${interaction.user.tag}`)
        const caseId = db.createCase(guild.id, targetId, interaction.user.id, 'kick', '[Report] Kicked via report system')
        result = `👢 User \`${targetId}\` kicked (Case #${caseId}).`
      } catch (e) {
        result = `❌ Could not kick: ${e.message}`
      }
    }

    const updated = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === 'dismiss' ? COLORS.log : COLORS.success)
      .setTitle(`${action === 'dismiss' ? '🗂️ Report Dismissed' : '✅ Report Actioned'}`)
      .addFields({ name: 'Actioned by', value: `${interaction.user}`, inline: true })
      .addFields({ name: 'Result', value: result, inline: false })

    await interaction.message.edit({ embeds: [updated], components: [] })
  }
}))
