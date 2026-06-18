'use strict'

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js')
const { buildCard, COLORS } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: false,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands or get info on a specific command')
    .addStringOption(o => o.setName('command').setDescription('Command name').setRequired(false).setAutocomplete(true)),

  async autocomplete (client, interaction) {
    const focused  = interaction.options.getFocused().toLowerCase()
    const commands = [...client.commands.values()]
    const choices  = commands
      .filter(c => c.data.name.includes(focused))
      .slice(0, 25)
      .map(c => ({ name: c.data.name, value: c.data.name }))
    await interaction.respond(choices)
  },

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const cmdName = interaction.options.getString('command')

    // ── Single command ────────────────────────────────────────────────────────
    if (cmdName) {
      const cmd = client.commands.get(cmdName)
      if (!cmd) {
        const card = buildCard({
          accent: 'error',
          title: 'Not Found',
          lines: [`Command \`${cmdName}\` not found.`]
        })
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 })
      }

      const lines = [
        `**Permission** \u2014 ${cmd.permLevel ?? 'user'}`,
        `**Cooldown** \u2014 ${cmd.cooldown ? `${cmd.cooldown}s` : 'None'}`,
        `**Guild only** \u2014 ${cmd.guildOnly ? 'Yes' : 'No'}`
      ]
      if (cmd.aliases?.length) lines.push(`**Aliases** \u2014 ${cmd.aliases.join(', ')}`)
      if (cmd.data.description) lines.unshift(cmd.data.description)

      const card = buildCard({
        accent: 'info',
        title: `/${cmd.data.name}`,
        lines
      })

      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 })
    }

    // ── Category overview ─────────────────────────────────────────────────────
    const categories = new Map()
    for (const cmd of client.commands.values()) {
      const cat = getCategoryFromPath(cmd) ?? 'misc'
      if (!categories.has(cat)) categories.set(cat, [])
      categories.get(cat).push(cmd.data.name)
    }

    const ICONS = {
      mod:       '\u{1f528}', automod:   '\u{1f6e1}\ufe0f', tickets: '\u{1f3ab}',
      roles:     '\u{1f3ad}', levels:    '\u2b50', community: '\u{1f465}',
      tags:      '\u{1f3f7}\ufe0f', scheduler: '\u{1f550}', config:  '\u2699\ufe0f',
      utility:   '\u{1f527}', unique:    '\u2728', owner:   '\u{1f451}',
      misc:      '\u{1f4e6}'
    }

    const bodyLines = ['Select a category below, or use `/help <command>` for details.', '']
    for (const [cat, cmds] of [...categories.entries()].sort()) {
      bodyLines.push(`${ICONS[cat] ?? '\u{1f4e6}'} **${capitalise(cat)}** (${cmds.length}) \u2014 ${cmds.map(c => `\`${c}\``).join(', ')}`)
    }

    // Dropdown for category detail
    const options = [...categories.keys()].slice(0, 25).map(cat => ({
      label: capitalise(cat),
      value: cat,
      emoji: ICONS[cat] ?? '\u{1f4e6}'
    }))

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('Browse a category...')
        .addOptions(options)
    )

    const card = buildCard({
      accent: 'info',
      title: '\u{1f4d6} Stryx Commands',
      lines: bodyLines,
      subtext: `${client.commands.size} commands loaded`
    })

    card.addActionRowComponents(row)

    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 })
  }
}

function getCategoryFromPath (cmd) {
  const name = cmd.data?.name
  if (!name) return null

  for (const filePath of Object.keys(require.cache)) {
    if (!filePath.includes(`commands${require('path').sep}`)) continue
    if (!filePath.endsWith(`${name}.js`)) continue

    const parts = filePath.split(require('path').sep)
    const cmdIdx = parts.lastIndexOf('commands')
    if (cmdIdx !== -1 && parts[cmdIdx + 1] !== `${name}.js`) {
      return parts[cmdIdx + 1]
    }
  }
  return null
}

function capitalise (s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
