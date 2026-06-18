'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const db                                     = require('../../../shared/db')
const { successCard, errorCard }             = require('../../../shared/components')
const { safeSend }                           = require('../../../shared/utils')

const STATUS_COLORS = {
  pending:      0xFEE75C,
  approved:     0x57F287,
  denied:       0xED4245,
  implemented:  0x5865F2,
  considering:  0xF4A460
}

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Suggestion system')
    .addSubcommand(s => s
      .setName('submit')
      .setDescription('Submit a suggestion')
      .addStringOption(o => o.setName('suggestion').setDescription('Your suggestion').setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s
      .setName('approve')
      .setDescription('Approve a suggestion (mod)')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Mod note').setRequired(false)))
    .addSubcommand(s => s
      .setName('deny')
      .setDescription('Deny a suggestion (mod)')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s
      .setName('implement')
      .setDescription('Mark a suggestion as implemented (mod)')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Note').setRequired(false)))
    .addSubcommand(s => s
      .setName('consider')
      .setDescription('Mark a suggestion as under consideration (mod)')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Note').setRequired(false))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig

    if (sub === 'submit') {
      if (!config?.suggestions_channel) {
        return interaction.editReply(errorCard('Not configured', ['No suggestions channel set. Ask an admin to run `/config suggestions`.']))
      }

      const content = interaction.options.getString('suggestion')
      const sugId   = db.createSuggestion(guildId, interaction.user.id, content)

      const ch    = interaction.guild.channels.cache.get(config.suggestions_channel)
      if (!ch) return interaction.editReply(errorCard('Channel not found', ['Suggestions channel is missing.']))

      // Suggestion embeds posted to the channel stay as classic EmbedBuilder (user-facing content)
      const embed = new EmbedBuilder()
        .setColor(STATUS_COLORS.pending)
        .setTitle(`\u{1f4a1} Suggestion #${sugId}`)
        .setDescription(content)
        .addFields(
          { name: 'Status',      value: '\u23f3 Pending', inline: true },
          { name: 'Submitted by', value: `${interaction.user}`, inline: true }
        )
        .setTimestamp()

      const msg = await safeSend(ch, { embeds: [embed] })
      if (msg) {
        await msg.react('\u{1f44d}').catch(() => {})
        await msg.react('\u{1f44e}').catch(() => {})
        db.updateSuggestion(sugId, guildId, { message_id: msg.id })
      }

      return interaction.editReply(successCard('Submitted', [`Your suggestion **#${sugId}** has been submitted.`]))
    }

    // Mod-only actions
    const { resolveTier, TIERS } = require('../../../shared/permissions')
    if (resolveTier(interaction.member, config) < TIERS.MOD) {
      return interaction.editReply(errorCard('No permission', ['Mods only.']))
    }

    const id     = interaction.options.getInteger('id')
    const note   = interaction.options.getString('note') ?? null
    const sug    = db.getSuggestion(id, guildId)
    if (!sug) return interaction.editReply(errorCard('Not found', [`Suggestion #${id} not found.`]))

    const statusMap = { approve: 'approved', deny: 'denied', implement: 'implemented', consider: 'considering' }
    const newStatus = statusMap[sub]

    db.updateSuggestion(id, guildId, { status: newStatus, mod_note: note })

    // Update the original message embed
    if (sug.message_id && config?.suggestions_channel) {
      const ch = interaction.guild.channels.cache.get(config.suggestions_channel)
      if (ch) {
        try {
          const msg = await ch.messages.fetch(sug.message_id)
          const statusLabels = {
            approved:    '\u2705 Approved',
            denied:      '\u274c Denied',
            implemented: '\u{1f680} Implemented',
            considering: '\u{1f914} Under Consideration'
          }
          const updated = EmbedBuilder.from(msg.embeds[0])
            .setColor(STATUS_COLORS[newStatus])
            .spliceFields(0, 1, { name: 'Status', value: statusLabels[newStatus], inline: true })
          if (note) updated.addFields({ name: 'Mod Note', value: note, inline: false })
          await msg.edit({ embeds: [updated] })
        } catch {}
      }
    }

    return interaction.editReply(successCard('Updated', [`Suggestion **#${id}** marked as **${newStatus}**.`]))
  }
}
