'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }                             = require('../../../shared/cache')
const { successCard, infoCard }                    = require('../../../shared/components')

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
    .addSubcommand(s => s.setName('toggle').setDescription('Toggle a module on or off').addStringOption(o => o.setName('module').setDescription('Module name').setRequired(true).addChoices(...MODULES.map(m => ({ name: m.label, value: m.name })))))
    .addSubcommand(s => s.setName('list').setDescription('List all modules and their status')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const modules = parseObj(config?.modules)

    if (sub === 'toggle') {
      const modName  = interaction.options.getString('module')
      const modDef   = MODULES.find(m => m.name === modName)
      const current  = modules[modName] ?? true
      modules[modName] = !current

      updateConfig(client, guildId, { modules: JSON.stringify(modules) }, { modules })

      const state = modules[modName] ? '\u2705 Enabled' : '\u274c Disabled'
      return interaction.editReply(successCard('Module Updated', [`**${modDef?.label ?? modName}** is now **${state}**.`]))
    }

    if (sub === 'list') {
      const lines = MODULES.map(mod => {
        const enabled = modules[mod.name] ?? true
        return `${enabled ? '\u2705' : '\u274c'} **${mod.label}** \u2014 \`${mod.name}\``
      })
      return interaction.editReply(infoCard('\u{1f9e9} Modules', lines))
    }
  }
}

function parseObj (val) { if (!val) return {}; if (typeof val === 'object') return val; try { return JSON.parse(val) } catch { return {} } }
