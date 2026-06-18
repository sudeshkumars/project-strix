'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { safeSend, sleep }      = require('../../../shared/utils')

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
      if (!rows.length) return interaction.editReply({ content: 'No broadcast history.' })

      const embed = info('📢 Broadcast History', null)
      for (const r of rows) {
        embed.addFields({
          name:  `${r.title} (${r.type ?? 'update'})`,
          value: `✅ ${r.sent_count} sent | ❌ ${r.fail_count} failed | ⏭️ ${r.skip_count} skipped`,
          inline: false
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }

    // ── send ──────────────────────────────────────────────────────────────────
    const title   = interaction.options.getString('title')
    const message = interaction.options.getString('message')
    const type    = interaction.options.getString('type') ?? 'update'
    const colorHex = interaction.options.getString('color') ?? '#5865F2'
    const color   = parseInt(colorHex.replace('#', ''), 16) || 0x5865F2

    const TYPE_ICONS = { update: '📢', maintenance: '🔧', alert: '🚨' }
    const icon = TYPE_ICONS[type] ?? '📢'

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${icon} ${title}`)
      .setDescription(message)
      .setFooter({ text: 'Stryx Bot Network', iconURL: client.user.displayAvatarURL() })
      .setTimestamp()

    const webhooks = db.getAllWebhooks()
    let sent = 0, failed = 0, skipped = 0

    await interaction.editReply({ content: `📢 Broadcasting to **${webhooks.length}** guilds…` })

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
          // Webhook deleted
          db.clearWebhook(row.guild_id)
          skipped++
        } else {
          failed++
        }
      } catch {
        failed++
      }

      // Rate limit safety — 30 webhooks/sec max
      if (sent % 25 === 0) await sleep(1000)
    }

    db.insertBroadcastLog(title, type, message, sent, failed, skipped)

    await interaction.editReply({
      embeds: [success('Broadcast Complete',
        `✅ Sent: **${sent}** | ❌ Failed: **${failed}** | ⏭️ Skipped: **${skipped}**`
      )]
    })
  }
}
