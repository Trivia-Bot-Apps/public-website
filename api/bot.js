const Discord = require('discord.js-light')
const client = new Discord.Client({
  cacheGuilds: false,
  cacheChannels: false,
  cacheOverwrites: false,
  cacheRoles: false,
  cacheEmojis: false,
  cachePresences: false
})
let ready = false
client.on('ready', async () => {
  console.log('\x1b[1m\x1b[32m%s\x1b[0m',`Logged in as ${client.user.tag}!`)
  ready = true
})

function inGuild (id) {
  while (!ready) {}
  return new Promise(async (done, err) => {
    try {
      await client.guilds.fetch(id)
      done(true)
    } catch (err) {
      done(false)
    }
  })
}

function getUser (id) {
  while (!ready) {}
  return new Promise(async (done, err) => {
    try {
      user = await client.users.fetch(id)
    } catch (error) {
      user = null
    }
    done(user)
  })
}

client.login('NzE1MDQ3NTA0MTI2ODA0MDAwXwsKAdShZjJ5a3d6dw.a==')
module.exports = { inGuild: inGuild, getUser: getUser }
