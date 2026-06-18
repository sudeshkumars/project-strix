'use strict'

const { EmbedBuilder } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')

module.exports = {
  name: 'messageUpdate',
  async execute (client, oldMessage, newMessage) {
    if (!newMessage.guild) return
    if (newMessage.author?.bot) return
    if (oldMessage.content === newMessage.content) return

    // Populate edit cache
    if (oldMessage.content) {
      if (!client.editCache) client.editCache = new Map()
      client.editCache.set(newMessage.channel.id, {
        author: newMessage.author, before: oldMessage.content,
        after: newMessage.content, editedAt: Date.now()
      })
      setTimeout(() => client.editCache?.delete(newMessage.channel.id), 5 * 60 * 1000)
    }

    if (!oldMessage.content) return

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle('✏️ Message Edited')
      .setURL(newMessage.url)
      .addFields(
        { name: 'Author',  value: `${newMessage.author.tag} (\`${newMessage.author.id}\`)`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Before',  value: oldMessage.content.slice(0, 1024) || '(empty)', inline: false },
        { name: 'After',   value: newMessage.content.slice(0, 1024) || '(empty)', inline: false }
      )
      .setTimestamp()

    await sendLog(client, newMessage.guild.id, 'message_edit', { embeds: [embed] }, {
      channelId: newMessage.channel.id,
      roleIds:   newMessage.member?.roles?.cache?.map(r => r.id) ?? []
    })
  }
}
