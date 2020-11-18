const express = require('express')
const fetch = require('node-fetch')
const btoa = require('btoa')
const crypto = require('crypto')
const { catchAsync } = require('../utils')
const { inGuild, getUser } = require('./bot.js')
const { getLeaderboard, getPoints, getPrefix, setPrefix, getLang, setLang } = require('./storage')
const { response } = require('express')
const router = express.Router()

const CLIENT_ID = '247594208779567105' // process.env.CLIENT_ID;
const CLIENT_SECRET = 'NKJSDFhbudsfjdf' // process.env.CLIENT_SECRET;
const redirect = encodeURIComponent('https://triviabot.tech/api/discord/callback')

router.get('/login', (req, res) => {
  req.session.oauthState = crypto.randomBytes(16).toString('hex')
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=identify%20guilds&response_type=code&redirect_uri=${redirect}&state=${req.session.oauthState}`)
})

router.get('/logout', async (req, res) => {
  const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
  const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
    method: 'POST',
    body: `token=${req.session.oauthToken}`,
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  req.session.destroy(() => {
    res.redirect('/')
  })
})

router.get('/callback', catchAsync(async (req, res) => {
  if (!req.query.code) throw new Error('NoCodeProvided')
  if (req.session.oauthState != req.query.state) throw new Error('InvalidState')
  const code = req.query.code
  const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
  const response = await fetch('https://discord.com/api/oauth2/token',
    {
      method: 'POST',
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  const json = await response.json()
  req.session.oauthToken = json.access_token
  req.session.oauthExpiry = Date.now() + json.expires_in * 1000
  if (req.session.loginRedirect) {
    res.redirect(req.session.loginRedirect)
  } else {
    res.redirect('/')
  }
}))

router.get('/user', async (req, res) => {
  if (req.session.oauthToken != undefined && req.session.oauthExpiry >= Date.now()) {
    let response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${req.session.oauthToken}`
      }
    })
    response = await response.json()
    let id
    try {
      id = response.id
    } catch(error) {
      return res.send({ logged_in: false })
    }
    let points = await getPoints(id)
    return res.send({ logged_in: true, id: id, points: points})
  } else {
    return res.send({ logged_in: false })
  }
})
const hasManagePerms = (req, id) => {
  return new Promise(async (done, err) => {
    let response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${req.session.oauthToken}`
      }
    })
    response = await response.json()
    try {
      let guild
      response.forEach((item) => {
        if (item.id == id) {
          guild = item
        }
      })
      done((guild && (guild.permissions & 0x20) == 0x20) ? guild : false)
    } catch(error) {
      done(false)
    }
  })
}
// Wrapper for authenticating route for logged in users
const loggedIn = (func) => {
  return catchAsync(async (req, res) => {
    if (!req.session.oauthToken) throw new Error('NotLoggedIn')
    if (req.session.oauthExpiry <= Date.now()) throw new Error('TokenExpired')
    func(req, res)
  })
}

router.get('/guilds', loggedIn(async (req, res) => {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: {
      Authorization: `Bearer ${req.session.oauthToken}`
    }
  })
  const json = await response.json()
  data = []
  const guildPromises = []
  json.forEach((item) => {
    guildPromises.push(new Promise(async (done, error) => {
      let iconurl
      let staticIcon
      if (item.icon != null) {
        iconurl = `https://cdn.discordapp.com/icons/${item.id}/${item.icon}.${item.icon.substring(0, 2) == 'a_' ? 'gif' : 'png'}`
        staticIcon = `https://cdn.discordapp.com/icons/${item.id}/${item.icon}.png`
      } else {
        iconurl = 'https://cdn.discordapp.com/embed/avatars/1.png'
        staticIcon = 'https://cdn.discordapp.com/embed/avatars/1.png'
      }
      let botInGuild = await inGuild(String(item.id))
      let hasManageGuildPerms = (item.permissions & 0x20) == 0x20
      data.push({ name: item.name, id: item.id, icon: iconurl, static_icon: staticIcon, bot_in_guild: botInGuild, can_manage_guild: hasManageGuildPerms })
      done()
    }))
  })
  Promise.all(guildPromises).then(() => {
    res.send(data)
  })
}))
router.get('/leaderboard', async (req, res) => {
  data = await getLeaderboard(0, 10)
  sorted = []
  for (let i = 0; i < data.length; i++) {
    if (i <= 2) {
      const user = data[i]
      const userInfo = await getUser(user[0])
      if (userInfo) {
        sorted.push({ id: user[0], name: userInfo.username, points: user[1], discriminator: userInfo.discriminator, avatar: `https://cdn.discordapp.com/avatars/${user[0]}/${userInfo.avatar}.png` })
      }
    } else {
      const user = data[i]
      const userInfo = await getUser(user[0])
      if (userInfo) {
        sorted.push({ id: user[0], name: userInfo.username, points: user[1], discriminator: userInfo.discriminator })
      }
    }
  }
  res.send(sorted)
})
router.get('/guild/:id/options', async (req, res) => {
  if (req.params.id) {
    if (req.session.guildId == req.params.id) {
      res.send({prefix: await getPrefix(req.params.id), lang: await getLang(req.params.id), name: req.session.guildName})
    } else {
      res.send('400: Bad Request. Nice try, bot. Code 0')
    }
  } else {
    res.status(400).send('400: Bad Request. Nice try, bot. Code 1')
  }
})
router.post('/guild/:id/options', loggedIn(async (req, res) => {
  if (req.params.id) {
    if (await hasManagePerms(req, req.params.id)) {
      if (req.body.prefix && req.body.lang) {
        if (req.body.prefix.length <= 7 && ['en', 'es', 'zh-CN', 'fr', 'ru'].includes(req.body.lang)) {
          await setPrefix(req.params.id, req.body.prefix)
          await setLang(req.params.id, req.body.lang)
          res.status(200)
        } else {
          res.status(400).send('Prefix or Language not valid')
        }
      } else {
        res.status(403).send('You do not have permission')
      }
    }
  } else {
    res.status(400).send('Missing Parameter')
  }
}))

module.exports = {router: router, canManageGuild: hasManagePerms}
