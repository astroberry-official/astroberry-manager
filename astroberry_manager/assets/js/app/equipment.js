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

import { updateTelescopeStatusIcon } from './celestial.js';
import { syslogPrint } from './helpers.js';
import { socket } from './sockets.js';

// Supported device types
const deviceGroups = ["GENERAL", "TELESCOPE", "CCD", "GUIDER", "FOCUSER", "FILTER", "DOME", "GPS", "WEATHER", "AO", "DUSTCAP", "LIGHTBOX", "DETECTOR", "ROTATOR", "SPECTROGRAPH", "CORRELATOR", "AUX"];
//const deviceFamilies = ["Adaptive Optics", "Agent", "Auxiliary", "CCDs", "Domes", "Filter Wheels", "FilterWheels", "Focusers", "Spectrographs", "Telescopes", "Weather"];

const indiwebUrl = location.protocol + '//' + location.hostname;

/* ================================================== */
/*          Communicate with INDI API
/* ================================================== */

function loadINDI() {
     updateINDI();
     console.log("Equipment loaded");
}

function indiServerConnected() {
    console.log("Connected to INDI Server");
    updateINDI();
    updateTelescopeStatusIcon(true);
    $("#reticle-telescope").show();
}

function indiServerDisconnected() {
    console.log("Disconnected from INDI Server");
     $("#reticle-telescope").hide();
    updateTelescopeStatusIcon(false);
    updateINDI();
}

function updateINDI() { // Update from API
    getGroups();        	// populate drivers list with groups
    getDrivers();       	// populate drivers list with drivers
    getProfiles();		// get profiles from API and select active profile

    var url = encodeURI(indiwebUrl + "/api/server/status");

    $.getJSON(url, function(data) {
       if (data === undefined || data === null || data[0].status === undefined || data[0].status === null)
           return;

       if (data[0].status == "True") {
           $("#profiles").prop('disabled', true);
           $("#profile_name").prop('disabled', true);
           $("#drivers_list").prop('disabled', true);
           $("#remote_drivers").prop('disabled', true);
           $("#profile_auto_start").prop('disabled', true);
           $("#profile_auto_connect").prop('disabled', true);
           $("#profile_add").prop('disabled', true);
           $("#profile_remove").prop('disabled', true);
           $("#profile_save").prop('disabled', true);
           $("#profile_cancel").prop('disabled', false);

           $("#profile_start").hide();
           $("#profile_stop").show();

           markActiveDevices(); // mark selected drivers in the equipment image
       } else {
           $("#profiles").prop('disabled', false);
           $("#profile_name").prop('disabled', false);
           $("#drivers_list").prop('disabled', false);
           $("#remote_drivers").prop('disabled', false);
           $("#profile_auto_start").prop('disabled', false);
           $("#profile_auto_connect").prop('disabled', false);
           $("#profile_add").prop('disabled', false);
           $("#profile_remove").prop('disabled', false);
           $("#profile_save").prop('disabled', false);
           $("#profile_cancel").prop('disabled', false);

           $("#profile_start").show();
           $("#profile_stop").hide();

           markAllDevices(false); // reset status of all devices in the equipment image
       }
   });
}

function getGroups() {
    var select_groups = "";
    var url = encodeURI(indiwebUrl + "/api/drivers/groups");

    $.getJSON(url, function(groups) {
        $.each(groups, function(i, group) {
            select_groups += "<optgroup label='" + group + "'></optgroup>";
        });
        $("#drivers_list").html(select_groups);
    });
}

function getDrivers() {
    var driver = "";
    var url = encodeURI(indiwebUrl + "/api/drivers");

    $.getJSON(url, function(drivers) {
        $.each(drivers, function(i, item) {
            driver = "<option value='" + item.label + "' data-tokens='" + item.label + "'>" + item.label + "</option>";
            $("#drivers_list optgroup[label='" + item.family + "']").append(driver);
        });
    });
}

function getProfiles() {
    var active_profile = $("#profiles option:selected").text();
    var url = encodeURI(indiwebUrl + "/api/server/status");

    $.getJSON(url, function(data) { // get status from API
        if (data === undefined || data === null || data[0].status === undefined || data[0].status === null)
            active_profile = "Simulators"; // Set default if none

        if (data[0].status == "True" && data[0].active_profile !== undefined && data[0].active_profile !== null )
            active_profile = data[0].active_profile;

        var options = "";
        var url = encodeURI(indiwebUrl + "/api/profiles");

        $.getJSON(url, function(profiles) { // get available profiles from API & mark active profile
            $.each(profiles, function(i, profile) {
                if (profile.name == active_profile) {
                    options += "<option value='" + profile.name + "' selected>" + profile.name + "</option>";
                } else {
                    options += "<option>" + profile.name + "</option>";
                }
            });
            $("#profiles").html(options);
        });
    });
}

