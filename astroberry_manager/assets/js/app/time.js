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

import { syslogPrint } from './helpers.js';

var timeNow = new Date();

function updateTime(data) {
    var c = new Date(); // default: client time
    var d = c;

    if ( data !== undefined && data !== null )
        d = new Date(data); // if available: server time

    var diffTime = Math.abs(d - c);

    if ( diffTime > 5000 ) // milliseconds
        syslogPrint("System time is different than your time", "danger", true);

    timeNow = d; // update global variable

    if ($('input[name="geoloc_mode"]:checked').val() != "gps") { // gps gives us own time
        var date = d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).substr(-2) + "-" + ("0" + d.getUTCDate()).substr(-2) + "T" + ("0" + d.getUTCHours()).substr(-2) + ":" + ("0" + d.getUTCMinutes()).substr(-2) + ":" + ("0" + d.getUTCSeconds()).substr(-2);

        // Update date/time in footer
        $("#gtime").html(date);

        // Update date/time in details tab
        var gps_time = date.split("T");
        $("#gps_time").html(gps_time[0] + "<br>" + gps_time[1]);

        // Update Star Chart
        if ($("#system_timeloc").is(':checked'))
            Celestial.date(d);
    }
}

export {
    timeNow,
    updateTime
};
