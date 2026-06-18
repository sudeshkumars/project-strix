'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }                             = require('../../../shared/cache')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('xpblacklist')
    .setDescription('Blacklist channels or roles from earning XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('addchannel')
      .setDescription('Block a channel from XP')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('removechannel')
      .setDescription('Unblock a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('addrole')
      .setDescription('Block a role from XP')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s
      .setName('removerole')
      .setDescription('Unblock a role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('View XP blacklist')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const bl      = parseObj(config?.xp_blacklist)

    if (!bl.channels) bl.channels = []
    if (!bl.roles)    bl.roles    = []

    if (sub === 'addchannel') {
      const ch = interaction.options.getChannel('channel')
      if (!bl.channels.includes(ch.id)) bl.channels.push(ch.id)
      saveBlacklist(client, guildId, bl)
      return interaction.editReply(successCard('Channel Blacklisted', [`${ch} will no longer grant XP.`]))
    }

    if (sub === 'removechannel') {
      const ch = interaction.options.getChannel('channel')
      bl.channels = bl.channels.filter(id => id !== ch.id)
      saveBlacklist(client, guildId, bl)
      return interaction.editReply(successCard('Channel Unblocked', [`${ch} will now grant XP.`]))
    }

    if (sub === 'addrole') {
      const role = interaction.options.getRole('role')
      if (!bl.roles.includes(role.id)) bl.roles.push(role.id)
      saveBlacklist(client, guildId, bl)
      return interaction.editReply(successCard('Role Blacklisted', [`${role} will no longer earn XP.`]))
    }

    if (sub === 'removerole') {
      const role = interaction.options.getRole('role')
      bl.roles = bl.roles.filter(id => id !== role.id)
      saveBlacklist(client, guildId, bl)
      return interaction.editReply(successCard('Role Unblocked', [`${role} will now earn XP.`]))
    }

    if (sub === 'list') {
      const lines = [
        `**Channels** \u2014 ${bl.channels.length ? bl.channels.map(id => `<#${id}>`).join(', ') : 'None'}`,
        `**Roles** \u2014 ${bl.roles.length ? bl.roles.map(id => `<@&${id}>`).join(', ') : 'None'}`
      ]
      return interaction.editReply(infoCard('\u{1f6ab} XP Blacklist', lines))
    }
  }
}

function saveBlacklist (client, guildId, bl) {
  updateConfig(client, guildId, { xp_blacklist: JSON.stringify(bl) }, { xp_blacklist: bl })
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}
