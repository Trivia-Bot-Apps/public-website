import logging
import random

import discord
from discord.ext import commands

from config import config

logging.basicConfig(level=logging.INFO)
description = "The webserver / dashboard for trivia bot."

intents = discord.Intents.none()
intents.guilds = True
intents.messages = True

bot = commands.Bot(
    command_prefix="triviawebserver:", description=description, intents=intents
)


@bot.event
async def on_ready():
    print("Logged in as")
    print(bot.user.name)
    print(bot.user.id)
    print("------")


@bot.command()
async def ping(ctx):
    await ctx.send("Trivia Web Server Running.")


bot.load_extension("web")

bot.run(config.bot_token)
