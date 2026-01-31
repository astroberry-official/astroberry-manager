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

import { focusTerminal } from './terminal.js';
import { mainMap, locationEvents } from './location.js';
import { weatherEvents } from './weather.js';
import { almanacEvents } from './almanac.js';
import { starchartEvents } from './celestial.js';
import { equipmentEvents } from './equipment.js';
import { updateINDI, indiwebEvents } from './indiserver.js';
import { requestAlmanac } from './almanac.js';
import { requestWeather } from './weather.js';
import { requestDesktop, closeDesktop } from './desktop.js';
import { systemEvents } from './system.js';
import { searchEvents } from './search.js';

var mainLoopInterval = 1000; // main loop interval = 1 second
var mainTimer;
var tenSecCounter = 0;
var minuteCounter = 0;
var hourCounter = 0;

/* ================================================================== */
/*                             MAIN LOOP TIMER
/* ================================================================== */

function initTimer() {
    mainTimer = setInterval(mainLoop, mainLoopInterval);
}

/* ================================================================== */
/*                        MAIN LOOP
/* ================================================================== */

function mainLoop() {

    // Run once every second
    updateTime(); // Update time while in manual mod, using system time

    // Run every 10s
    if (++tenSecCounter > (10000 / mainLoopInterval)) {
        tenSecCounter = 0;
    }

    // Run every minute
    if (++minuteCounter > (60000 / mainLoopInterval)) {
        minuteCounter = 0;
        requestAlmanac();
    }

    // Run every hour
    if (++hourCounter > (3600000 / mainLoopInterval)) {
        hourCounter = 0;
        requestWeather();
    }
}

