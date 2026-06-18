'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ChannelType
} = require('discord.js')
const { updateConfig }        = require('../../../shared/cache')
const { success, error, info } = require('../../../shared/embed')
const { safeSend }            = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Server announcement tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('send')
      .setDescription('Send an announcement embed')
      .addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true).setMaxLength(3900))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(false))
      .addStringOption(o => o.setName('title').setDescription('Title').setRequired(false).setMaxLength(256))
      .addStringOption(o => o.setName('color').setDescription('Hex color').setRequired(false))
      .addStringOption(o => o.setName('ping').setDescription('Ping role or @everyone').setRequired(false))
      .addBooleanOption(o => o.setName('crosspost').setDescription('Crosspost if announcement channel').setRequired(false)))
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Create or set the #stryx-updates channel')
      .addBooleanOption(o => o.setName('create').setDescription('Create new channel').setRequired(false))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guild   = interaction.guild
    const guildId = guild.id
    const config  = interaction.guildConfig

    // ── setup ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const create = interaction.options.getBoolean('create') ?? true

      if (create) {
        let ch
        try {
          ch = await guild.channels.create({
            name: 'stryx-updates',
            type: ChannelType.GuildAnnouncement,
            topic: 'Official Stryx bot updates and announcements.',
            permissionOverwrites: [
              { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
            ]
          })
        } catch {
          // Fall back to text channel
          try {
            ch = await guild.channels.create({
              name: 'stryx-updates',
              type: ChannelType.GuildText,
              permissionOverwrites: [
                { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
              ]
            })
          } catch (e) {
            return interaction.editReply({ embeds: [error('Failed', e.message)] })
          }
        }

        updateConfig(client, guildId, { updates_channel_id: ch.id }, { updates_channel_id: ch.id })

        await safeSend(ch, {
          embeds: [info('📢 Stryx Updates', 'This channel will receive official Stryx bot announcements.\n\nYou can subscribe to receive them in your own server via `/announce subscribe`.')]
        })

        return interaction.editReply({ embeds: [success('Updates Channel Created', `${ch} created and set as updates channel.`)] })
      }

      return interaction.editReply({ embeds: [info('Setup', 'Use `/config logchannel` to point to an existing channel, or run this with `create: true`.')] })
    }

    // ── send ──────────────────────────────────────────────────────────────────
    if (sub === 'send') {
      const message   = interaction.options.getString('message')
      const title     = interaction.options.getString('title') ?? null
      const colorStr  = interaction.options.getString('color') ?? '#5865F2'
      const pingStr   = interaction.options.getString('ping') ?? null
      const crosspost = interaction.options.getBoolean('crosspost') ?? false
      const color     = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2

      // Resolve channel
      const targetCh = interaction.options.getChannel('channel')
        ?? (config?.updates_channel_id ? guild.channels.cache.get(config.updates_channel_id) : null)
        ?? interaction.channel

      if (!targetCh?.isTextBased()) {
        return interaction.editReply({ embeds: [error('Invalid channel', 'Target must be a text channel.')] })
      }

      // Resolve ping
      let pingContent = ''
      if (pingStr) {
        if (pingStr === '@everyone' || pingStr === 'everyone') {
          pingContent = '@everyone'
        } else if (pingStr === '@here' || pingStr === 'here') {
          pingContent = '@here'
        } else {
          const roleId = pingStr.replace(/\D/g, '')
          pingContent = roleId ? `<@&${roleId}>` : ''
        }
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(message)
        .setFooter({ text: `${guild.name} • ${interaction.user.tag}` })
        .setTimestamp()

      if (title) embed.setTitle(title)
      if (guild.iconURL()) embed.setAuthor({ name: guild.name, iconURL: guild.iconURL() })

      let sent
      try {
        sent = await targetCh.send({
          content: pingContent || undefined,
          embeds: [embed]
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      // Crosspost if announcement channel
      if (crosspost && sent && targetCh.type === ChannelType.GuildAnnouncement) {
        try { await sent.crosspost() } catch {}
      }

      return interaction.editReply({ embeds: [success('Announced', `Announcement sent to ${targetCh}.`)] })
    }
  }
}
