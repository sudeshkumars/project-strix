'use strict'

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { COLORS } = require('../../../shared/embed')
const { safeSend } = require('../../../shared/utils')
const db = require('../../../shared/db')

module.exports = {
  id: 'appeal_submit',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const caseId    = interaction.fields.getTextInputValue('case_id')?.trim() || null
    const reason    = interaction.fields.getTextInputValue('appeal_reason')
    const extraInfo = interaction.fields.getTextInputValue('extra_info') || null

    if (!config?.appeal_channel) {
      return interaction.editReply({ content: '❌ No appeal channel configured.' })
    }

    const channel = interaction.guild.channels.cache.get(config.appeal_channel)
    if (!channel) return interaction.editReply({ content: '❌ Appeal channel not found.' })

    const user  = interaction.user
    const guild = interaction.guild

    // Look up case if provided
    let caseRow = null
    if (caseId && !isNaN(caseId)) {
      caseRow = db.getCase(parseInt(caseId), guild.id)
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle('📋 New Appeal Submitted')
      .setThumbnail(user.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: 'User',   value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Case',   value: caseRow ? `#${caseRow.case_id} — ${caseRow.type}` : caseId ?? 'Not specified', inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp()

    if (caseRow) {
      embed.addFields(
        { name: 'Original Reason', value: caseRow.reason ?? 'None', inline: true },
        { name: 'Mod',             value: `<@${caseRow.mod_id}>`,   inline: true }
      )
    }

    if (extraInfo) {
      embed.addFields({ name: 'Additional Info', value: extraInfo, inline: false })
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`appeal_accept:${user.id}:${caseId ?? '0'}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`appeal_deny:${user.id}:${caseId ?? '0'}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    )

    await safeSend(channel, { embeds: [embed], components: [row] })
    await interaction.editReply({ content: '✅ Your appeal has been submitted. You will be notified of the decision.' })
  }
}
