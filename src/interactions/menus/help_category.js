'use strict'

const { EmbedBuilder } = require('discord.js')
const { COLORS } = require('../../../shared/embed')
const path = require('path')

module.exports = {
  id: 'help_category',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const category = interaction.values[0]
    const ICONS = {
      mod: '🔨', automod: '🛡️', tickets: '🎫', roles: '🎭',
      levels: '⭐', community: '👥', tags: '🏷️', scheduler: '🕐',
      config: '⚙️', utility: '🔧', unique: '✨', owner: '👑', misc: '📦'
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
      return interaction.editReply({ content: `No commands found in category \`${category}\`.` })
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`${ICONS[category] ?? '📦'} ${capitalise(category)} Commands`)
      .setDescription(
        cmds.map(c => `**\`/${c.data.name}\`** — ${c.data.description}`).join('\n')
      )
      .setFooter({ text: `${cmds.length} command${cmds.length !== 1 ? 's' : ''}` })

    await interaction.editReply({ embeds: [embed] })
  }
}

function capitalise (s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