function updateTime() {
    if ($('input[name="geoloc_mode"]:checked').val() != "gps") { // gps gives us own time
        var d = new Date();
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

function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
}

/* ================================================================== */
/*                        MAIN DOCK
/* ================================================================== */

function appEvents() {
    $("#main-dock-handle").on("click", function() {
        if($("#main-dock").hasClass("dock-active")) {
            $("#main-dock").animate({left: '-50px'}); // hide main dock
            $("#main-dock").removeClass("dock-active");
        } else {
            $("#main-dock").animate({left: '0px'}); // hide main dock
            $("#main-dock").addClass("dock-active");
        }
    })
    $("#main-dock span").on("click", function() {
        var index = parseInt($("#main-dock span").index(this));
        switch (index) {
            case 0: // Search
                if ($("#main-dock-search").hasClass("dock-item-active")) {
                    $("#main-dock-search").removeClass("dock-item-active");
                    $("#panel-search").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-search").addClass("dock-item-active");
                    $("#panel-search").show();
                }
                break;

            case 1: // Almanac
                if ($("#main-dock-almanac").hasClass("dock-item-active")) {
                    $("#main-dock-almanac").removeClass("dock-item-active");
                    $("#panel-almanac").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-almanac").addClass("dock-item-active");
                    $("#panel-almanac").show();
                }
                break;

            case 2: // Equipment
                if ($("#main-dock-equipment").hasClass("dock-item-active")) {
                    $("#main-dock-equipment").removeClass("dock-item-active");
                    $("#panel-equipment").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-equipment").addClass("dock-item-active");
                    $("#panel-equipment").show();

		    // wait for svg image to load
		    setTimeout(function() {
		        updateINDI();
		    }, 500);
                    // or use jquery to wait for svg ready
                    //$("setup_status").ready( function() {
                    //    updateINDI();
                    //});
                }
                break;

            case 3: // Location
                if ($("#main-dock-location").hasClass("dock-item-active")) {
                    $("#main-dock-location").removeClass("dock-item-active");
                    $("#panel-location").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-location").addClass("dock-item-active");
                    $("#panel-location").show();
                    mainMap.invalidateSize(); // fix for map display
                }
                break;

            case 4: // Weather
                if ($("#main-dock-weather").hasClass("dock-item-active")) {
                    $("#main-dock-weather").removeClass("dock-item-active");
                    $("#panel-weather").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-weather").addClass("dock-item-active");
                    $("#panel-weather").show();
                }
                break;

            case 5: // System
                if ($("#main-dock-system").hasClass("dock-item-active")) {
                    $("#main-dock-system").removeClass("dock-item-active");
                    $("#panel-system").hide();
                } else {
                    $(".panel-container").hide(); // hide all
                    $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                    $("#main-dock-system").addClass("dock-item-active");
                    $("#panel-system").show();
                }
                break;

            case 6: // Terminal
                if ($("#main-dock-terminal").hasClass("dock-item-active")) {
                    $("#main-dock-terminal").removeClass("dock-item-active");
                } else {
                    $("#main-dock-terminal").addClass("dock-item-active");
                }
                $("#terminal-container").toggle();
                focusTerminal();
                break;

            case 7: // Star Chart
                $(".panel-container").hide(); // hide all
                $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                $("#main-dock-chart").addClass("dock-item-active");
                $("#desktop-container").hide();
                $(".celestial-map-container").show();
                $("#reticle-chart").show();
                $("#reticle-telescope").show();
                Celestial.resize(0);
                closeDesktop();

                // switch main dock item
                $("#main-dock-chart").hide();
                $("#main-dock-screen").show();

                // hide main dock
                //$("#main-dock-handle").trigger("click");
                break;

            case 8: // Desktop
                $(".panel-container").hide(); // hide all
                $("#main-dock span").removeClass("dock-item-active"); // inactivate all

                requestDesktop();
                $("#main-dock-screen").addClass("dock-item-active");
                $(".celestial-map-container").hide();
                $("#reticle-chart").hide();
                $("#reticle-telescope").hide();
                $("#desktop-container").show();

                // switch main dock item
                $("#main-dock-chart").show();
                $("#main-dock-screen").hide();

                // hide main dock
                //$("#main-dock-handle").trigger("click");
                break;

            case 9: // Fullscreen
                toggleFullScreen();
                break;

            default:
                $("#main-dock span").removeClass("dock-item-active");
                $(".panel-container").hide();
        }
    });

    $("#open-almanac").on("click", function() {
        // hide all
        $("#main-dock span").removeClass("dock-item-active");
        $(".panel-container").hide();
        // open almanac
        $("#main-dock-almanac").addClass("dock-item-active");
        $("#panel-almanac").show();

    });

}

/* ================================================================== */
/*                        SYSTEM LOGGING ROUTINE
/* ================================================================== */

function syslogPrint(msg, level, popup = false) {
    //var datetime = new Date().format("yyyy-MM-ddThh:mm:ss");
    var datetime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 19);
    var alert_level = "alert-warning";
    var msg_level = "INFO";
    var color = "#eeeeee";
    var stream = "Astroberry OS";

    if (level !== undefined && ['success', 'danger', 'warning'].includes(level) ) {
        alert_level = "alert-" + level;
        switch(level) {
            case "success":
                msg_level = "INFO";
                color = "#009933";
                break;
            case "danger":
                msg_level = "ERROR";
                color = "#ff3300";
                break;
            case "warning":
                msg_level = "WARN";
                color = "#f08c00";
                break;
            default:
                msg_level = "INFO";
                color = "#eeeeee"
        }
    }

    // format message if without date/time/level header
    // msg = datetime + ": [" + msg_level + "] " + msg;
/*
    if (stream) {
        stream = stream + "<br>" + "<font color=" + color + ">" + msg + "</font>";
    } else {
        stream = "<font color=" + color + ">" + msg + "</font>";
    }

    $("#syslog").html(stream);
*/
    stream = "<font color=" + color + ">" + msg + "</font><br>";
    $("#syslog").append(stream);

    console.log(msg);

    if(popup)
        $("#notify_message").html('<div class="alert ' + alert_level + '">' + msg + '</div>').fadeIn().delay(3000).fadeOut("slow");

    document.getElementById('syslog').scrollTop = document.getElementById('syslog').scrollHeight;
}

/* ================================================================== */
/*                             COOKIES
/* ================================================================== */

function setCookie(name, value) {
    if(getCookie(name)) {
        var _value =  JSON.parse(getCookie(name));
    } else {
        var _value = {};
    }

    for (const [key, val] of Object.entries(JSON.parse(value))) {
        if (key in Object.entries(_value)) {
            _value[key] = val;
        } else {
            _value[key] = val;
        }
    }

    let d = new Date();
    d.setTime(d.setFullYear(d.getFullYear() + 1)); // expire cookies after 1 year
    document.cookie = name + "=" + JSON.stringify(_value) + ";" + "expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}

function getCookie(name) {
    let cookie = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return cookie ? cookie[2] : null;
}

function eatCookie(name) {
    setCookie(name, "", -1);
}

/* ================================================================== */
/*                          EVENT HANDLERS
/* ================================================================== */

function eventHandlers() {
    appEvents();
    locationEvents();
    weatherEvents();
    almanacEvents();
    starchartEvents();
    equipmentEvents();
    indiwebEvents();
    searchEvents();
    systemEvents();

    // Enable tooltip
    $('[data-toggle="tooltip"]').tooltip();

    // On exit procedures
    $(window).on("beforeunload", function() {
        return "Are you sure you want to leave?";
    });

    $(window).on("unload", function(){
        //console.log("Window closed");
    });

    console.log("Event handlers loaded");
}

export {
    initTimer,
    mainLoop,
    eventHandlers,
    syslogPrint,
    getCookie,
    setCookie,
    eatCookie
};
