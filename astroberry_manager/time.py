#!/usr/bin/env python3
# coding=utf-8

"""
Copyright(c) 2026 Radek Kaczorek  <rkaczorek AT gmail DOT com>

This library is part of Astroberry OS and Astroberry Manager
https://github.com/astroberry-official/astroberry-os
https://github.com/astroberry-official/astroberry-manager

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License version 3 as published by the Free Software Foundation.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public License
along with this library; see the file COPYING.LIB.  If not, write to
the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
Boston, MA 02110-1301, USA.
"""

import time
from datetime import datetime, timezone

def getTime(socketio):
    while True:
        timenow = datetime.now(timezone.utc)
        t = timenow.strftime('%Y-%m-%dT%H:%M:%S.%f%z')
        emitTimeData(socketio, t)
        time.sleep(1)


def emitTimeData(socketio, timenow):
    if socketio:
        socketio.emit('datetime', {
            'now': timenow
        })
