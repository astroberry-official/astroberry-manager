/*
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
*/

import { getCookie, setCookie, syslogPrint } from './helpers.js';
import { updateStarChartLocation } from './celestial.js';
import { deg2dms } from './functions.js';
import { socket } from './sockets.js';

// Global Geographic location variable [Mode, Latitude, Longitude, Altitude]
var geoLocation = {};

// Map and home marker
var mainMap, homePosition;

function loadMap() { // https://leafletjs.com/examples/quick-start/
    /* Set initial location */
    var lat = geoLocation.latitude
    var lon = geoLocation.longitude

    // Reset map placeholder
    document.getElementById('map').firstChild.data = "";

    // Init map
    mainMap = L.map('map').setView([lat, lon], 4);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mainMap);

    // Setup icon
    var homeIcon = L.icon({
        iconUrl: 'assets/images/marker.png',
        iconAnchor: [16, 32]
    });

    // Setup map
    homePosition = L.marker([lat, lon], {
        title: 'Home',
        icon: homeIcon,
        draggable: true,
        autoPan: true
    }).addTo(mainMap);

    // Setup events
    homePosition.on('moveend', function (e) {
        var marker = e.target;
        var coordinates = marker.getLatLng();

        /* Update lat/lon/alt in settings tab  */
        $("#geoloc_latitude").val(coordinates.lat);
        $("#geoloc_longitude").val(coordinates.lng);

        // Center map
        setTimeout(function() {
            updateGeoloc();
        }, 500);
    });
}

function loadGeoloc() {

    // Load initial location
    if (getCookie("config")) {
        geoLocation = JSON.parse(getCookie("config")).location;
    } else {
        geoLocation = {'mode': 0, 'latitude': 0, 'longitude': 0, 'altitude': 0, 'share': false}; // fall back location
    }

    // Load location sharing preferrence
    if (geoLocation.share) {
        $('#geoloc_share').prop("checked", true);
    } else {
        $('#geoloc_share').prop("checked", false);
    }
    // Set mode
    if (geoLocation.mode > 0) {
        $("#geoloc_mode_gps").prop('checked', true);
        $("#geoloc_latitude").prop( "disabled", true );
        $("#geoloc_longitude").prop( "disabled", true );
        $("#geoloc_altitude").prop( "disabled", true );
    } else {
        $("#geoloc_mode_custom").prop('checked', true);
        $("#geoloc_latitude").prop( "disabled", false );
        $("#geoloc_longitude").prop( "disabled", false );
        $("#geoloc_altitude").prop( "disabled", false );
    }

    // Set lat/lon in footer
    $("#latitude").html(deg2dms(geoLocation.latitude));
    $("#longitude").html(deg2dms(geoLocation.longitude));

    // Set lat/lon/alt in settings tab
    $("#geoloc_latitude").val(geoLocation.latitude);
    $("#geoloc_longitude").val(geoLocation.longitude);
    $("#geoloc_altitude").val(geoLocation.altitude);

    // Set mode/lat/lon/alt in details tab
    $("#gps_mode").html(geoLocation.mode);
    $("#gps_latitude").html(geoLocation.latitude);
    $("#gps_longitude").html(geoLocation.longitude);
    $("#gps_altitude").html(geoLocation.altitude);

    syslogPrint("Location loaded", "success")
}