function getProfileDrivers() {
    var name = $("#profiles option:selected").text();
    if (name === undefined || name === null || name == "") return;

    //console.log("Profile selected: " + name);

    clearDriverSelection();

    // Get local drivers
    var url = encodeURI(indiwebUrl + "/api/profiles/" + name + "/labels");

    $.getJSON(url, function(drivers) {
        $.each(drivers, function(i, driver) {
            var selector = "#drivers_list [value='" + driver.label + "']";
            $(selector).prop('selected', true);
        });
        $("#drivers_list").selectpicker('refresh');
    });

    // Get remote drivers
    var url = encodeURI(indiwebUrl + "/api/profiles/" + name + "/remote");

    $.getJSON(url, function(data) {
        if (data === undefined || data === null || data.drivers === undefined || data.drivers === null) {
            $("#remote_drivers").val("");
        } else {
            $("#remote_drivers").val(data.drivers);
        }
    });

    // Load profile options
    var url = encodeURI(indiwebUrl + "/api/profiles/" + name);

    $.getJSON(url, function(settings) {
        if (settings && settings !== undefined) {
            if (settings.autostart == 1)
                $("#profile_auto_start").prop('checked', true);
            else
                $("#profile_auto_start").prop('checked', false);

            if (settings.autoconnect == 1)
                $("#profile_auto_connect").prop('checked', true);
            else
                $("#profile_auto_connect").prop('checked', false);
        }
    });
}

function clearDriverSelection() {
    $("#drivers_list option").prop('selected', false);
    $("#drivers_list").selectpicker('refresh');

    $("#profile_auto_start").prop("checked", false);
    $("#profile_auto_connect").prop("checked", false);
}

function markActiveDevices() {
    var url = encodeURI(indiwebUrl + "/api/server/drivers");

    $.getJSON(url, function(data) {
        if (data === undefined || data === null)
            return;

        var counter = 0;

        // count running drivers & mark device in the equipment image
        $.each(data, function(i, field) {
            markActiveDevice(getDevice(field.family), true);
            counter++;
        });

        // check if all profile drivers are running
        if (counter < $("#drivers_list :selected").length) {
            syslogPrint("Waiting for devices...", "warning", true);
        }
    });
}

function startProfile() {
    var profile = $("#profiles option:selected").text();
    var url = encodeURI(indiwebUrl + "/api/server/start/" + profile);

    $.ajax({
        type: 'POST',
        url: url,
        success: function() {
            syslogPrint("Starting " + profile, "success", true);
            setTimeout(function() { // wait a second to refresh status
                updateINDI();
            }, 200);
        },
        error: function() {
            syslogPrint("Error starting " + profile, "danger", true);
        }
    });
}

function stopProfile() {
    var profile = $("#profiles option:selected").text();
    var url = encodeURI(indiwebUrl + "/api/server/stop");

    $.ajax({
        type: 'POST',
        url: url,
        success: function() {
            syslogPrint("Stopping " + profile, "success", true);
            setTimeout(function() { // wait a second to refresh status
                updateINDI();
            }, 200);
        },
        error: function() {
            syslogPrint("Error stopping " + profile, "danger", true);
        }
    });
}

function getDriverDetails(data) {
    if (data === undefined || data === null) return;

    var device = data.target.id;
    if (device === undefined || device === null) return;

    // convert device type to device family
    var family = getFamily(device);

    // setup driver details
    var url = encodeURI(indiwebUrl + "/api/server/drivers");

    $.getJSON(url, function(drivers) {
        var details = "";
        var count = 0;

        $.each(drivers, function(index, driver) {
            if (driver.family == family) {
                details += "<div class='driver_details'>";
                details += "<span class='name'>" + driver.label + "</span>";
                details += "<span class='details'>" + driver.binary + "</span>";
                details += "<button class='btn btn-primary' data-driver=\"" + driver.label + "\" data-toggle='tooltip'>Restart</button>";
                details += "</div>";
                count++;
            }
        });

        if (count < 1)
            details += "<div class='driver_details'><span class='name'>No device</span><span class='details'>No " + data.target.id + " is running</span></div>";

        $("#driver_details").html(details);
    });

    setTimeout(function() { // we need to wait a moment after creating content to bind an event
        $("#driver_details").on("click", function (evt) {
            hideDriverDetails();
        });
    }, 1000);

    $("#driver_details").show();
}

function hideDriverDetails() {
    $("#driver_details").hide();
}

