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

import { getDriverDetails } from './indiserver.js';
import { syslogPrint } from './helpers.js';

// Supported device types
const deviceTypes = ["GENERAL", "TELESCOPE", "CCD", "GUIDER", "FOCUSER", "FILTER", "DOME", "GPS", "WEATHER", "AO", "DUSTCAP", "LIGHTBOX", "DETECTOR", "ROTATOR", "SPECTROGRAPH", "CORRELATOR", "AUX"];

var equipmentImage = document.getElementById("setup_status").contentDocument;
var activeEquipment = {'profile': "Simulators", 'devices': []};

/* ================================================== */
/*              Process INDI server data
/* ================================================== */

function updateEquipment(data) {
    // don't process incomplete data
    if (data === undefined || data == null) {
        return;
    }

    if ('equipment' in data) {
        data = data['equipment'];
        if (data === undefined || data == null) return;
        activeEquipment.devices = Object.keys(data);
        markActiveDrivers(activeEquipment.devices);
    }

    if ('msg' in data) {
        data = data['msg'];
        if (data === undefined || data == null) return;
    }
}

/* ================================================== */
/*              Control equipent image
/* ================================================== */

function markAllDrivers(status) { // helper function
    $.each(deviceTypes, function (index, device) {
        markActiveDriver(device, status)
    });
}

function markActiveDrivers(devices) { // helper function
    $.each(devices, function (index, device) {
        markActiveDriver(device, true)
    });
}

function markActiveDriver(device, status) {
    if (device === undefined || device == null ) return;

    equipmentImage = document.getElementById("setup_status").contentDocument;

    if (equipmentImage === undefined || equipmentImage == null) return;

    device = device.toLowerCase();

    if (!device in deviceTypes) {
        syslogPrint(device + " device not supported", "danger");
        return; // svg equipment image does not support this device
    }

    var color_on = "#009933";
    var color_off = "#578cad";

    if (device == "rotator" || device == "lightbox") {
        var color = status ? "#009933" : "#76b9dd";
    } else {
        var color = status ? "#009933" : "#578cad";
    }

    // Set device status in equipment image
    var item = equipmentImage.getElementById(device);

    if (item === undefined || item == null) return;

    // Set active device color
    if ($.inArray(device, ["dome", "weather", "gps", "ao", "detector", "aux"]) !== -1) {
        item.style.stroke = color;
    } else {
        item.style.fill = color;
    }

    // Set events handlers for active device
    item.onclick = getDriverDetails; // device click event
    item.onmouseover = function () { // mouse over
        item.style.cursor = "pointer";
    };
    item.onmouseout = function () { // mouse out
        item.style.cursor = "default";
    };

}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function equipmentEvents() {
    $("#toggle-profile").on("click", function () {
        $("#profile_name").val("");
        toggleProfile();
    });

    $("#toggle-profile-settings").on("click", function () {
        $("#profile_name").val("");
        toggleProfileSettings();
    });
}

function toggleProfile() {
    $("#toggle-profile").addClass("button-active");
    $("#toggle-profile-settings").removeClass("button-active");
    $("#server_status").css({display: "block"})
    controlProfile();
}

function toggleProfileSettings() {
    $("#toggle-profile").removeClass("button-active");
    $("#toggle-profile-settings").addClass("button-active");
    $("#server_status").css({display: "none"})
    $("#driver_details").trigger("click"); // hide driver details
    editProfile();
}

function controlProfile() {
    $("#profile_view").css({display: "block"});
    $("#profile_ctrl").css({display: "block"});
    $("#setup_status").css({display: "block"});
    $("#profile_settings").css({display: "none"});
}

function editProfile() {
    $("#profile_view").css({display: "block"});
    $("#profile_ctrl").css({display: "none"});
    $("#setup_status").css({display: "none"});
    $("#profile_settings").css({display: "block"});

    $('#profiles').change(); //getProfileDrivers();
}

export {
    updateEquipment,
    markAllDrivers,
    markActiveDrivers,
    markActiveDriver,
    equipmentEvents,
    activeEquipment, /* List of device types connected to INDI server  */
};
