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

import { setSockets } from './app/sockets.js';
import { loadGeoLocation, updateGeoLocation, loadMap } from './app/location.js';
import { requestAlmanac } from './app/almanac.js';
import { loadWeather } from './app/weather.js';
import { requestStarChart, updateStarChartLocation } from './app/celestial.js';
import { updateINDI } from './app/indiserver.js';
import { initTimer, eventHandlers, syslogPrint } from './app/helpers.js';
import { requestTerminal } from './app/terminal.js';

/* ================================================================== */
/*                           MAIN APP ROUTINE
/* ================================================================== */

$(document).ready(function() {
    // Init
    syslogPrint("Astroberry OS");

    // Init sockets
    setSockets();

    // Get saved location
    loadGeoLocation();

    // Init geo maps
    loadMap();

    // Display star chart
    requestStarChart();

    // Update geolocation
    updateGeoLocation();
    updateStarChartLocation();

    // Update weather
    loadWeather();

    // Update almanac
    requestAlmanac();

    // Load terminal
    requestTerminal();

    // Update from INDI server API
    setTimeout(function() {
      updateINDI();
    }, 1000); // don't run too early, we need to give a second for API service to start up

    // Init event handlers
    eventHandlers();

    // Start main loop
    initTimer();
});
