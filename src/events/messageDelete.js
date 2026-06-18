'use strict'

const { EmbedBuilder } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')

module.exports = {
  name: 'messageDelete',
  async execute (client, message) {
    if (!message.guild) return
    if (message.author?.bot) return

    // Populate snipe cache
    if (message.author && (message.content || message.attachments?.size)) {
      if (!client.snipeCache) client.snipeCache = new Map()
      const img = message.attachments?.find(a => a.contentType?.startsWith('image/'))
      client.snipeCache.set(message.channel.id, {
        author: message.author, content: message.content,
        imageUrl: img?.url ?? null, deletedAt: Date.now()
      })
      setTimeout(() => client.snipeCache?.delete(message.channel.id), 5 * 60 * 1000)
    }

    if (!message.content && !message.attachments?.size) return

    const embed = new EmbedBuilder()
      .setColor(COLORS.error)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author',  value: message.author ? `${message.author.tag} (\`${message.author.id}\`)` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
      )
      .setTimestamp()

    if (message.content) embed.addFields({ name: 'Content', value: message.content.slice(0, 1024), inline: false })
    if (message.attachments?.size) {
      embed.addFields({ name: 'Attachments', value: [...message.attachments.values()].map(a => a.url).join('\n').slice(0, 1024), inline: false })
    }

    await sendLog(client, message.guild.id, 'message_delete', { embeds: [embed] }, {
      channelId: message.channel.id,
      roleIds:   message.member?.roles?.cache?.map(r => r.id) ?? []
    })
  }
}
