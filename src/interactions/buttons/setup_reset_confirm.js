'use strict'

const db = require('../../../shared/db')
const { success } = require('../../../shared/embed')

module.exports = {
  id: 'setup_reset_confirm',

  async execute (client, interaction, config) {
    await interaction.deferUpdate()

    const guildId = interaction.guild.id

    // Wipe and recreate fresh config
    db.getDb().prepare('DELETE FROM guild_config WHERE guild_id = ?').run(guildId)
    db.createGuildConfig(guildId)

    const { parseConfig } = require('../../../shared/cache')
    const fresh = db.getGuildConfig(guildId)
    client.guildCache.set(guildId, parseConfig(fresh))

    await interaction.editReply({
      embeds: [success('Settings Reset', 'All Stryx settings have been reset to defaults. Run `/setup wizard` to reconfigure.')],
      components: []
    })
  }
}
