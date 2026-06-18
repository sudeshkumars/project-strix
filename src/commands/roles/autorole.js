'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }                             = require('../../../shared/cache')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage roles automatically assigned to members on join')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('add').setDescription('Add a role to assign on join').addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a role from auto-assign list').addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('View all auto-assigned roles'))
    .addSubcommand(s => s.setName('clear').setDescription('Remove all auto-assigned roles')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const me      = interaction.guild.members.me
    let autoroles = safeParseArray(config?.welcome_autorole)

    if (sub === 'add') {
      const role = interaction.options.getRole('role')
      if (role.managed) return interaction.editReply(errorCard('Invalid', ['Cannot use bot-managed roles.']))
      if (role.id === interaction.guild.roles.everyone.id) return interaction.editReply(errorCard('Invalid', ['Cannot use @everyone.']))
      if (role.position >= me.roles.highest.position) return interaction.editReply(errorCard('Hierarchy', ['That role is above my highest role. Move my role higher.']))
      if (autoroles.includes(role.id)) return interaction.editReply(errorCard('Already added', [`${role} is already in the auto-assign list.`]))
      if (autoroles.length >= 10) return interaction.editReply(errorCard('Limit reached', ['Maximum 10 auto-assign roles allowed.']))

      autoroles.push(role.id)
      save(client, guildId, autoroles)
      return interaction.editReply(successCard('Autorole Added', [`${role} will now be assigned to all new members on join.`]))
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role')
      if (!autoroles.includes(role.id)) return interaction.editReply(errorCard('Not found', [`${role} is not in the auto-assign list.`]))
      autoroles = autoroles.filter(id => id !== role.id)
      save(client, guildId, autoroles)
      return interaction.editReply(successCard('Autorole Removed', [`${role} will no longer be auto-assigned on join.`]))
    }

    if (sub === 'list') {
      if (!autoroles.length) return interaction.editReply(infoCard('\u{1f3ad} Auto-Assign Roles', ['No auto-assign roles configured.', 'Use `/autorole add` to add one.']))
      const lines = autoroles.map(id => `<@&${id}>`)
      return interaction.editReply(infoCard('\u{1f3ad} Auto-Assign Roles', lines, { subtext: `${autoroles.length}/10 roles configured` }))
    }

    if (sub === 'clear') {
      if (!autoroles.length) return interaction.editReply(errorCard('Nothing to clear', ['No auto-assign roles are configured.']))
      save(client, guildId, [])
      return interaction.editReply(successCard('Cleared', ['All auto-assign roles have been removed.']))
    }
  }
}

function save (client, guildId, arr) { updateConfig(client, guildId, { welcome_autorole: JSON.stringify(arr) }, { welcome_autorole: arr }) }
function safeParseArray (val) { if (!val) return []; if (Array.isArray(val)) return val; try { return JSON.parse(val) } catch { return [] } }