function getDevice(family) {
    var device = "";

    switch (family) {
        case "Telescopes":
            device = "telescope";
            break;
        case "CCDs":
            device = "ccd";
            break;
        case "Focusers":
            device = "focuser";
            break;
        case "Filter Wheels":
            device = "filter";
            break;
        case "Domes":
            device = "dome";
            break;
        case "Auxiliary":
            device = "aux";
            break;
        case "Weather":
            device = "weather";
            break;
        case "Adaptive Optics":
            device = "ao";
            break;
        case "Spectrographs":
            device = "spectrograph";
            break;
    }

    return device;
}

function getFamily(device) {
    var family = "";

    switch (device) {
        case "telescope":
            family = "Telescopes";
            break;
        case "ccd":
            family = "CCDs";
            break;
        case "guider":
            family = "CCDs";
            break;
        case "focuser":
            family = "Focusers";
            break;
        case "filter":
            family = "Filter Wheels";
            break;
        case "dome":
            family = "Domes";
            break;
        case "gps":
            family = "Auxiliary";
            break;
        case "weather":
            family = "Weather";
            break;
        case "ao":
            family = "Adaptive Optics";
            break;
        case "dustcap":
            family = "Auxiliary";
            break;
        case "lightbox":
            family = "Auxiliary";
            break;
        case "detector":
            family = "Auxiliary";
            break;
        case "rotator":
            family = "";
            break;
        case "spectrograph":
            family = "Spectrographs";
            break;
        case "correlator":
            family = "Auxiliary";
            break;
        case "aux":
            family = "Auxiliary";
            break;
    }

    return family;
}

function addProfile() {
    var profile_name = $("#profile_name").val();
    var options = profiles.options;

    // check if new name is entered
    if (!profile_name) {
        syslogPrint("Profile name missing", "danger", true);
        $("#profile_name").focus();
        return;
    }

    // check if new name is not already used
    $.each( options, function (index, option) {
        var name = options[index].value;
        if (profile_name == name) {
            syslogPrint("Profile name already exists", "danger", true);
            $("#profile_name").focus();
            profile_name = null;
        }
    });

    // finally add new profile
    if (profile_name) {
        syslogPrint("Adding " + profile_name, "success", true);
        $("#profiles").append("<option id='" + profile_name + "' selected>" + profile_name + "</option>");
        clearDriverSelection();
        saveProfile();
    }
}

function deleteProfile() {
    var name = $("#profiles option:selected").text();
    var url = encodeURI(indiwebUrl + "/api/profiles/" + name);

    if ($("#profiles option").size == 1 || name == "Simulators") {
        syslogPrint("Cannot delete default profile", "warning", true);
        return;
    }

    $.ajax({
        type: 'DELETE',
        url: url,
        success: function() {
            $("#profiles option:selected").remove();
            syslogPrint("Deleting " + name, "success", true);
            getProfiles(); // reload profiles from API
        },
        error: function() {
            syslogPrint("Error deleting " + name, "danger", true);
        }
    });
}

function saveProfile() {
    var options = profiles.options;
    var name = options[options.selectedIndex].value;
    // Remove any extra spaces
    name = name.trim();

    var url = encodeURI(indiwebUrl + "/api/profiles/" + name);

    $.ajax({
        type: 'POST',
        url: url,
        success: function() {
            saveProfileDrivers(name);
            syslogPrint("Profile updated", "success");
        },
        error: function() {
            syslogPrint("Error updating profile", "danger", true);
        }
    });
}

function saveProfileOptions() {
    var options = profiles.options;
    var name = options[options.selectedIndex].value;

    var autostart = ($('#profile_auto_start').is(':checked')) ? 1 : 0;
    var autoconnect = ($('#profile_auto_connect').is(':checked')) ? 1 : 0;
    var url = encodeURI(indiwebUrl + "/api/profiles/" + name);

    var profileInfo = {
        "autostart": autostart,
        "autoconnect": autoconnect,
    };

    profileInfo = JSON.stringify(profileInfo);
    //console.log("Profile info " + profileInfo);

    $.ajax({
        type: 'PUT',
        url: url,
        data: profileInfo,
        contentType: "application/json; charset=utf-8",
        success: function() {
            syslogPrint("Profile options updated", "success");
        },
        error: function() {
            syslogPrint("Error updating profile options", "danger", true);
        }
    });
}

