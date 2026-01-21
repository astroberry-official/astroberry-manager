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

import { geoLocation } from './location.js';
import { centerOnSolarObject } from './celestial.js';
import { updateMoon } from './moon.js';
import { syslogPrint } from './helpers.js';
import { deg2dms, deg2hms } from './functions.js';
import { socket } from './sockets.js';

function updateAlmanac(data) {
    if (!data) return;

    // Moon
    $("#moon_phase_name").html(data.moon_phase);
    $("#moon_light").html(data.moon_light + "%");
    $("#moon_rise").html(data.moon_rise);
    $("#moon_transit").html(data.moon_transit);
    $("#moon_set").html(data.moon_set);
    $("#moon_az").html(deg2dms(parseFloat(data.moon_az)));
    $("#moon_alt").html(deg2dms(parseFloat(data.moon_alt)));
    $("#moon_ra").html(deg2hms(data.moon_ra));
    $("#moon_dec").html(deg2dms(data.moon_dec));
    $(".moon_new").html(data.moon_new);
    $("#moon_full").html(data.moon_full);

    // Sun
    $("#sun_at_start").html(data.sun_at_start);
    $("#sun_ct_start").html(data.sun_ct_start);
    $("#sun_rise").html(data.sun_rise);
    $("#sun_transit").html(data.sun_transit);
    $("#sun_set").html(data.sun_set);
    $("#sun_ct_end").html(data.sun_ct_end);
    $("#sun_at_end").html(data.sun_at_end);
    $("#sun_az").html(deg2dms(parseFloat(data.sun_az)));
    $("#sun_alt").html(deg2dms(parseFloat(data.sun_alt)));
    $("#sun_ra").html(deg2hms(data.sun_ra));
    $("#sun_dec").html(deg2dms(data.sun_dec));
    $("#sun_equinox").html(data.sun_equinox);
    $(".sun_solstice").html(data.sun_solstice);

    // Mercury
    $("#mercury_rise").html(data.mercury_rise);
    $("#mercury_transit").html(data.mercury_transit);
    $("#mercury_set").html(data.mercury_set);
    $("#mercury_az").html(data.mercury_az);
    toggleAltTrend("mercury", data.mercury_alt); // set alt trend
    $("#mercury_alt").html(data.mercury_alt);

    // Venus
    $("#venus_rise").html(data.venus_rise);
    $("#venus_transit").html(data.venus_transit);
    $("#venus_set").html(data.venus_set);
    $("#venus_az").html(data.venus_az);
    toggleAltTrend("venus", data.venus_alt); // set alt trend
    $("#venus_alt").html(data.venus_alt);

    // Mars
    $("#mars_rise").html(data.mars_rise);
    $("#mars_transit").html(data.mars_transit);
    $("#mars_set").html(data.mars_set);
    $("#mars_az").html(data.mars_az);
    toggleAltTrend("mars", data.mars_alt); // set alt trend
    $("#mars_alt").html(data.mars_alt);

    // Jupiter
    $("#jupiter_rise").html(data.jupiter_rise);
    $("#jupiter_transit").html(data.jupiter_transit);
    $("#jupiter_set").html(data.jupiter_set);
    $("#jupiter_az").html(data.jupiter_az);
    toggleAltTrend("jupiter", data.jupiter_alt); // set alt trend
    $("#jupiter_alt").html(data.jupiter_alt);

    // Saturn
    $("#saturn_rise").html(data.saturn_rise);
    $("#saturn_transit").html(data.saturn_transit);
    $("#saturn_set").html(data.saturn_set);
    $("#saturn_az").html(data.saturn_az);
    toggleAltTrend("saturn", data.saturn_alt); // set alt trend
    $("#saturn_alt").html(data.saturn_alt);

    // Uranus
    $("#uranus_rise").html(data.uranus_rise);
    $("#uranus_transit").html(data.uranus_transit);
    $("#uranus_set").html(data.uranus_set);
    $("#uranus_az").html(data.uranus_az);
    toggleAltTrend("uranus", data.uranus_alt); // set alt trend
    $("#uranus_alt").html(data.uranus_alt);

    // Neptune
    $("#neptune_rise").html(data.neptune_rise);
    $("#neptune_transit").html(data.neptune_transit);
    $("#neptune_set").html(data.neptune_set);
    $("#neptune_az").html(data.neptune_az);
    toggleAltTrend("neptune", data.neptune_alt); // set alt trend
    $("#neptune_alt").html(data.neptune_alt);

    /* Format polaris hour angle for display */
    var pha = data.polaris_hour_angle;
    $("#pha").html(deg2hms(pha));

    /* Set polaris marker */
    getReticle(pha * Math.PI / 180);

    /* Compute polaris cardinal positions */
    var pnt = data.polaris_next_transit.split(':');
    $("#polaris_next_transit").html(("0" + pnt[0]).substr(-2) + "ʰ " + pnt[1] + "ᵐ " + pnt[2] + "ˢ");

    /* Color-code planets above horizon */
    var planets = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]
    $.each(planets, function (index, planet) {
        var planet_alt;
        eval('planet_alt = parseFloat(data.' + planet + '_alt' + ');'); // create dynamic variable
        // set color based on altitude
        $("#" + planet).removeClass(); // remove existing color
        if ( planet_alt > 25 ) { // set color based on altitude
            $("#" + planet).addClass("highhorizon");
        } else if ( planet_alt > 0 ) {
            $("#" + planet).addClass("lowhorizon");
        } else {
            $("#" + planet).addClass("belowhorizon");
        }
    });

    /* Set  Equinox and Solstice in order */
    var ss = new Date(data.sun_solstice);
    var se = new Date(data.sun_equinox);
    if (ss < se) { 
        $("#sun_solstice_first").css({display: ""});
        $("#sun_solstice_second").css({display: "none"});
    } else {
        $("#sun_solstice_first").css({display: "none"});
        $("#sun_solstice_second").css({display: ""});
    };

    /* Set  New Moon and Full Moon in order */
    var nm = new Date(data.moon_new);
    var fm = new Date(data.moon_full);
    if (nm < fm) { 
        $("#new_moon_first").css({display: ""});
        $("#new_moon_second").css({display: "none"});
    } else {
        $("#new_moon_first").css({display: "none"});
        $("#new_moon_second").css({display: ""});
    };

    // Update Moon Phase
    var shadow = parseFloat(data.moon_light)/100;
    var phase = data.moon_phase.split(" ")[0];
    if ( phase == "Waning") {
        shadow *= -1
    }
    updateMoon(shadow);

    //console.log("Almanac updated");
}

