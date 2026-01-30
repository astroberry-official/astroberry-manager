/*
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
*/

import { updateGeoLocation } from './location.js';
import { updateWeather } from './weather.js';
import { updateAlmanac } from './almanac.js';
import { indiServerConnected, indiServerDisconnected } from './indiserver.js';
import { updateEquipment } from './equipment.js';
import { updateTelescope } from './celestial.js';
import { updateSystem } from './system.js';
import { syslogPrint } from './helpers.js';

/* Main Socket */
const socketUrl = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port: '');
const socket = io.connect(socketUrl, { path: location.pathname  + 'socket.io' });

function setSockets() {
    socket.onAny((event, ...args) => { // catch-all
        // console.log(`socketio: ${event} received`);
    });

    socket.on('connect', function () {
        console.log("Socket connected");
    });

    socket.on("connect_error", (err) => {
        console.log(`connect_error due to ${err.message}`);
    });

    socket.on('disconnect', function () {
        console.log("Socket disconnected");
    });

    socket.on('location', function (data) { // location
        if ($('input[name="geoloc_mode"]:checked').val() == "gps")
            updateGeoLocation(data);
    });

    socket.on('weather', function (data) { // location
        // console.log(data);
        updateWeather(data);
    });

    socket.on('almanac', function (data) { // location & almanac
        // console.log(data);
        updateAlmanac(data);
    });

    socket.on('indiserver', function (data) { // equipment
        //console.log(data);
        if (data.connect) indiServerConnected();
        if (data.disconnect) indiServerDisconnected();
        updateEquipment(data);
        updateTelescope(data);
    });

    socket.on('system', function (data) { // equipment
        if ("update" in data) {
            if (data['update']) {
                syslogPrint("System update successful", "success", true);
            } else {
                syslogPrint("System update failure!", "danger", true);
            }
        } else if ("backup" in data) {
            if (data['backup']) {
                syslogPrint("Creating backup copy successful", "success", true);
            } else {
                syslogPrint("Creating backup copy failure!", "danger", true);
            }
        } else if ("restore" in data) {
            if (data['restore']) {
                syslogPrint("Restoring backup copy successful", "success", true);
            } else {
                syslogPrint("Restoring backup copy failure!", "danger", true);
            }
        } else if ("restart" in data) {
            if (data['restart']) {
                syslogPrint("System restart successful", "success", true);
            } else {
                syslogPrint("System restart failure!", "danger", true);
            }
        } else if ("shutdown" in data) {
            if (data['shutdown']) {
                syslogPrint("System shudown successful", "success", true);
            } else {
                syslogPrint("System shutdown failure!", "danger", true);
            }
        } else {
            updateSystem(data);
        }
    });

    console.log("Sockets loaded");
}

export {
    socket,
    setSockets
};
