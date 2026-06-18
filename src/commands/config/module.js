'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }         = require('../../../shared/cache')
const { success, info }        = require('../../../shared/embed')

const MODULES = [
  { name: 'leveling',   label: 'XP & Leveling'       },
  { name: 'automod',    label: 'AutoMod'              },
  { name: 'tickets',    label: 'Ticket System'        },
  { name: 'starboard',  label: 'Starboard'            },
  { name: 'welcome',    label: 'Welcome Messages'     },
  { name: 'rep',        label: 'Reputation System'    },
  { name: 'highlights', label: 'Highlights'           },
  { name: 'giveaways',  label: 'Giveaways'            },
  { name: 'suggestions',label: 'Suggestions'          },
  { name: 'bansync',    label: 'Cross-Guild Ban Sync' }
]

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('module')
    .setDescription('Enable or disable bot modules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Toggle a module on or off')
      .addStringOption(o => o.setName('module').setDescription('Module name').setRequired(true)
        .addChoices(...MODULES.map(m => ({ name: m.label, value: m.name })))))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all modules and their status')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const modules = parseObj(config?.modules)

    if (sub === 'toggle') {
      const modName  = interaction.options.getString('module')
      const modDef   = MODULES.find(m => m.name === modName)
      const current  = modules[modName] ?? true  // default enabled
      modules[modName] = !current

      updateConfig(client, guildId, { modules: JSON.stringify(modules) }, { modules })

      const state = modules[modName] ? '✅ Enabled' : '❌ Disabled'
      return interaction.editReply({
        embeds: [success('Module Updated', `**${modDef?.label ?? modName}** is now **${state}**.`)]
      })
    }

    if (sub === 'list') {
      const embed = info('🧩 Modules', null)
      for (const mod of MODULES) {
        const enabled = modules[mod.name] ?? true
        embed.addFields({
          name:  `${enabled ? '✅' : '❌'} ${mod.label}`,
          value: `\`${mod.name}\``,
          inline: true
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }
  }
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}
