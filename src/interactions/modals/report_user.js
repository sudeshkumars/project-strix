'use strict'

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { COLORS }   = require('../../../shared/embed')
const { safeSend } = require('../../../shared/utils')

module.exports = {
  id: 'report_user',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const targetId = interaction.fields.getTextInputValue('report_target_id')?.trim()
    const reason   = interaction.fields.getTextInputValue('report_reason')?.trim()
    const evidence = interaction.fields.getTextInputValue('report_evidence')?.trim() || null

    if (!targetId || !reason) {
      return interaction.reply({ content: '❌ Target ID and reason are required.', ephemeral: true })
    }

    const modChannelId = config?.mod_channel ?? config?.log_channel
    if (!modChannelId) {
      return interaction.editReply({ content: '❌ No mod channel configured. Ask an admin to set one with `/config modchannel`.' })
    }

    const modCh = interaction.guild?.channels.cache.get(modChannelId)
    if (!modCh) return interaction.editReply({ content: '❌ Mod channel not found.' })

    let target = null
    try { target = await client.users.fetch(targetId) } catch {}

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle('🚨 User Report')
      .addFields(
        { name: 'Reporter',  value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Reported',  value: target ? `${target.tag} (\`${targetId}\`)` : `\`${targetId}\``, inline: true },
        { name: 'Reason',    value: reason, inline: false }
      )
      .setTimestamp()

    if (target) embed.setThumbnail(target.displayAvatarURL({ size: 64 }))
    if (evidence) embed.addFields({ name: 'Evidence', value: evidence, inline: false })

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`report_action_warn:${targetId}`)
        .setLabel('Warn User')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`report_action_kick:${targetId}`)
        .setLabel('Kick User')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`report_action_dismiss:${targetId}`)
        .setLabel('Dismiss')
        .setStyle(ButtonStyle.Secondary)
    )

    await safeSend(modCh, { embeds: [embed], components: [row] })
    return interaction.editReply({ content: '✅ Your report has been submitted to the mod team. Thank you.' })
  }
}
