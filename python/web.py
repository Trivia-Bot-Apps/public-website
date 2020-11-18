import base64
import os
import time
import urllib.parse
from json import dumps, loads

import aiohttp
import aiohttp_jinja2
import aiohttp_session
import discord
import jinja2
import redis
from aiohttp import web
from aiohttp_session import get_session
from aiohttp_session.cookie_storage import EncryptedCookieStorage
from cryptography import fernet
from discord.ext import commands, tasks

from config import config

r = redis.Redis(host="localhost", port=6379, db=0)


def make_app():
    app = web.Application()
    fernet_key = fernet.Fernet.generate_key()
    secret_key = base64.urlsafe_b64decode(fernet_key)
    aiohttp_session.setup(app, EncryptedCookieStorage(secret_key))
    return app


routes = web.RouteTableDef()
app = make_app()

aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader("html"))


def setup(bot):
    bot.add_cog(Webserver(bot))


defaultprefix = ";"


def tbprefix(statement, guild, setto=None):
    if statement == "get":
        try:
            bytedata = r.hgetall(str(guild) + "-prefix")
            data = {}
            for key in bytedata.keys():
                data[key.decode("ascii")] = bytedata[key].decode("ascii")
            return data["prefix"]
        except BaseException:
            return defaultprefix


class Webserver(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.web_server.start()

        @routes.get("/")
        @aiohttp_jinja2.template("index.jinja2")
        async def welcome(request):
            return {}

        @routes.get("/login")
        async def login(request):
            raise web.HTTPFound(
                f"https://discord.com/api/oauth2/authorize?client_id=715047504126804000&promt=none&redirect_uri={urllib.parse.quote(config.callback_uri)}&response_type=code&scope=identify%20guilds"
            )

        @routes.get("/callback")
        async def callback(request):
            params = request.rel_url.query
            code = params["code"]
            data = {
                "client_id": "715047504126804000",
                "client_secret": config.client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": config.callback_uri,
                "scope": "identify guilds",
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://discord.com/api/v6/oauth2/token",
                    data=data,
                    headers=headers,
                ) as response:
                    response = loads(await response.text())
                    print(response)
                    access_token = response["access_token"]
                    print(access_token)
                    session = await get_session(request)
                    session["access_token"] = access_token
            raise web.HTTPFound("/load")

        @routes.get("/load")
        @aiohttp_jinja2.template("server_list.jinja2")
        async def load(request):
            return {
                "html": 'Loading, please wait...<script>window.location.replace("/home");</script>'
            }

        @routes.get("/home")
        @aiohttp_jinja2.template("server_list.jinja2")
        async def home(request):
            session = await get_session(request)
            try:
                access_token = session["access_token"]
            except BaseException:
                print("no access token found so have user log in again")
                raise web.HTTPFound(
                    f"https://discord.com/api/oauth2/authorize?client_id=715047504126804000&promt=none&redirect_uri={urllib.parse.quote(config.callback_uri)}&response_type=code&scope=identify%20guilds"
                )
            user_guilds = await get_user_guilds(request)
            user_guild_names = [x["name"] for x in user_guilds]
            user_guild_ids = [x["id"] for x in user_guilds]
            user_guilds_contain_bot = []
            bot_servers_ids = [guild.id for guild in bot.guilds]
            for id in user_guild_ids:
                id = int(id)
                try:
                    if id in bot_servers_ids:
                        guild = await self.bot.fetch_guild(id)
                        user_guilds_contain_bot.append(guild)
                except BaseException:
                    pass
            user_guilds_contains_bot_ids = [
                guild.id for guild in user_guilds_contain_bot
            ]
            user_guilds_contain_bot_names = [
                guild.name for guild in user_guilds_contain_bot
            ]
            return_text = "<table style='width:100%'><tr><th>Click on a server to view it's dashboard.</th></tr>"
            for guild in user_guilds_contain_bot:
                userinfo = await get_user_info(request)
                userid = int(userinfo["id"])
                member = await guild.fetch_member(userid)
                if member.guild_permissions.manage_guild:
                    return_text += f'<tr><td style="text-align:center"><a href="/guild/{guild.id}">{guild.name}</a></td></tr>'
            return_text += "</table><br><br><i>Note only guilds that you share with the bot and have the MANAGE_GUILD permission in are on this list. To invite the bot go to <a href='https://triviabot.tech/invite'>https://triviabot.tech/invite</a></i>"
            return {"html": return_text}

        @routes.get("/guild/{guildid}")
        @aiohttp_jinja2.template("server_list.jinja2")
        async def guildinfo(request):
            if True:
                guild_id = request.match_info["guildid"]
                userinfo = await get_user_info(request)
                print(str(userinfo))
                userid = userinfo["id"]
                guild = await self.bot.fetch_guild(guild_id)
                user = await guild.fetch_member(str(userid))
                if user is None or not user.guild_permissions.manage_guild:
                    return {
                        "html": 'User does not have "Manage Guild" permissions in the selected guild or is not in the selected guild'
                    }
                else:
                    guild_prefix = tbprefix("get", guild.id)
                    return {
                        "html": f"Trivia Bot is up and running in this server. The prefix is {guild_prefix}."
                    }

        @routes.get("/api")
        async def api(request):
            api_returns = {
                "server_count": len(self.bot.guilds),
                "user_count": len(self.bot.users),
            }
            return web.response_json(text=dumps(api_returns), content_type="json")

        async def get_user_guilds(request):
            session = await get_session(request)
            access_token = session["access_token"]
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Bearer " + access_token,
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://discord.com/api/v6/users/@me/guilds", headers=headers
                ) as response:
                    return loads(await response.text())

        async def get_user_info(request):
            session = await get_session(request)
            access_token = session["access_token"]
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Bearer " + access_token,
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://discord.com/api/v6/users/@me", headers=headers
                ) as response:
                    response_text = await response.text()
                    response_json = loads(response_text)
            return response_json

        self.webserver_port = config.port
        app.add_routes(routes)

    @tasks.loop()
    async def web_server(self):
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host="0.0.0.0", port=config.port)
        await site.start()

    @web_server.before_loop
    async def web_server_before_loop(self):
        await self.bot.wait_until_ready()