function updateGeoloc(data = {}) {
    // If manual mode is enabled, use custom location
    if ($('input[name="geoloc_mode"]:checked').val() == "manual") {
        // disable GPS Satellites & Details buttons
        $("#toggle-skymap").css({display: "none"});
        $("#toggle-gpsdetails").css({display: "none"});

        data['mode'] = 0;
        data['gpstime'] = new Date().toISOString();

        var latitude = parseFloat($("#geoloc_latitude").val());
        if (typeof latitude === 'number' && isFinite(latitude))
            data['latitude'] = latitude;

        var longitude = parseFloat($("#geoloc_longitude").val());
        if (typeof longitude === 'number' && isFinite(longitude))
            data['longitude'] = longitude;

        var altitude = parseFloat($("#geoloc_altitude").val());
        if (typeof altitude === 'number' && isFinite(altitude))
            data['altitude'] = altitude;

        homePosition.dragging.enable(); // enable home marker dragging
    } else if (Object.keys(data).length == 0 && $('input[name="geoloc_mode"]:checked').val() == "network") { // first hit: get location from network
        networkLocation();
        return;
    } else if (Object.keys(data).length > 0 && $('input[name="geoloc_mode"]:checked').val() == "network") { // second hit: configure controls
        // disable GPS Satellites & Details buttons
        $("#toggle-skymap").css({display: "none"});
        $("#toggle-gpsdetails").css({display: "none"});

        homePosition.dragging.disable(); // disable home marker dragging
    } else {
        // enable GPS Satellites & Details buttons
        $("#toggle-skymap").css({display: "inline-block"});
        $("#toggle-gpsdetails").css({display: "inline-block"});

        homePosition.dragging.disable(); // disable home marker dragging
    }

    // Abort processing if no data available
    // Triggers only if no gps data available and mode is set to gps (not manual)
    if (Object.keys(data).length == 0) {
        syslogPrint("Waiting for location data...", "warning");
        return;
    }

    // ***********************
    // Process available data
    // ***********************

    // Set mode
    if ('mode' in data) {
        if (data.mode == 3) { // gps mode
            $("#gpsfix").html('<span class="gpsfix_obtained">3D</span>');
            $("#gpsfix").removeClass("blink");
        } else if (data.mode == 2) { // gps mode
            $("#gpsfix").html('<span class="gpsfix_obtained">2D</span>');
            $("#gpsfix").removeClass("blink");
        } else if (data.mode == 1) { // gps mode
            $("#gpsfix").html('<span class="gpsfix_waiting fa fa-circle"></span>');
            $("#gpsfix").addClass("blink");
        } else { // manual mode
            $("#gpsfix").html('<span style="color:#f08c00;" title="Manual Mode">M</span>');
            $("#gpsfix").removeClass("blink");
        }
    }

    // Set time
    if ('gpstime' in data) {
        var d = new Date(data.gpstime);
        var date = d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).substr(-2) + "-" + ("0" + d.getUTCDate()).substr(-2) + "T" + ("0" + d.getUTCHours()).substr(-2) + ":" + ("0" + d.getUTCMinutes()).substr(-2) + ":" + ("0" + d.getUTCSeconds()).substr(-2);

        /* Update date/time in footer */
        $("#gtime").html(date);

        /* Update date/time in details tab */
        var gps_time = data.gpstime.split("T");
        $("#gps_time").html(gps_time[0] + "<br>" + gps_time[1]);

        /* Update Star Chart */
        if ($("#system_timeloc").is(':checked'))
            Celestial.date(d);
    }

    // Set location
    if ('latitude' in data && 'longitude' in data && 'altitude' in data) {
        var mode = data.mode;
        var latitude = parseFloat(data.latitude);
        var longitude = parseFloat(data.longitude);
        var altitude = parseFloat(data.altitude);

        // If new location, update & save
        if (!geoLocation || latitude != geoLocation.latitude || longitude != geoLocation.longitude || altitude != geoLocation.altitude) {
            // Set geoLocation global variable
            geoLocation.mode = mode;
            geoLocation.latitude = latitude;
            geoLocation.longitude = longitude;
            geoLocation.altitude = altitude;

            // Update lat/lon in footer
            $("#latitude").html(deg2dms(geoLocation.latitude));
            $("#longitude").html(deg2dms(geoLocation.longitude));

            // Update lat/lon/alt in settings tab
            $("#geoloc_latitude").val(geoLocation.latitude);
            $("#geoloc_longitude").val(geoLocation.longitude);
            $("#geoloc_altitude").val(geoLocation.altitude);

            // Update mode/lat/lon/alt in details tab
            $("#gps_mode").html(geoLocation.mode);
            $("#gps_latitude").html(geoLocation.latitude);
            $("#gps_longitude").html(geoLocation.longitude);
            $("#gps_altitude").html(geoLocation.altitude);

            // Save location
            setCookie("config", JSON.stringify({"location": geoLocation}));

            // Update home marker and center
            centerMap([geoLocation.latitude, geoLocation.longitude]);

            // Share approximate location (only if enabled by user)
            shareLocation([Math.round(geoLocation.latitude * 10) / 10, Math.round(geoLocation.longitude * 10) / 10]);

            // Update star chart location
            if ($("#system_timeloc").is(':checked'))
                updateStarChartLocation();

            syslogPrint("Location updated", "success");
        }
    }

    if ('satellites' in data) {
        $("#gps_hdop").html(data.hdop);
        $("#gps_vdop").html(data.vdop);

        // Update satellites list
        gpsSatellites(data.satellites);

        // Update satellites skymap
        gpsSkyChart(data.satellites);

        // Update satellites signal chart
        gpsSignalChart(data.satellites);
    }
}

