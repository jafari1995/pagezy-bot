"""Create Telethon StringSession for MTProto channel reads."""

from __future__ import annotations

import asyncio
import os

from telethon import TelegramClient
from telethon.sessions import StringSession


async def _main() -> None:
    api_id = int(os.environ["TG_API_ID"])
    api_hash = os.environ["TG_API_HASH"]
    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.start()
    session = client.session.save()
    await client.disconnect()
    print("TG_SESSION_STRING=" + session)


if __name__ == "__main__":
    asyncio.run(_main())