#!/usr/bin/env python3
# coding=utf-8

"""
Copyright(c) 2025 Radek Kaczorek  <rkaczorek AT gmail DOT com>

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

import json
import yr_weather

USER_AGENT = "astroberry-os/1.0 https://github.com/astroberry-official/astroberry-os"
headers = {"User-Agent": USER_AGENT}

weather = yr_weather.Locationforecast(headers=headers, use_cache=False)
#geosat = yr_weather.Geosatellite()

def getWeather(socketio, latitude, longitude):
	forecast = weather.get_forecast(latitude, longitude)
	forecastJSON = json.dumps(forecast, default=vars)
	emitWeather(socketio, forecastJSON)

def emitWeather(socketio, data):
	if socketio and data:
		socketio.emit('weather', data)
	else:		
		print(data)
