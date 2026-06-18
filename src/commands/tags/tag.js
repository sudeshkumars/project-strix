'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                       = require('../../../shared/db')
const { successCard, errorCard, infoCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Custom tag system')
    .addSubcommand(s => s.setName('use').setDescription('Use a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('create').setDescription('Create a tag (mod)').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true).setMaxLength(32)).addStringOption(o => o.setName('response').setDescription('Tag response').setRequired(true).setMaxLength(2000)).addStringOption(o => o.setName('perm').setDescription('Who can use it').setRequired(false).addChoices({ name: 'Everyone', value: 'user' }, { name: 'Mod+', value: 'mod' }, { name: 'Admin+', value: 'admin' })).addBooleanOption(o => o.setName('regex').setDescription('Treat name as regex trigger').setRequired(false)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a tag (mod)').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('response').setDescription('New response').setRequired(true).setMaxLength(2000)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a tag (mod)').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('info').setDescription('View tag info').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all tags').addIntegerOption(o => o.setName('page').setDescription('Page').setMinValue(1).setRequired(false))),

  async autocomplete (client, interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const tags    = db.getTags(interaction.guild.id, 25, 0)
    const choices = tags.filter(t => t.trigger.toLowerCase().includes(focused)).slice(0, 25).map(t => ({ name: t.trigger, value: t.trigger }))
    await interaction.respond(choices)
  },

  async execute (client, interaction) {
    await interaction.deferReply()

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig
    const { resolveTier, TIERS, parseTier } = require('../../../shared/permissions')

    if (sub === 'use') {
      const name = interaction.options.getString('name')
      const tag  = db.getTag(guildId, name)
      if (!tag) return interaction.editReply(errorCard('Not found', [`Tag \`${name}\` does not exist.`]))

      if (tag.perm_level && tag.perm_level !== 'user') {
        const required = parseTier(tag.perm_level)
        const resolved = resolveTier(interaction.member, config)
        if (resolved < required) return interaction.editReply(errorCard('No permission', [`This tag requires **${tag.perm_level}** permission.`]))
      }

      db.incrementTagUses(tag.id)
      return interaction.editReply({ content: tag.response })
    }

    if (resolveTier(interaction.member, config) < TIERS.MOD) {
      return interaction.editReply(errorCard('No permission', ['Creating/editing tags requires mod permission.']))
    }

    if (sub === 'create') {
      const name     = interaction.options.getString('name').toLowerCase()
      const response = interaction.options.getString('response')
      const perm     = interaction.options.getString('perm') ?? 'user'
      const regex    = interaction.options.getBoolean('regex') ?? false

      if (db.getTag(guildId, name)) return interaction.editReply(errorCard('Already exists', [`Tag \`${name}\` already exists.`]))
      db.createTag(guildId, name, response, perm, regex, [])
      return interaction.editReply(successCard('Tag Created', [`Tag \`${name}\` created.`]))
    }

    if (sub === 'edit') {
      const name     = interaction.options.getString('name')
      const response = interaction.options.getString('response')
      const tag      = db.getTag(guildId, name)
      if (!tag) return interaction.editReply(errorCard('Not found', [`Tag \`${name}\` not found.`]))
      db.updateTag(tag.id, guildId, { response })
      return interaction.editReply(successCard('Updated', [`Tag \`${name}\` updated.`]))
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name')
      if (!db.getTag(guildId, name)) return interaction.editReply(errorCard('Not found', [`Tag \`${name}\` not found.`]))
      db.deleteTag(guildId, name)
      return interaction.editReply(successCard('Deleted', [`Tag \`${name}\` deleted.`]))
    }

    if (sub === 'info') {
      const name = interaction.options.getString('name')
      const tag  = db.getTag(guildId, name)
      if (!tag) return interaction.editReply(errorCard('Not found', [`Tag \`${name}\` not found.`]))

      const lines = [
        `**Uses** \u2014 ${tag.uses}`,
        `**Perm** \u2014 ${tag.perm_level}`,
        `**Regex** \u2014 ${tag.regex ? 'Yes' : 'No'}`,
        `**Response** \u2014 \`\`\`${tag.response.slice(0, 900)}\`\`\``
      ]
      return interaction.editReply(infoCard(`\u{1f3f7}\ufe0f Tag: ${tag.trigger}`, lines))
    }

    if (sub === 'list') {
      const page = (interaction.options.getInteger('page') ?? 1) - 1
      const tags = db.getTags(guildId, 15, page * 15)
      if (!tags.length) return interaction.editReply(infoCard('\u{1f3f7}\ufe0f Tags', ['No tags found.']))

      const lines = tags.map(t => `\`${t.trigger}\` \u2014 ${t.uses} uses`)
      return interaction.editReply(infoCard(`\u{1f3f7}\ufe0f Tags \u2014 page ${page + 1}`, lines))
    }
  }
}
