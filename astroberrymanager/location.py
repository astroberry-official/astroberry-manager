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

from gpsdclient import GPSDClient

def getLocation(socketio):
    with GPSDClient() as client:
        for gps in client.dict_stream(convert_datetime=False, filter=["TPV", "SKY"]):
            if gps["class"] == "TPV":
                try:
                    if gps["mode"] > 1:
                        emitGPSData(socketio, gps["mode"], gps["time"], gps["lat"], gps["lon"], gps["alt"])
                    else:
                        emitTimeData(socketio, gps["mode"], gps["time"])
                except Exception as e:
                    pass

            if gps["class"] == "SKY":
                try:
                    emitSatData(socketio, gps["hdop"], gps["vdop"], gps["satellites"])
                except Exception as e:
                    pass

def emitTimeData(socketio, mode, time):
    if socketio:
        socketio.emit('location', {
            'mode': mode,
            'gpstime': time
        })
    else:
        print("time_data: {mode: " + mode + ", gpstime: " + time + "}")

def emitGPSData(socketio, mode, time, lat, lon, alt):
    if socketio:
        socketio.emit('location', {
            'mode': mode,
            'gpstime': time,
            'latitude': lat,
            'longitude': lon,
            'altitude': alt
        })
    else:
        print("gps_data: {mode: " + mode + ", gpstime: " + time + ", latitude: " + lat + ", longitude: " + lon + ", altitude: " + alt + "}")

def emitSatData(socketio, hdop, vdop, satellites):
    if socketio:
        socketio.emit('location', {
            'hdop': hdop,
            'vdop': vdop,
            'satellites': satellites
        })
    else:
        print("sat_data: {hdop: " + hdop + ", vdop: " + vdop + " , satellites: " + satellites + "}")

