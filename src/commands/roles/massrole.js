'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { successCard, errorCard } = require('../../../shared/components')
const { sleep }                  = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('Add or remove a role from all members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .addRoleOption(o => o.setName('filter_role').setDescription('Only apply to members with this role').setRequired(false))
    .addBooleanOption(o => o.setName('bots').setDescription('Include bots').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const action     = interaction.options.getString('action')
    const role       = interaction.options.getRole('role')
    const filterRole = interaction.options.getRole('filter_role')
    const incBots    = interaction.options.getBoolean('bots') ?? false
    const guild      = interaction.guild

    if (role.managed) return interaction.editReply(errorCard('Invalid', ['Cannot manage bot-managed roles.']))
    if (role.id === guild.roles.everyone.id) return interaction.editReply(errorCard('Invalid', ['Cannot use @everyone.']))

    await interaction.editReply(successCard('Processing', ['\u23f3 Fetching members\u2026']))

    await guild.members.fetch()
    let members = [...guild.members.cache.values()]
    if (!incBots) members = members.filter(m => !m.user.bot)
    if (filterRole) members = members.filter(m => m.roles.cache.has(filterRole.id))

    const targets = action === 'add'
      ? members.filter(m => !m.roles.cache.has(role.id))
      : members.filter(m => m.roles.cache.has(role.id))

    if (!targets.length) return interaction.editReply(successCard('Done', ['No members to update.']))

    await interaction.editReply(successCard('Processing', [`\u23f3 Processing **${targets.length}** members\u2026`]))

    let done = 0, failed = 0
    for (const member of targets) {
      try {
        action === 'add' ? await member.roles.add(role.id, `Mass role by ${interaction.user.tag}`) : await member.roles.remove(role.id, `Mass role by ${interaction.user.tag}`)
        done++
      } catch { failed++ }
      if (done % 10 === 0) await sleep(500)
    }

    await interaction.editReply(successCard('Mass Role Complete', [
      `**Action:** ${action}`,
      `**Role:** ${role}`,
      `\u2705 Updated: **${done}** | \u274c Failed: **${failed}**`
    ]))
  }
}
