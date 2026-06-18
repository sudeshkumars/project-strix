'use strict'

const { EmbedBuilder } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')

module.exports = {
  name: 'guildMemberUpdate',
  async execute (client, oldMember, newMember) {
    const guildId = newMember.guild.id
    const roleIds = newMember.roles.cache.map(r => r.id)

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📝 Nickname Changed')
        .addFields(
          { name: 'User',   value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: false },
          { name: 'Before', value: oldMember.nickname ?? '(none)', inline: true },
          { name: 'After',  value: newMember.nickname ?? '(none)', inline: true }
        )
        .setTimestamp()
      await sendLog(client, guildId, 'member_update', { embeds: [embed] }, { roleIds })
    }

    // Role changes
    const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id))
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id))

    if (added.size || removed.size) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🎭 Roles Updated')
        .addFields({ name: 'User', value: `${newMember.user.tag} (\`${newMember.id}\`)`, inline: false })
        .setTimestamp()

      if (added.size)   embed.addFields({ name: '✅ Added',   value: added.map(r => `${r}`).join(', ').slice(0, 1024),   inline: false })
      if (removed.size) embed.addFields({ name: '❌ Removed', value: removed.map(r => `${r}`).join(', ').slice(0, 1024), inline: false })

      await sendLog(client, guildId, 'role_change', { embeds: [embed] }, { roleIds })
    }
  }
}
