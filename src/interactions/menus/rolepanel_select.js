'use strict'

const db = require('../../../shared/db')

module.exports = {
  id: 'rolepanel_select',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    // customId: rolepanel_select:<panelId>
    const [, panelId] = interaction.customId.split(':')
    const panel = db.getRolePanel(parseInt(panelId), interaction.guild.id)
    if (!panel) return interaction.editReply({ content: '❌ Panel not found.' })

    const allRoles = safeParseArray(panel.roles)
    const selected = interaction.values   // array of selected role IDs
    const member   = interaction.member
    const added    = []
    const removed  = []

    for (const r of allRoles) {
      const has      = member.roles.cache.has(r.id)
      const wantsIt  = selected.includes(r.id)
      const guildRole = interaction.guild.roles.cache.get(r.id)
      if (!guildRole) continue

      if (wantsIt && !has) {
        try { await member.roles.add(r.id); added.push(guildRole.name) } catch {}
      } else if (!wantsIt && has) {
        try { await member.roles.remove(r.id); removed.push(guildRole.name) } catch {}
      }
    }

    const lines = []
    if (added.length)   lines.push(`✅ Added: ${added.join(', ')}`)
    if (removed.length) lines.push(`🗑️ Removed: ${removed.join(', ')}`)
    if (!lines.length)  lines.push('No changes.')

    return interaction.editReply({ content: lines.join('\n') })
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
