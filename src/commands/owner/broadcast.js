'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const db                                     = require('../../../shared/db')
const { successCard, errorCard, infoCard }   = require('../../../shared/components')
const { safeSend, sleep }                    = require('../../../shared/utils')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Send a message to all guilds (owner only)')
    .addSubcommand(s => s
      .setName('send')
      .setDescription('Broadcast a message via webhooks')
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message body').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(false)
        .addChoices(
          { name: 'Update',      value: 'update'      },
          { name: 'Maintenance', value: 'maintenance' },
          { name: 'Alert',       value: 'alert'       }
        ))
      .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #5865F2').setRequired(false)))
    .addSubcommand(s => s
      .setName('history')
      .setDescription('View broadcast history')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub = interaction.options.getSubcommand()

    if (sub === 'history') {
      const rows = db.getDb().prepare('SELECT * FROM broadcast_log ORDER BY created_at DESC LIMIT 10').all()
      if (!rows.length) return interaction.editReply(infoCard('\u{1f4e2} Broadcast History', ['No broadcast history.']))

      const lines = rows.map(r =>
        `**${r.title}** (${r.type ?? 'update'})\n> \u2705 ${r.sent_count} sent | \u274c ${r.fail_count} failed | \u23ed\ufe0f ${r.skip_count} skipped`
      )
      return interaction.editReply(infoCard('\u{1f4e2} Broadcast History', lines))
    }

    // ── send ──────────────────────────────────────────────────────────────────
    const title   = interaction.options.getString('title')
    const message = interaction.options.getString('message')
    const type    = interaction.options.getString('type') ?? 'update'
    const colorHex = interaction.options.getString('color') ?? '#5865F2'
    const color   = parseInt(colorHex.replace('#', ''), 16) || 0x5865F2

    const TYPE_ICONS = { update: '\u{1f4e2}', maintenance: '\u{1f527}', alert: '\u{1f6a8}' }
    const icon = TYPE_ICONS[type] ?? '\u{1f4e2}'

    // The broadcast embed sent to guilds stays as classic EmbedBuilder (external delivery)
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${icon} ${title}`)
      .setDescription(message)
      .setFooter({ text: 'Stryx Bot Network', iconURL: client.user.displayAvatarURL() })
      .setTimestamp()

    const webhooks = db.getAllWebhooks()
    let sent = 0, failed = 0, skipped = 0

    await interaction.editReply(infoCard('Broadcasting', [`\u{1f4e2} Broadcasting to **${webhooks.length}** guilds\u2026`]))

    for (const row of webhooks) {
      if (!row.webhook_url) { skipped++; continue }

      try {
        const res = await fetch(row.webhook_url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            username:   'Stryx Updates',
            avatar_url: client.user.displayAvatarURL(),
            embeds:     [embed.toJSON()]
          })
        })

        if (res.ok) {
          sent++
        } else if (res.status === 404) {
          db.clearWebhook(row.guild_id)
          skipped++
        } else {
          failed++
        }
      } catch {
        failed++
      }

      if (sent % 25 === 0) await sleep(1000)
    }

    db.insertBroadcastLog(title, type, message, sent, failed, skipped)

    await interaction.editReply(successCard('Broadcast Complete', [
      `\u2705 Sent: **${sent}** | \u274c Failed: **${failed}** | \u23ed\ufe0f Skipped: **${skipped}**`
    ]))
  }
}
