'use strict'

const db = require('../../../shared/db')

module.exports = {
  id: 'rolepanel_btn',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    // customId: rolepanel_btn:<panelId>:<roleId>
    const [, panelId, roleId] = interaction.customId.split(':')
    const panel = db.getRolePanel(parseInt(panelId), interaction.guild.id)
    if (!panel) return interaction.editReply({ content: '❌ Panel not found.' })

    const roles     = safeParseArray(panel.roles)
    const roleEntry = roles.find(r => r.id === roleId)
    if (!roleEntry) return interaction.editReply({ content: '❌ Role not found in panel.' })

    const member = interaction.member
    const guild  = interaction.guild

    const guildRole = guild.roles.cache.get(roleId)
    if (!guildRole) return interaction.editReply({ content: '❌ Role no longer exists.' })

    const hasRole = member.roles.cache.has(roleId)

    // Exclusive: remove other panel roles first
    if (panel.exclusive && !hasRole) {
      for (const r of roles) {
        if (r.id !== roleId && member.roles.cache.has(r.id)) {
          try { await member.roles.remove(r.id) } catch {}
        }
      }
    }

    try {
      if (hasRole) {
        await member.roles.remove(roleId)
        return interaction.editReply({ content: `✅ Removed **${guildRole.name}**.` })
      } else {
        await member.roles.add(roleId)
        return interaction.editReply({ content: `✅ Added **${guildRole.name}**.` })
      }
    } catch (e) {
      return interaction.editReply({ content: `❌ Failed: ${e.message}` })
    }
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
