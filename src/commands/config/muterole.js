'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { updateConfig }        = require('../../../shared/cache')
const { success, error, info } = require('../../../shared/embed')
const { sleep }               = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('muterole')
    .setDescription('Configure the mute role for legacy muting')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set the mute role')
      .addRoleOption(o => o.setName('role').setDescription('Mute role').setRequired(true)))
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Auto-create a Muted role with channel overrides'))
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View current mute role')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guild   = interaction.guild
    const guildId = guild.id
    const config  = interaction.guildConfig

    if (sub === 'set') {
      const role = interaction.options.getRole('role')
      updateConfig(client, guildId, { mute_role: role.id }, { mute_role: role.id })
      return interaction.editReply({ embeds: [success('Mute Role Set', `${role} is now the mute role.`)] })
    }

    if (sub === 'view') {
      const roleId = config?.mute_role
      return interaction.editReply({
        embeds: [info('🔇 Mute Role', roleId ? `Current mute role: <@&${roleId}>` : 'No mute role set. Use `/muterole set` or `/muterole create`.')]
      })
    }

    if (sub === 'create') {
      await interaction.editReply({ content: '⏳ Creating Muted role and applying channel overwrites…' })

      // Create role
      let muteRole
      try {
        muteRole = await guild.roles.create({
          name: 'Muted',
          color: '#818386',
          reason: 'Stryx auto-created mute role',
          permissions: []
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', `Could not create role: ${e.message}`)] })
      }

      // Apply deny overwrites to all text channels
      const channels = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildForum
      )

      let done = 0
      for (const [, ch] of channels) {
        try {
          await ch.permissionOverwrites.create(muteRole.id, {
            SendMessages:       false,
            AddReactions:       false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false
          })
          done++
        } catch {}
        if (done % 10 === 0) await sleep(500)
      }

      updateConfig(client, guildId, { mute_role: muteRole.id }, { mute_role: muteRole.id })

      return interaction.editReply({
        embeds: [success('Mute Role Created', `${muteRole} created and applied to **${done}/${channels.size}** channels.`)]
      })
    }
  }
}