function saveProfileDrivers(profile) {

    if (typeof(profile) === 'undefined') return;

    var url = encodeURI(indiwebUrl + "/api/profiles/" + profile + "/drivers");
    var drivers = [];

    $("#drivers_list :selected").each(function(i, sel) {
        drivers.push({
            "label": $(sel).text()
        });
    });

    // Check for remote drivers
    var remote = $("#remote_drivers").val();
    if (remote) {
        drivers.push({
            "remote": remote
        });
        //console.log({"remote": remote});
    }

    drivers = JSON.stringify(drivers);

    $.ajax({
        type: 'POST',
        url: url,
        data: drivers,
        contentType: "application/json; charset=utf-8",
        success: function() {
            syslogPrint("Profile drivers updated", "success");
        },
        error: function() {
            syslogPrint("Error updating profile drivers", "danger", true)
        }
    });
}

function restartDriver(label) {
    var url = encodeURI(indiwebUrl + "/api/drivers/restart/" + label);

    $.ajax({
        type: 'POST',
        url: url,
        success: function() {
            updateINDI();
            syslogPrint("Restarting " + label, "success", true);
        },
        error: function() {
            syslogPrint("Error restarting " + label, "danger", true);
        }
    });
}

/* ================================================== */
/*              Process INDI server data
/* ================================================== */

function updateEquipment(data) {
    // don't process incomplete data
    if (data === undefined || data === null)
        return;

    if ('equipment' in data) {
        data = data['equipment'];
        if (data === undefined || data == null) return;
        //markActiveMultiple(Object.keys(data));
    }

    if ('msg' in data) {
        data = data['msg'];
        if (data === undefined || data == null) return;
        syslogPrint(data, "success");
    }
}

/* ================================================== */
/*              Control equipment image
/* ================================================== */

function markActiveDevice(device, status) {
    if (device === undefined || device == null ) return;

    device = device.toLowerCase();

    if (!device in deviceGroups) {
        syslogPrint(device + " device not supported", "danger");
        return; // equipment image does not support this device
    }

    var color_on = "#009933";
    var color_off = "#578cad";

    if (device == "rotator" || device == "lightbox") {
        var color = status ? "#009933" : "#76b9dd";
    } else {
        var color = status ? "#009933" : "#578cad";
    }

    // Set device status in equipment image
    var equipmentImage = document.getElementById("setup_status").contentDocument;
    if (equipmentImage === undefined || equipmentImage === null) return;

    var item = equipmentImage.getElementById(device);
    if (item === undefined || item === null) return;

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

function markActiveMultiple(devices) { // helper function
    $.each(devices, function (index, device) {
        markActiveDevice(device, true)
    });
}

function markAllDevices(status) { // helper function
    $.each(deviceGroups, function (index, device) {
        markActiveDevice(device, status)
    });
}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function indiwebEvents() {
    $(document).on("click", ".driver_details button" , function() {
        restartDriver($(this)[0].dataset.driver);
    });

    $("#profile_start").on("click", function () {
        startProfile();
    });

    $("#profile_stop").on("click", function () {
        stopProfile();
    });

    $("#profile_add").on("click", function () {
        addProfile();
    });

    $("#profile_remove").on("click", function () {
        deleteProfile();
    });

    $("#profile_save").on("click", function () {
        saveProfile();
    });

    $("#profile_cancel").on("click", function () {
        $("#profile_name").val("");
        toggleProfile();
    });

    $("#profiles").change(function () {
        getProfileDrivers();
    });

    $("#profile_auto_start").change(function () {
        saveProfileOptions();
    });

    $("#profile_auto_connect").change(function () {
        saveProfileOptions();
    });

    $("#drivers_list").change(function () {
        var name = $("#profiles option:selected").text();
        saveProfileDrivers(name);
    });

    $("#remote_drivers").change(function () {
        var name = $("#profiles option:selected").text();
        saveProfileDrivers(name);
    });

    $("#profile_name").on("keydown", function(evt) {
        if(evt.which == 13) addProfile();
    });
}

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
    $("#server_status").show();
    controlProfile();
}

function toggleProfileSettings() {
    $("#toggle-profile").removeClass("button-active");
    $("#toggle-profile-settings").addClass("button-active");
    $("#server_status").hide()
    $("#driver_details").trigger("click"); // hide driver details
    editProfile();
}

function controlProfile() {
    $("#profile_view").show();
    $("#profile_ctrl").show();
    $("#setup_status").show();
    $("#profile_settings").hide();
}

function editProfile() {
    $("#profile_view").show();
    $("#profile_ctrl").hide();
    $("#setup_status").hide();
    $("#profile_settings").show();

    $('#profiles').change(); //getProfileDrivers();
}

export {
    loadINDI,
    updateINDI,
    indiServerConnected,
    indiServerDisconnected,
    indiwebEvents,
    updateEquipment,
    equipmentEvents
};

