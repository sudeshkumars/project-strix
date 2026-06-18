'use strict'

const { MessageFlags } = require('discord.js')
const { buildCard }    = require('../../../shared/components')
const path = require('path')

module.exports = {
  id: 'help_category',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const category = interaction.values[0]
    const ICONS = {
      mod: '\u{1f528}', automod: '\u{1f6e1}\ufe0f', tickets: '\u{1f3ab}', roles: '\u{1f3ad}',
      levels: '\u2b50', community: '\u{1f465}', tags: '\u{1f3f7}\ufe0f', scheduler: '\u{1f550}',
      config: '\u2699\ufe0f', utility: '\u{1f527}', unique: '\u2728', owner: '\u{1f451}', misc: '\u{1f4e6}'
    }

    const cmds = [...client.commands.values()].filter(cmd => {
      for (const filePath of Object.keys(require.cache)) {
        if (!filePath.includes(`commands${path.sep}`)) continue
        if (!filePath.endsWith(`${cmd.data.name}.js`)) continue
        const parts = filePath.split(path.sep)
        const idx   = parts.lastIndexOf('commands')
        if (idx !== -1 && parts[idx + 1] === category) return true
      }
      return false
    })

    if (!cmds.length) {
      const card = buildCard({ accent: 'info', title: 'No Commands', lines: [`No commands found in category \`${category}\`.`] })
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 })
    }

    const lines = cmds.map(c => `**\`/${c.data.name}\`** \u2014 ${c.data.description}`)

    const card = buildCard({
      accent: 'info',
      title: `${ICONS[category] ?? '\u{1f4e6}'} ${capitalise(category)} Commands`,
      lines,
      subtext: `${cmds.length} command${cmds.length !== 1 ? 's' : ''}`
    })

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 })
  }
}

function capitalise (s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
