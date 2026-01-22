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

import { telescopeStatusIcon, starchartStatusIcon, locationStatusIcon } from './celestial.js';
import { activeEquipment, markActiveDriver, markAllDrivers } from './equipment.js';
import { getCookie, setCookie, syslogPrint } from './helpers.js';
import { socket } from './sockets.js';

const indiwebUrl = location.protocol + '//' + location.hostname + ':8624';

const deviceFamilies = ["Adaptive Optics", "Agent", "Auxiliary", "CCDs", "Domes", "Filter Wheels", "FilterWheels", "Focusers", "Spectrographs", "Telescopes", "Weather"];

function getINDIServerAPI() {	// helper function for module init
    // Update profiles
    getIndiStatus();		// this must go first as it runs getActiveProfile
    getProfiles();		// this must follow as it gets all profiles and selects active profile

    // Update profile drivers
    getGroups();		// Get driver types/groups
    getAllDrivers();		// Get all supported drivers and assign them to groups
    getProfileDrivers();	// Select drivers for active profile
    getDriverDetails();		// Load details of active drivers

    //syslogPrint("Profile " + activeEquipment.profile + " loaded", "success");
}

function connectINDIServer() {
    var data = {};
    data['connect'] = true;

    socket.timeout(5000).emit("equipment", data, (err) => {
        if (err) {
            syslogPrint("INDI server request timed out", "danger");
        } else {
            //syslogPrint("Equipment data requested");
        }
    });
}

function disconnectINDIServer() {
    var data = {};
    data['disconnect'] = true;

    socket.timeout(5000).emit("equipment", data, (err) => {
        if (err) {
            syslogPrint("INDI server request timed out", "danger");
        } else {
            //syslogPrint("Equipment data requested");
            telescopeStatusIcon(false);
            starchartStatusIcon();
            locationStatusIcon();
        }
    });
}

function getIndiStatus() { // Update status using API provided by indi-web
     $.getJSON(indiwebUrl + "/api/server/status", function(data) {
        if (data[0].status === undefined)
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

            $("#profile_start").css({display: "none"});
            $("#profile_stop").css({display: "block"});

            getActiveProfile(data[0].active_profile); //  get active profile from INDI server
            getActiveDrivers();
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

            $("#profile_start").css({display: "block"});
            $("#profile_stop").css({display: "none"});

            getActiveProfile(); // get active profile from cookie or fallback to Simulators
        }
    });
}

function getProfiles() {
    var options = "";
    var url = indiwebUrl + "/api/profiles";

    $.getJSON(url, function(profiles) {
        $.each(profiles, function(i, profile) {
            if (profile.name == activeEquipment.profile) {
                options += "<option value='" + profile.name + "' selected>" + profile.name + "</option>";
            } else {
                options += "<option>" + profile.name + "</option>";
            }
        });
        $("#profiles").html(options);
    });

    $('#profiles').change(); // getProfileDrivers()
}

function getActiveProfile(profile) {
    activeEquipment.profile = profile ? profile : null; // first, get active profile from INDI server

    if (activeEquipment.profile === null) { // second, get saved profile if no INDI server is running
        if (getCookie("config")) {
            var config = JSON.parse(getCookie("config"));
            activeEquipment.profile = config.profile;
        } else {
            activeEquipment.profile = "Simulators"; // finaly, use default profile if no saved profile
        }
    }
}

function setActiveProfile(profile) {
    activeEquipment.profile = profile;
    setCookie("config", JSON.stringify(activeEquipment));
}

function getGroups() {
    var groups = "";
    var url = indiwebUrl + "/api/drivers/groups";

    $.getJSON(url, function(groups) {
        $.each(groups, function(i, group) {
            groups += "<optgroup label='" + group + "'></optgroup>";
        });
        $("#drivers_list").html(groups);
    });
}

