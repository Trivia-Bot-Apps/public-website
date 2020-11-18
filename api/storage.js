const redis = require('redis')

const client = redis.createClient({
  url: 'redis://default:canada@nasa.gov/'
})

client.on('ready', () => {
  console.log('\x1b[1m\x1b[35m%s\x1b[0m', "Connected To Redis")
})

function getLeaderboard (start, end) {
  return new Promise((done, err) => {
    client.hgetall('data', (error, data) => {
      if (error) console.error(error)
      sortedData = Object.entries(data)
        .sort(([, a], [, b]) => b - a)
      done(sortedData.slice(start, end))
    })
  })
}
function getPoints (id) {
  return new Promise((done, err) => {
    client.hgetall('data', (error, data) => {
      if (error) console.error(error)
      try {
        done(data[`${id}`])
      } catch(error) {
        done(0)
      }
    })
  })
}

function getPrefix (id) {
  return new Promise((done, err) => {
    client.hget(`${id}-prefix`, 'prefix', (error, data) => {
      if (error) done(';')
      done(data)
    })
  })
}

function setLang (id, lang) {
  return new Promise((done, err) => {
    client.set(`${id}-lang-data`, lang, (error, data) => {
      if (error) console.error(error)
      done()
    })
  })
}
function getLang (id) {
  return new Promise((done, err) => {
    client.get(`${id}-lang-data`, (error, data) => {
      if (error || data == null) done('en')
      done(data)
    })
  })
}

function setPrefix (id, prefix) {
  return new Promise((done, err) => {
    client.hset(`${id}-prefix`, 'prefix', prefix, (error, data) => {
      if (error) console.error(error)
      done()
    })
  })
}

module.exports = { client: client, getLeaderboard: getLeaderboard, getPoints: getPoints, setPrefix: setPrefix, getPrefix: getPrefix, setLang: setLang, getLang: getLang }