function getReticle(pha_angle) {
    pha_angle = pha_angle ? pha_angle : 0;
    var width = parseInt($("#polaris-reticle").width());
    var height = parseInt($("#polaris-reticle").height());

    width = 360;
    height = 360;

    if (!width || !height) return;

    var center_x = parseInt(width/2);
    var center_y = parseInt(height/2);
    var radius = parseInt(0.375 * Math.min(width, height));
    var major = parseInt(radius / 7);
    var minor = parseInt(radius / 10);
    var polaris_radius = minor * 0.5;
    var reticle_color = "#40404033";
    var reticle_border_color = "#66666666";
    var grid_color = "#ff3300";
    var text_color = "red";
    var polaris_color = "#ffffcc";
    var text_color_small = "white";
    var text_font = "Roboto Medium";
    var text_font_size = (width > 200) ? parseInt(width/27) : 8;

    const canvas = document.getElementById("polaris-reticle");
    const ctx = canvas.getContext("2d");

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // set lines solid
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // Draw reticle
    ctx.beginPath();
    ctx.arc(center_x, center_y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = reticle_border_color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center_x, center_y, radius - minor, 0, 2 * Math.PI);
    ctx.fillStyle = reticle_color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center_x, center_y, radius - minor/2, 0, 2 * Math.PI);
    ctx.strokeStyle = grid_color;
    ctx.stroke();

    // Draw major ticks
    ctx.lineWidth = 2;
    ctx.beginPath();

    ctx.moveTo(center_x, center_y);
    ctx.lineTo(center_x, center_y - radius - major/2);
    ctx.moveTo(center_x, center_y);
    ctx.lineTo(center_x, center_y + radius + major/2);
    ctx.moveTo(center_x, center_y);
    ctx.lineTo(center_x + radius + major/2, center_y);
    ctx.moveTo(center_x, center_y);
    ctx.lineTo(center_x - radius - major/2, center_y);

    var angle = 360 * Math.PI / 180;
    var step = 45 * Math.PI / 180;

    var x1, y1, x2, y2;

    for (var i = 0; i < angle ; i += step) {
        x1 = center_x + (radius - minor - major/5) * Math.sin(i);
        y1 = center_y + (radius - minor - major/5) * Math.cos(i);
        x2 = center_x + (radius + major/5) * Math.sin(i);
        y2 = center_y + (radius + major/5) * Math.cos(i);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }

    ctx.strokeStyle = grid_color;
    ctx.stroke();

    // Draw minor ticks
    ctx.lineWidth = 2;
    ctx.beginPath();

    var step = 15 * Math.PI / 180;

    for (i = 0; i < angle ; i += step) {
        x1 = center_x + (radius - minor) * Math.sin(i);
        y1 = center_y + (radius - minor) * Math.cos(i);
        x2 = center_x + (radius) * Math.sin(i);
        y2 = center_y + (radius) * Math.cos(i);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }

    ctx.strokeStyle = grid_color;
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.beginPath();

    var step = 5 * Math.PI / 180;

    for (i = 0; i < angle ; i += step) {
        x1 = center_x + (radius - minor + minor/6) * Math.sin(i);
        y1 = center_y + (radius - minor + minor/6) * Math.cos(i);
        x2 = center_x + (radius - minor/6) * Math.sin(i);
        y2 = center_y + (radius - minor/6) * Math.cos(i);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }

    ctx.strokeStyle = grid_color;
    ctx.stroke();

    // Labels
    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = text_color;
    ctx.fillText("12", center_x - text_font_size/2, center_y - radius - text_font_size);
    ctx.fillText("0", center_x - text_font_size/3, center_y + radius + text_font_size * 1.5);
    ctx.fillText("6", center_x + radius + text_font_size, center_y + text_font_size/4);
    ctx.fillText("18", center_x - radius - text_font_size * 2, center_y + text_font_size/4);

    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = text_color_small;
    ctx.fillText("View as in polar", 5, 15);
    ctx.fillText("finder scope", 5, 15 + text_font_size);


    // draw Polaris legend
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, height - 50, polaris_radius * 0.8, 0, 2 * Math.PI);
    ctx.strokeStyle = polaris_color;
    ctx.stroke();

    ctx.font = text_font_size + "px " + text_font;
    ctx.fillStyle = grid_color;
    ctx.fillText("Polaris", 20 + text_font_size, height - 45);

    // Draw Polaris
    ctx.beginPath();
    var x = center_x + (radius - minor/2) * Math.sin(pha_angle);
    var y = center_y + (radius - minor/2) * Math.cos(pha_angle);
    ctx.arc(x, y, polaris_radius, 0, 2 * Math.PI);
    ctx.strokeStyle = polaris_color;
    ctx.stroke();

    ctx.lineWidth = 1;

    ctx.beginPath();
    x = center_x + (radius - minor) * Math.sin(pha_angle);
    y = center_y + (radius - minor) * Math.cos(pha_angle);
    ctx.setLineDash([1, 3]); // set lines dashed
    ctx.moveTo(center_x, center_y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = polaris_color;
    ctx.stroke();
}