function networkLocation() {
    var data = {};
    // Get location from network
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            data['mode'] = 0;
            data['gpstime'] = new Date().toISOString();

            var latitude = position.coords.latitude ? position.coords.latitude : 0;
            if (typeof latitude === 'number' && isFinite(latitude))
                data['latitude'] = latitude;

            var longitude = position.coords.longitude ? position.coords.longitude : 0;
            if (typeof longitude === 'number' && isFinite(longitude))
                data['longitude'] = longitude;

            var altitude = position.coords.altitude ? position.coords.altitude : 0;
            if (typeof altitude === 'number' && isFinite(altitude))
                data['altitude'] = altitude;

            syslogPrint("Location updated from network", "success");
            updateGeoloc(data);
        });
    } else {
        syslogPrint("Error getting location from network", "danger");
        return;
    }
}

function shareLocation(data) {
    if (!data) return;

    // check if location sharing is enabled bu user
    if ($('#geoloc_share').is(':checked')) {
        socket.timeout(5000).emit("publish", data, (err) => {
            if (err) {
                syslogPrint("Location data sharing timed out", "danger");
            } else {
                syslogPrint("Location data shared", "success");
            }
        });
    };
}

function centerMap(coordinates) {
    if (coordinates === undefined)
        return;

    try {
        mainMap.panTo(coordinates); // center map
        homePosition.setLatLng(coordinates); // move home marker
    } catch (err) {
        console.log("Invalid parameters provided for map centering", err);
        return;
    }
}