function getAllDrivers() {
    var driver = "";
    var url = indiwebUrl + "/api/drivers";

    $.getJSON(url, function(drivers) {
        $.each(drivers, function(i, item) {
            driver = "<option value='" + item.label + "' data-tokens='" + item.label + "'>" + item.label + "</option>";
            $("#drivers_list optgroup[label='" + item.family + "']").append(driver);
        });
    });
}

function getActiveDrivers() {
    $.getJSON(indiwebUrl + "/api/server/drivers", function(data) {
        var counter = 0;

        // count running drivers
        $.each(data, function(i, field) {
            markActiveDriver(getDevice(field.family), true);
            counter++;
        });

        // check if all profile drivers are running
        if (counter < $("#drivers_list :selected").length) {
            syslogPrint("Waiting for devices", "warning", true);
            return;
        }
    });
}

function clearDriverSelection() {
    $("#drivers_list option").prop('selected', false); // Uncheck drivers
    $("#drivers_list").selectpicker('refresh');

    $("#profile_auto_start").prop("checked", false); // Uncheck Auto Start
    $("#profile_auto_connect").prop("checked", false); // Uncheck Auto Start
}

function getProfileDrivers() {
    clearDriverSelection();

    var name = $("#profiles option:selected").text();

    if (! name) return;

    //syslogPrint("Profile " + name + " selected", "success", true);

    // Get local drivers
    var url = indiwebUrl + "/api/profiles/" + name + "/labels";

    $.getJSON(url, function(drivers) {
        $.each(drivers, function(i, driver) {
            var selector = "#drivers_list [value='" + driver.label + "']";
            $(selector).prop('selected', true);
        });
        $("#drivers_list").selectpicker('refresh');
    });

    // Get remote drivers
    url = encodeURI(indiwebUrl + "/api/profiles/" + name + "/remote");

    $.getJSON(url, function(data) {
        if (data && data.drivers !== undefined) {
            $("#remote_drivers").val(data.drivers);
        }
        else {
            $("#remote_drivers").val("");
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

function startProfile() {
    var profile = $("#profiles option:selected").text();
    var url = indiwebUrl + "/api/server/start/" + profile;

    $.ajax({
        type: 'POST',
        url: encodeURI(url),
        success: function() {
            setActiveProfile(profile);
            getIndiStatus();
            connectINDIServer();
            syslogPrint("Profile " + activeEquipment.profile + " started", "success", true);
        },
        error: function() {
            syslogPrint("Error starting " + profile + " profile", "danger", true);
        }
    });
}

function stopProfile() {
    $.ajax({
        type: 'POST',
        url: indiwebUrl + "/api/server/stop",
        success: function() {
            markAllDrivers(false);
            disconnectINDIServer();

            // wait a second to refresh status
            setTimeout(function() {
                getIndiStatus();
            }, 1000);

            syslogPrint("Profile " + activeEquipment.profile + " stopped", "success", true);
        },
        error: function() {
            syslogPrint("Error stopping " + profile + " profile", "danger", true);
        }
    });
}

function getDriverDetails(data) {
    if (data === undefined) return;

    var device = data.target.id;
    if (!device) return;

    // convert device type to device family
    var family = getFamily(device);

    // setup driver details
    $.getJSON(indiwebUrl + "/api/server/drivers", function(drivers) {
        var details = "";
        var count = 0;

        $.each(drivers, function(index, driver) {
            if (driver.family == family) {
                details += "<div class='driver_details'>";
                details += "<span class='name'>" + driver.label + "</span>";
                details += "<span class='details'>" + driver.binary + "</span>";
                details += "<button class='btn' data-driver=\"" + driver.label + "\" data-toggle='tooltip'>Restart</button>";
                details += "</div>";
                count++;
            }
        });

        if (count < 1)
            details += "<div class='driver_details'><span class='name'>No device</span><span class='details'>" + data.target.id + " driver is not running</span></div>";

        $("#driver_details").html(details);
    });

    setTimeout(function() { // we need to wait a moment after creating content to bind an event
        // set driver details events
        $("#driver_details").on("click", function (evt) {
            hideDriverDetails();
        });
    }, 1000);

    $("#driver_details").fadeIn();
}

function hideDriverDetails() {
    $("#driver_details").css({display: "none"});
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
        syslogPrint("Cannot add profile. Profile name missing", "danger", true);
        $("#profile_name").focus();
        return;
    }

    // check if new name is not already used
    $.each( options, function (index, option) {
        var name = options[index].value;
        if (profile_name == name) {
            syslogPrint("Cannot add profile. Profile name already exists", "danger", true);
            $("#profile_name").focus();
            profile_name = null;
        }
    });

    // finally add new profile
    if (profile_name) {
        syslogPrint("Profile " + profile_name + " added", "success", true);
        $("#profiles").append("<option id='" + profile_name + "' selected>" + profile_name + "</option>");
        clearDriverSelection();
        saveProfile();
    }
}

function deleteProfile() {
    var name = $("#profiles option:selected").text();
    var url = indiwebUrl + "/api/profiles/" + name;

    if ($("#profiles option").size == 1 || name == "Simulators") {
        syslogPrint("Cannot delete default profile", "warning", true);
        return;
    }

    $.ajax({
        type: 'DELETE',
        url: encodeURI(url),
        success: function() {
            $("#profiles option:selected").remove();
            getProfiles();
            $('#profiles').change(); // getProfileDrivers()
            syslogPrint("Profile " + name + " deleted", "success", true);
        },
        error: function() {
            syslogPrint("Error deleting profile " + name, "danger", true);
        }
    });
}

function saveProfile() {
    var options = profiles.options;
    var name = options[options.selectedIndex].value;
    // Remove any extra spaces
    name = name.trim();

    var url = indiwebUrl + "/api/profiles/" + name;

    $.ajax({
        type: 'POST',
        url: encodeURI(url),
        success: function() {
            saveProfileDrivers(name);
            //syslogPrint("Profile updated", "success", true);
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
    var url = indiwebUrl + "/api/profiles/" + name;

    var profileInfo = {
        "autostart": autostart,
        "autoconnect": autoconnect,
    };

    profileInfo = JSON.stringify(profileInfo);
    //console.log("Profile info " + profileInfo);

    $.ajax({
        type: 'PUT',
        url: encodeURI(url),
        data: profileInfo,
        contentType: "application/json; charset=utf-8",
        success: function() {
            //syslogPrint("Profile options updated", "success", true);

        },
        error: function() {
            syslogPrint("Error updating profile options", "danger", true);
        }
    });
}

function saveProfileDrivers(profile) {

    if (typeof(profile) === 'undefined') return;

    var url = indiwebUrl + "/api/profiles/" + profile + "/drivers";
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
        url: encodeURI(url),
        data: drivers,
        contentType: "application/json; charset=utf-8",
        success: function() {
            //syslogPrint("Profile drivers updated", "success", true);
        },
        error: function() {
            syslogPrint("Error updating profile drivers", "danger", true)
        }
    });
}

function restartDriver(label) {
        $.ajax({
            type: 'POST',
            url: indiwebUrl + "/api/drivers/restart/" + label,
            success: function() {
                getIndiStatus();
                syslogPrint("Driver " + label + " restarted", "success", true);
            },
            error: function() {
                syslogPrint("Error restarting driver " + label, "danger", true);
            }
        });
}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function indiwebEvents() {
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

    $(document).on("click", ".driver_details button" , function() {
        restartDriver($(this)[0].dataset.driver);
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

export {
    getIndiStatus,
    getINDIServerAPI,
    getProfileDrivers,
    startProfile,
    stopProfile,
    addProfile,
    deleteProfile,
    saveProfile,
    saveProfileOptions,
    saveProfileDrivers,
    getDriverDetails,
    restartDriver,
    indiwebEvents,
    activeEquipment /* Active profile and drivers */
};
