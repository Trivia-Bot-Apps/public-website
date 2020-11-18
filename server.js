const express = require('express')
const path = require('path')
const session = require('express-session')
const { client } = require('./api/storage')
let RedisStore = require('connect-redis')(session)
const app = express()
const DDDoS = require('dddos');
const { canManageGuild } = require('./api/oauth')

app.use(new DDDoS({
  errorData: 'Please chill and stop ddosing us',
  maxWeight: 50
}).express())

app.use(session({
  store: new RedisStore({client: client, prefix: 'sess-'}),
  secret: 'oldmcdonaldhadafarmeieio',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 604800000 }
}))
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')))
app.use('/api/discord', require('./api/oauth').router)
app.get('/login', (req, res) => {
  res.redirect('/api/discord/login')
})
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'))
})
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/leaderboard.html'))
})
app.get('/dashboard', (req, res) => {
  if (req.session.oauthToken && req.session.oauthExpiry >= Date.now()) {
    res.sendFile(path.join(__dirname, 'frontend/dashboard.html'))
  } else {
    req.session.loginRedirect = '/dashboard'
    res.redirect('/login')
  }
})
app.get('/invite', async (req, res) => {
  res.redirect('https://discord.com/oauth2/authorize?client_id=715047504126804000&scope=bot&permissions=289856&redirect_uri=https%3A%2F%2Fdiscord.com%2Finvite%2FJwrrR5t&response_type=code')
})
app.get('/server', async (req, res) => {
  res.redirect('https://discord.gg/Pgt8ZJJkuD')
})
app.get('/dashboard/guild/:id', async (req, res) => {
  if (req.session.oauthToken && req.session.oauthExpiry >= Date.now()) {
    response = await canManageGuild(req, req.params.id)
    if (response) {
      req.session.guildName = response.name
      req.session.guildId = req.params.id
      res.sendFile(path.join(__dirname, 'frontend/options.html'))
    } else {
      res.redirect('/error?msg=guildperms')
    }
  } else {
    req.session.loginRedirect = '/dashboard'
    res.redirect('/login')
  }
})
app.get('/api/botinvitecallback', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/invitecallback.html'))
})

app.use((err, req, res, next) => {
  switch (err.message) {
    case 'NoCodeProvided':
      return res.status(400).send({
        status: 'ERROR',
        error: err.message
      })
    case 'InvalidState':
      return res.status(400).send({
        status: 'ERROR',
        error: err.message
      })
    case 'NotLoggedIn':
      return res.redirect('/api/discord/login')
    case 'TokenExpired':
      return res.redirect('/api/discord/login')
    default:
      return res.status(500).send({
        status: 'ERROR',
        error: err.message
      })
  }
})

app.listen(1080, () => {
  console.log('\x1b[1m\x1b[34m%s\x1b[0m', 'Webserver started at http://localhost:1080')
})
