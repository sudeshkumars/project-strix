'use strict'

const { SlashCommandBuilder } = require('discord.js')
const path                    = require('path')
const { success, error }      = require('../../../shared/embed')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Reload a command without restarting (owner only)')
    .addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true).setAutocomplete(true)),

  async autocomplete (client, interaction) {
    const focused  = interaction.options.getFocused().toLowerCase()
    const commands = [...client.commands.keys()]
    await interaction.respond(
      commands
        .filter(c => c.includes(focused))
        .slice(0, 25)
        .map(c => ({ name: c, value: c }))
    )
  },

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const cmdName = interaction.options.getString('command')
    const cmd     = client.commands.get(cmdName)

    if (!cmd) {
      return interaction.editReply({ embeds: [error('Not found', `Command \`${cmdName}\` not found.`)] })
    }

    // Find the file path via require.cache
    const cmdPath = Object.keys(require.cache).find(k =>
      k.includes(`commands`) && k.endsWith(`${cmdName}.js`)
    )

    if (!cmdPath) {
      return interaction.editReply({ embeds: [error('Cannot reload', `Cannot find file for \`${cmdName}\`.`)] })
    }

    try {
      delete require.cache[require.resolve(cmdPath)]
      const newCmd = require(cmdPath)
      client.commands.set(newCmd.data.name, newCmd)

      if (Array.isArray(newCmd.aliases)) {
        for (const alias of newCmd.aliases) client.aliases.set(alias, newCmd.data.name)
      }

      return interaction.editReply({ embeds: [success('Reloaded', `Command \`${cmdName}\` reloaded successfully.`)] })
    } catch (e) {
      return interaction.editReply({ embeds: [error('Reload Failed', `\`\`\`${e.message.slice(0, 1000)}\`\`\``)] })
    }
  }
}
