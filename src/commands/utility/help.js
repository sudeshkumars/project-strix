'use strict'

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js')
const { COLORS } = require('../../../shared/embed')

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
      if (!cmd) return interaction.editReply({ content: `❌ Command \`${cmdName}\` not found.` })

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`/${cmd.data.name}`)
        .setDescription(cmd.data.description ?? 'No description.')
        .addFields(
          { name: 'Permission', value: cmd.permLevel ?? 'user',       inline: true },
          { name: 'Cooldown',   value: cmd.cooldown ? `${cmd.cooldown}s` : 'None', inline: true },
          { name: 'Guild only', value: cmd.guildOnly ? 'Yes' : 'No',  inline: true }
        )

      if (cmd.aliases?.length) {
        embed.addFields({ name: 'Aliases', value: cmd.aliases.join(', '), inline: false })
      }

      return interaction.editReply({ embeds: [embed] })
    }

    // ── Category overview ─────────────────────────────────────────────────────
    const categories = new Map()
    for (const cmd of client.commands.values()) {
      const cat = getCategoryFromPath(cmd) ?? 'misc'
      if (!categories.has(cat)) categories.set(cat, [])
      categories.get(cat).push(cmd.data.name)
    }

    const ICONS = {
      mod:       '🔨', automod:   '🛡️', tickets: '🎫',
      roles:     '🎭', levels:    '⭐', community: '👥',
      tags:      '🏷️', scheduler: '🕐', config:  '⚙️',
      utility:   '🔧', unique:    '✨', owner:   '👑',
      misc:      '📦'
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📖 Stryx Commands')
      .setDescription('Select a category below, or use `/help <command>` for details.')
      .setFooter({ text: `${client.commands.size} commands loaded` })

    for (const [cat, cmds] of [...categories.entries()].sort()) {
      embed.addFields({
        name:  `${ICONS[cat] ?? '📦'} ${capitalise(cat)} (${cmds.length})`,
        value: cmds.map(c => `\`${c}\``).join(', '),
        inline: false
      })
    }

    // Dropdown for category detail
    const options = [...categories.keys()].slice(0, 25).map(cat => ({
      label: capitalise(cat),
      value: cat,
      emoji: ICONS[cat] ?? '📦'
    }))

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('Browse a category...')
        .addOptions(options)
    )

    return interaction.editReply({ embeds: [embed], components: [row] })
  }
}

function getCategoryFromPath (cmd) {
  // Walk require.cache to find the file path for this command
  const name = cmd.data?.name
  if (!name) return null

  for (const filePath of Object.keys(require.cache)) {
    if (!filePath.includes(`commands${require('path').sep}`)) continue
    if (!filePath.endsWith(`${name}.js`)) continue

    // Extract category folder name from path
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