function gpsSkyChart(satellites) {
    var width = parseInt($("#sschart").width());
    var height = parseInt($("#sschart").height());

    width = 360;
    height = 360;

    if (!width || !height) return;

    var center_x = parseInt(width/2);
    var center_y = parseInt(height/2);
    var radius = parseInt(0.39 * Math.min(width, height));

    var grid_color = "#aaa";
    var background_color = "#666";
    var foreground_color = "#404040";
    var labels_color = "red";
    var text_color = "white";
    var text_font = "Roboto Medium";
    var text_font_size = (width > 200) ? width/27 : 8;
    var text_font_size_small = 0.85 * text_font_size;

    var sat_radius = 0.8 * text_font_size_small;

    const canvas = document.getElementById("skymap");
    const ctx = canvas.getContext("2d");

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // set lines solid
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // draw title
    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = text_color;
    ctx.fillText("Satellite", 5, text_font_size);
    ctx.fillText("Location", 5, text_font_size * 2);

    // background
    ctx.beginPath();
    ctx.arc(center_x, center_y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = background_color;
    ctx.fill();

    // foreground
    ctx.beginPath();
    ctx.arc(center_x, center_y, 0.94 * radius, 0, 2 * Math.PI);
    ctx.fillStyle = foreground_color;
    ctx.fill();

    // grid
    var angle = 360 * Math.PI / 180;
    var step = (360/24) * Math.PI / 180;

    ctx.beginPath();

    for (var i = 0; i < 90; i += 15) {
        var r = radius * i / 90;
        ctx.arc(center_x, center_y, r, 0, 2 * Math.PI);

        ctx.font = text_font_size_small + "px " + text_font;
        ctx.fillStyle = text_color;
        ctx.fillText(i, center_x - 0.6 * text_font_size_small, center_y + radius - r);
    }

    var x2, y2;

    for (var i = 0; i < angle ; i += step) {
        x2 = center_x + radius * Math.sin(i);
        y2 = center_y + radius * Math.cos(i);

        ctx.moveTo(center_x, center_y);
        ctx.lineTo(x2, y2);
    }

    ctx.strokeStyle = grid_color;
    ctx.stroke();

    // draw labels
    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = labels_color;
    ctx.fillText("N", center_x - text_font_size/4, center_y - radius - text_font_size/4);
    ctx.fillText("S", center_x - text_font_size/2, center_y + radius + text_font_size);
    ctx.fillText("E", center_x + radius + text_font_size/4, center_y + text_font_size/4);
    ctx.fillText("W", center_x - radius - text_font_size, center_y + text_font_size/4);

    // draw signal color coding legend
    var box_size = 15;

    ctx.beginPath();
    ctx.rect(width - 30, height - 80, box_size, box_size);
    ctx.fillStyle = '#009933';
    ctx.fill();

    ctx.beginPath();
    ctx.rect(width - 30, height - 65, box_size, box_size);
    ctx.fillStyle = '#ff9900';
    ctx.fill();

    ctx.beginPath();
    ctx.rect(width - 30, height - 50, box_size, box_size);
    ctx.fillStyle = '#ff3300';
    ctx.fill();

    ctx.beginPath();
    ctx.rect(width - 30, height - 35, box_size, box_size);
    ctx.fillStyle = '#333333';
    ctx.fill();

    ctx.font = text_font_size_small + "px " + text_font;
    ctx.fillStyle = text_color;
    ctx.fillText(">40%", width - text_font_size_small * 5.5, height - 80 + text_font_size_small);
    ctx.fillText("30-40%", width - text_font_size_small * 6.5, height - 65 + text_font_size_small);
    ctx.fillText("10-30%", width - text_font_size_small * 6.5, height - 50 + text_font_size_small);
    ctx.fillText("<10%", width - text_font_size_small * 5.5, height - 35 + text_font_size_small);

    // draw used/unused legend
    ctx.beginPath();
    ctx.arc(20, height - 25 - text_font_size_small * 2, sat_radius * 0.8, 0, 2 * Math.PI);
    ctx.fillStyle = '#cccccc';
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(20, height - 25, sat_radius * 0.8, 0, 2 * Math.PI);
    ctx.strokeStyle = '#666666';
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.font = text_font_size_small + "px " + text_font;
    ctx.fillStyle = text_color;
    ctx.fillText("used", 20 + text_font_size_small, height - 22 - text_font_size_small * 2);
    ctx.fillText("unused", 20 + text_font_size_small, height - 22);

    // draw satellites
    var satcolor;
    for (const sat in satellites) {
        if (satellites[sat]['ss'] >= 40) satcolor = '#009933';
        if (satellites[sat]['ss'] < 40 && satellites[sat]['ss'] >= 30) satcolor = '#ff9900';
        if (satellites[sat]['ss'] < 30) satcolor = '#ff3300';
        if (satellites[sat]['ss'] < 10) satcolor = '#333333';

        // rotate coords
        var az = satellites[sat]['az'] + 90;

        // convert to radians
        var az = az * Math.PI / 180;

        // calculate linear elevation
        var el = radius * (1 - satellites[sat]['el'] / 90);

        // convert length/azimuth to cartesian
        var x = parseInt((width * 0.5) - (el * Math.cos(az)));
        var y = parseInt((height * 0.5) - (el * Math.sin(az)));

        // draw satellites
        if (satellites[sat]['used']) {
            ctx.beginPath();
            ctx.arc(x, y, sat_radius, 0, 2 * Math.PI);
            ctx.fillStyle = satcolor;
            ctx.fill();
        } else {
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, sat_radius, 0, 2 * Math.PI);
            ctx.strokeStyle = satcolor;
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        // draw labels
        ctx.font = 0.9 * text_font_size_small + "px " + text_font;
        ctx.fillStyle = text_color;
        ctx.fillText(('0' + satellites[sat]['PRN']).substr(-2), x - 0.6 * 0.9 * text_font_size_small, y + 0.35 * 0.9 * text_font_size_small);
    }
}

function gpsSatellites(satellites) {
    var sats = "<table><tr align='right'><th>PRN</th><th>El</th><th>Az</th><th>Signal</th><th>Used</th></tr>";
    var satcount = 1;
    for (const sat in satellites) {
        if (satcount++ > 12) break; /* limit satellites listed to 12 */

        if (satellites[sat]['used']) {
            sats += "<tr align='right'><td>" + ("0" + satellites[sat]['PRN']).substr(-2) + "</td><td>" + satellites[sat]['el'] + "</td><td>" + satellites[sat]['az'] + "</td><td>" + satellites[sat]['ss'] + "</td><td><span class='fa fa-circle' style='color: #009933;'></span></td></tr>";
        } else {
            sats += "<tr align='right'><td>" + ("0" + satellites[sat]['PRN']).substr(-2) + "</td><td>" + satellites[sat]['el'] + "</td><td>" + satellites[sat]['az'] + "</td><td>" + satellites[sat]['ss'] + "</td><td><span class='fa fa-circle' style='color: #666;'></span></td></tr>";
        }
    }
    sats += "</table>";

    $("#gpssats").html(sats);
    $("#gps_sats").html(satellites.length);
}

function gpsSignalChart(satellites) {
    var width = parseInt($("#sschart").width());
    var height = parseInt($("#sschart").height());

    width = 360;
    height = 150;

    if (!satellites) satellites = [];

    if (!width || !height) return;

    var center_x = parseInt(width/2);
    var center_y = parseInt(height/2);

    var x = parseInt(width / 10); // bars starting position
    var bar_spacing = 3;
    var bar_width = parseInt((width - x) / satellites.length) - bar_spacing;
    var grid_color = "white";
    var text_color = "white";
    var text_font = "Roboto Medium";
    var text_font_size = (width > 200) ? width/27 : 8;

    const canvas = document.getElementById("sschart");
    const ctx = canvas.getContext("2d");

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // set lines solid
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // draw title
    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = text_color;
    ctx.fillText("Satellite Signal Strength", center_x - 80, text_font_size);

    // draw x-axis
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.strokeStyle = grid_color;
    ctx.stroke();

    // draw bars
    for (const sat in satellites) {
        // set bar width
        ctx.lineWidth = bar_width;

        // set colors
        var bar_color;
        if (satellites[sat]['ss'] >= 40) bar_color = '#009933';
        if (satellites[sat]['ss'] < 40 && satellites[sat]['ss'] >= 30) bar_color = '#ff9900';
        if (satellites[sat]['ss'] < 30) bar_color = '#cc0000';
        if (satellites[sat]['ss'] < 10) bar_color = '#333333';

        // draw bars
        ctx.beginPath();
        ctx.moveTo(x, height - 21);
        ctx.lineTo(x, height - 21 - parseInt(satellites[sat]['ss']));
        ctx.strokeStyle = bar_color;
        ctx.stroke();

        // draw values
        ctx.font = 0.8 * text_font_size + "px " + text_font;
        ctx.fillStyle = text_color;
        ctx.fillText(satellites[sat]['ss'] + '%', x - 0.7 * text_font_size, height - 21 - parseInt(satellites[sat]['ss'])/2 - 2);

        // draw labels
        ctx.font = 0.8 * text_font_size + "px " + text_font;
        ctx.fillStyle = text_color;
        ctx.fillText(('0' + satellites[sat]['PRN']).substr(-2), x - parseInt(text_font_size/2), height - 3);

        ctx.lineWidth = 2;

        // mark used satellites
        if (satellites[sat]['used']) {
            ctx.beginPath();
            ctx.moveTo(x - parseInt(text_font_size/2), height);
            ctx.lineTo(x + parseInt(text_font_size/2), height);
            ctx.strokeStyle = text_color;
            ctx.stroke();
        }

        x += bar_width + bar_spacing; // distance between bars
    }
}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function locationEvents() {

    $("#toggle-map").on("click", function () {
        toggleGeomap();
    });

    $("#toggle-skymap").on("click", function () {
        toggleSkymap();
    });

    $("#toggle-gpsdetails").on("click", function () {
        toggleGpsDetails();
    });

    $("#toggle-geolocsettings").on("click", function () {
        toggleGeolocSettings();
    });

    $("#gpsfix").on("click", function () {
        // toggle between gps and manual modes
        if ($('input[name="geoloc_mode"]:checked').val() == "manual") {
            $('#geoloc_mode_custom').prop("checked", false);
            $('#geoloc_mode_gps').prop("checked", true);
        } else {
            $('#geoloc_mode_gps').prop("checked", false);
            $('#geoloc_mode_custom').prop("checked", true);
        }
        $("#geoloc_mode").trigger("change");
    });

    $("#geoloc_custom").change(function () { // Update location if custom lat/lon/alt is entered
        updateGeoloc();
    });

    $("#geoloc_mode").change(function () {
        // Status
        $("#gpsfix").html('<span class="gpsfix_waiting fa fa-circle"></span>');
        $("#gpsfix").addClass("blink");

        if ($('input[name="geoloc_mode"]:checked').val() == "gps") {
            $("#geoloc_latitude").prop( "disabled", true );
            $("#geoloc_longitude").prop( "disabled", true );
            $("#geoloc_altitude").prop( "disabled", true );
            syslogPrint("Location source changed to GPS", "success", true);
        } else if ($('input[name="geoloc_mode"]:checked').val() == "network") {
            $("#geoloc_latitude").prop( "disabled", true );
            $("#geoloc_longitude").prop( "disabled", true );
            $("#geoloc_altitude").prop( "disabled", true );
            syslogPrint("Location source changed to network", "success", true);
        } else {
            $("#geoloc_latitude").prop( "disabled", false );
            $("#geoloc_longitude").prop( "disabled", false );
            $("#geoloc_altitude").prop( "disabled", false );
            syslogPrint("Location source changed to custom", "success", true);
        }
        updateGeoloc();
    });

    $("#geoloc_share").change(function () {
        if ($('#geoloc_share').is(':checked')) {
            syslogPrint("Location sharing enabled", "success", true);
            geoLocation.share = true;
            setCookie("config", JSON.stringify({"location": geoLocation}));
        } else {
            syslogPrint("Location sharing disabled", "success", true);
            geoLocation.share = false;
            setCookie("config", JSON.stringify({"location": geoLocation}));
        }
    });

    $("#celestial-map-location-icon").on("click", function() {
        // hide all
        $("#main-dock span").removeClass("dock-item-active");
        $(".panel-container").css({display: "none"});

        // show location
        $("#main-dock-location").addClass("dock-item-active");
        $("#panel-location").css({display: "block"});
        mainMap.invalidateSize(); // fix for map display
    });
}

function toggleGeomap() {
    $("#toggle-map").addClass("button-active");
    $("#toggle-skymap").removeClass("button-active");
    $("#toggle-gpsdetails").removeClass("button-active");
    $("#toggle-geolocsettings").removeClass("button-active");

    $("#map_container").css({display: "block"});
    $("#skymap_container").css({display: "none"});
    $("#gpsdetails_container").css({display: "none"});
    $("#geoloc_container").css({display: "none"});

    mainMap.invalidateSize(); // fix for map display
}

function toggleSkymap() {
    $("#toggle-map").removeClass("button-active");
    $("#toggle-skymap").addClass("button-active");
    $("#toggle-gpsdetails").removeClass("button-active");
    $("#toggle-geolocsettings").removeClass("button-active");

    $("#map_container").css({display: "none"});
    $("#skymap_container").css({display: "block"});
    $("#gpsdetails_container").css({display: "none"});
    $("#geoloc_container").css({display: "none"});
}

function toggleGpsDetails() {
    $("#toggle-map").removeClass("button-active");
    $("#toggle-skymap").removeClass("button-active");
    $("#toggle-gpsdetails").addClass("button-active");
    $("#toggle-geolocsettings").removeClass("button-active");

    $("#map_container").css({display: "none"});
    $("#skymap_container").css({display: "none"});
    $("#gpsdetails_container").css({display: "block"});
    $("#geoloc_container").css({display: "none"});
}

function toggleGeolocSettings() {
    $("#toggle-map").removeClass("button-active");
    $("#toggle-skymap").removeClass("button-active");
    $("#toggle-gpsdetails").removeClass("button-active");
    $("#toggle-geolocsettings").addClass("button-active");

    $("#map_container").css({display: "none"});
    $("#skymap_container").css({display: "none"});
    $("#gpsdetails_container").css({display: "none"});
    $("#geoloc_container").css({display: "block"});
}

export {
    geoLocation, // {'mode': 0, 'latitude': 0, 'longitude': 0, 'altitude': 0}
    loadGeoloc,
    updateGeoloc,
    mainMap,
    loadMap,
    centerMap,
    gpsSkyChart,
    gpsSatellites,
    gpsSignalChart,
    locationEvents
};