function renderMoon(phase) { // https://codepen.io/anowodzinski/pen/ZWKXPQ
    phase = 0.5;

    //console.log("Moon phase: " + phase);

    var width = parseInt($("#moon_phase").width());
    var height = parseInt($("#moon_phase").height());

    const canvas = document.getElementById("moon_phase");
    const ctx = canvas.getContext("2d");

    ctx.scale(1, 1);

	const radius = width / 2;

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000000cc';
    //ctx.fillStyle = 'red';

    ctx.beginPath();
    ctx.arc(radius, radius, radius - 5, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = 'destination-in';

    var c = (5 + phase);

    ctx.beginPath();
    ctx.arc(radius - c * phase * radius * 2, radius, radius * c, 0, 2 * Math.PI);
    ctx.fill();
}

function toggleAltTrend(planet, alt) {
    if (!planet || !alt) return;
    var last_alt = parseFloat($("#" + planet + "_alt").text());
    var new_alt = parseFloat(alt);
    //console.log(new_alt, last_alt);

    // set trend
    if ( new_alt > last_alt) {
        $("#" + planet + " span.planet_trend").removeClass("fa-arrow-down");
        $("#" + planet + " span.planet_trend").addClass("fa-arrow-up");
        $("#" + planet + " span.planet_trend").css("color", "#009933");
    } else if ( new_alt < last_alt) {
        $("#" + planet + " span.planet_trend").removeClass("fa-arrow-up");
        $("#" + planet + " span.planet_trend").addClass("fa-arrow-down");
        $("#" + planet + " span.planet_trend").css("color", "#ff3300");
    }
}

function requestAlmanac() {
    var data = {};
    data['time'] = new Date().toISOString();
    data['latitude'] = parseFloat(geoLocation.latitude);
    data['longitude'] = parseFloat(geoLocation.longitude);
    data['altitude'] = parseFloat(geoLocation.altitude);

    if (!data) return;

    socket.timeout(5000).emit("almanac", data, (err) => {
        if (err) {
            syslogPrint("Almanac data request timed out", "danger");
        } else {
            //syslogPrint("Almanac data requested");
        }
    });
}


/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function almanacEvents() {
    $("#toggle-moon").on("click", function () {
        toggleMoon();
    });

    $("#toggle-sun").on("click", function () {
        toggleSun();
    });

    $("#toggle-planets").on("click", function () {
        togglePlanets();
    });

    $("#toggle-polaris").on("click", function () {
        togglePolaris();
    });

    $("#moon-actions-center").on("click", function() {
        centerOnSolarObject("lun");
    });

    $("#sun-actions-center").on("click", function() {
        centerOnSolarObject("sol");
    });

    $("#mercury").on("click", function() {
        centerOnSolarObject("mer");
    });

    $("#venus").on("click", function() {
        centerOnSolarObject("ven");
    });

    $("#mars").on("click", function() {
        centerOnSolarObject("mar");
    });

    $("#jupiter").on("click", function() {
        centerOnSolarObject("jup");
    });

    $("#saturn").on("click", function() {
        centerOnSolarObject("sat");
    });

    $("#uranus").on("click", function() {
        centerOnSolarObject("ura");
    });

    $("#neptune").on("click", function() {
        centerOnSolarObject("nep");
    });
}

function toggleMoon() {
    $("#toggle-polaris").removeClass("button-active");
    $("#toggle-moon").addClass("button-active");
    $("#toggle-sun").removeClass("button-active");
    $("#toggle-planets").removeClass("button-active");

    $("#polaris").css({display: "none"});
    $("#moon").css({display: "block"});
    $("#sun").css({display: "none"});
    $("#planets").css({display: "none"});
}

function toggleSun() {
    $("#toggle-polaris").removeClass("button-active");
    $("#toggle-moon").removeClass("button-active");
    $("#toggle-sun").addClass("button-active");
    $("#toggle-planets").removeClass("button-active");

    $("#polaris").css({display: "none"});
    $("#moon").css({display: "none"});
    $("#sun").css({display: "block"});
    $("#planets").css({display: "none"});
}

function togglePlanets() {
    $("#toggle-polaris").removeClass("button-active");
    $("#toggle-moon").removeClass("button-active");
    $("#toggle-sun").removeClass("button-active");
    $("#toggle-planets").addClass("button-active");

    $("#polaris").css({display: "none"});
    $("#moon").css({display: "none"});
    $("#sun").css({display: "none"});
    $("#planets").css({display: "block"});
}

function togglePolaris() {
    $("#toggle-polaris").addClass("button-active");
    $("#toggle-moon").removeClass("button-active");
    $("#toggle-sun").removeClass("button-active");
    $("#toggle-planets").removeClass("button-active");

    $("#polaris").css({display: "block"});
    $("#moon").css({display: "none"});
    $("#sun").css({display: "none"});
    $("#planets").css({display: "none"});
}

export {
    requestAlmanac,
    updateAlmanac,
    getReticle,
    renderMoon,
    toggleAltTrend,
    almanacEvents
};
