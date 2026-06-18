'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }           = require('../../../shared/cache')
const { success, error, info }   = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage roles automatically assigned to members on join')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a role to assign on join')
      .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a role from auto-assign list')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('list')
      .setDescription('View all auto-assigned roles')
    )
    .addSubcommand(s => s
      .setName('clear')
      .setDescription('Remove all auto-assigned roles')
    ),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const me      = interaction.guild.members.me

    // Parse current autorole list
    let autoroles = safeParseArray(config?.welcome_autorole)

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const role = interaction.options.getRole('role')

      if (role.managed) {
        return interaction.editReply({ embeds: [error('Invalid', 'Cannot use bot-managed roles.')] })
      }
      if (role.id === interaction.guild.roles.everyone.id) {
        return interaction.editReply({ embeds: [error('Invalid', 'Cannot use @everyone.')] })
      }
      if (role.position >= me.roles.highest.position) {
        return interaction.editReply({ embeds: [error('Hierarchy', 'That role is above my highest role. Move my role higher.')] })
      }
      if (autoroles.includes(role.id)) {
        return interaction.editReply({ embeds: [error('Already added', `${role} is already in the auto-assign list.`)] })
      }
      if (autoroles.length >= 10) {
        return interaction.editReply({ embeds: [error('Limit reached', 'Maximum 10 auto-assign roles allowed.')] })
      }

      autoroles.push(role.id)
      save(client, guildId, autoroles)

      return interaction.editReply({
        embeds: [success('Autorole Added', `${role} will now be assigned to all new members on join.`)]
      })
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const role = interaction.options.getRole('role')

      if (!autoroles.includes(role.id)) {
        return interaction.editReply({ embeds: [error('Not found', `${role} is not in the auto-assign list.`)] })
      }

      autoroles = autoroles.filter(id => id !== role.id)
      save(client, guildId, autoroles)

      return interaction.editReply({
        embeds: [success('Autorole Removed', `${role} will no longer be auto-assigned on join.`)]
      })
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const embed = info('🎭 Auto-Assign Roles', null)

      if (!autoroles.length) {
        embed.setDescription('No auto-assign roles configured.\nUse `/autorole add` to add one.')
      } else {
        embed.setDescription(autoroles.map(id => `<@&${id}>`).join('\n'))
        embed.setFooter({ text: `${autoroles.length}/10 roles configured` })
      }

      return interaction.editReply({ embeds: [embed] })
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (sub === 'clear') {
      if (!autoroles.length) {
        return interaction.editReply({ embeds: [error('Nothing to clear', 'No auto-assign roles are configured.')] })
      }

      save(client, guildId, [])
      return interaction.editReply({
        embeds: [success('Cleared', 'All auto-assign roles have been removed.')]
      })
    }
  }
}

function save (client, guildId, arr) {
  updateConfig(client, guildId, { welcome_autorole: JSON.stringify(arr) }, { welcome_autorole: arr })
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
