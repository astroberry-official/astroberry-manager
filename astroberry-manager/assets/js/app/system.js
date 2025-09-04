/*
 Copyright(c) 2025 Radek Kaczorek  <rkaczorek AT gmail DOT com>

 This library is part of Astroberry OS and Astroberry Manager
 https://github.com/rkaczorek/astroberry-os
 https://github.com/rkaczorek/astroberry-manager

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

import { systemLocationTime } from "./celestial.js";
import { getCookie, setCookie, syslogPrint } from "./helpers.js";
import { socket } from "./sockets.js";

function updateSystemInfo(data) {
    $("#sysmon-resource-ui_version").html(data.release_info.ui_version);
    $("#sysmon-resource-os_version").html(data.release_info.os_version);
    $("#sysmon-resource-indi_version").html(data.release_info.indi_version);
    $("#sysmon-resource-kstars_version").html(data.release_info.kstars_version);
    $("#sysmon-resource-phd2_version").html(data.release_info.phd2_version);

    // $("#sysmon-resource-name").html(data.kernel_info.node_name);
    $("#sysmon-resource-system").html(data.kernel_info.system_name + " " + data.kernel_info.machine);
    $("#sysmon-resource-kernel").html(data.kernel_info.kernel_version);
    $("#sysmon-resource-cpu").html(data.cpu_info.physical_cores + "/" + data.cpu_info.total_cores + " @" + data.cpu_info.processor_speed.toFixed(0) + "MHz");
    $("#sysmon-resource-cpuusage").html(data.cpu_info.total_cpu_usage + "%")
    $("#sysmon-resource-uptime").html(data.system_uptime.uptime);
    $("#sysmon-resource-load").html(data.load_average.load_average_1.toFixed(2) + " / " + data.load_average.load_average_5.toFixed(2) + " / " + data.load_average.load_average_15.toFixed(2));
    $("#sysmon-resource-model").html(data.model_info.version);

    $("#sysmon-resource-memtot").html(data.memory_info.total_memory.toFixed(2));
    $("#sysmon-resource-memavail").html(data.memory_info.available_memory.toFixed(2));
    $("#sysmon-resource-memused").html(data.memory_info.used_memory.toFixed(2) + " (" + data.memory_info.memory_percentage + "%)" );

    $("#sysmon-resource-disktot").html(data.disk_info['/'].total_space.toFixed(2) + " GB");
    $("#sysmon-resource-diskavail").html(data.disk_info['/'].free_space.toFixed(2) + " GB");
    $("#sysmon-resource-diskused").html(data.disk_info['/'].used_space.toFixed(2) + " GB (" + data.disk_info['/'].usage_percentage + "%)");

    // decorations
    if (data.cpu_info.total_cpu_usage > 80) { // CPU Usage
        $("#sysmon-resource-cpuusage").prev().css({background: '#ff3300'});
    } else if (data.cpu_info.total_cpu_usage > 60) {
        $("#sysmon-resource-cpuusage").prev().css({background: '#f08c00'});
    } else {
        $("#sysmon-resource-cpuusage").prev().css({background: '#333'});
    }

    if (data.memory_info.memory_percentage > 80) { // Memory Usage
        $("#sysmon-resource-memused").prev().css({background: '#ff3300'});
    } else if (data.memory_info.memory_percentage > 60) {
        $("#sysmon-resource-memused").prev().css({background: '#f08c00'});
    } else {
        $("#sysmon-resource-memused").prev().css({background: '#333'});
    }

    if (data.disk_info['/'].usage_percentage > 80) { // Disk Usage
        $("#sysmon-resource-diskused").prev().css({background: '#ff3300'});
    } else if (data.disk_info['/'].usage_percentage > 60) {
        $("#sysmon-resource-diskused").prev().css({background: '#f08c00'});
    } else {
        $("#sysmon-resource-diskused").prev().css({background: '#333'});
    }
}

function systemAPIkey() {
    var key = $("#apikey").val();
    setCookie("config", JSON.stringify({"api": key }));
}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function systemEvents() {
    // load config from cookies
    if (getCookie("config")) {
        var config = JSON.parse(getCookie("config"));
        if (config["api"])
            $('#apikey').val(config["api"]);
        if (config["telescope_coords"]) {
            $('#telescope_coordinates_enable').prop("checked", true);
        } else {
            $('#telescope_coordinates_enable').prop("checked", false);
        }
        if (config["chart_coords"]) {
            $('#starchart_coordinates_enable').prop("checked", true);
        } else {
            $('#starchart_coordinates_enable').prop("checked", false);
        }
        if (config["timeloc"]) {
            $('#timeloc_enable').prop("checked", true);
        } else {
            $('#timeloc_enable').prop("checked", false);
        }
        if (config["target_coords"]) {
            $('#target_enable').prop("checked", true);
            $('#target_autohide').attr("disabled", false);
        } else {
            $('#target_enable').prop("checked", false);
            $('#target_autohide').attr("disabled", true);
        }
        if (config["target_autohide"]) {
            $('#target_autohide').prop("checked", true);
        } else {
            $('#target_autohide').prop("checked", false);
        }
        if (config["use_system_loctime"]) {
            $('#system_timeloc').prop("checked", true);
        } else {
            $('#system_timeloc').prop("checked", false);
        }
    } else { // defaults
        $('#telescope_coordinates_enable').prop("checked", true);
        $('#starchart_coordinates_enable').prop("checked", true);
        $('#target_enable').prop("checked", true);
        $('#target_autohide').prop("checked", true);
        $('#timeloc_enable').prop("checked", true);
        $('#system_timeloc').prop("checked", true);
    }

    $("#_system-status").on("click", function () {
        toggleStatus();
    });

    $("#_system-events").on("click", function () {
        toggleEvents();
    });

    $("#_system-settings").on("click", function () {
        toggleSettings();
    });

    $("#system-logout").on("click", function() {
        window.open('/logout', '_self');
    });

    $("#system-update").on("click", function() {
        systemUpdate();
    });

    $("#system-backup").on("click", function() {
        systemBackup();
    });

    $("#system-restore").on("click", function() {
        systemRestore();
    });

    $("#system-restart").on("click", function() {
        systemRestart();
    });

    $("#system-shutdown").on("click", function() {
        systemShutdown();
    });

    $("#apikey").on("keypress", function(data) {
        if (data.which == 13) {
            syslogPrint("API key entered");
            systemAPIkey();
        }
    })

    $("#telescope_coordinates_enable").on("change", function() {
        if ($('#telescope_coordinates_enable').is(':checked')) {
            $("#celestial-map-telescope-coords").show();
            setCookie("config", JSON.stringify({"telescope_coords": true }));
        } else {
            $("#celestial-map-telescope-coords").hide();
            setCookie("config", JSON.stringify({"telescope_coords": false }));
        }    
    });

    $("#starchart_coordinates_enable").on("change", function() {
        if ($('#starchart_coordinates_enable').is(':checked')) {
            $("#celestial-map-coords").show();
            setCookie("config", JSON.stringify({"chart_coords": true }));
        } else {
            $("#celestial-map-coords").hide();
            setCookie("config", JSON.stringify({"chart_coords": false }));
        }    
    });

    $("#timeloc_enable").on("change", function() {
        if ($('#timeloc_enable').is(':checked')) {
            $("#celestial-map-timeloc").show();
            setCookie("config", JSON.stringify({"timeloc": true }));
        } else {
            $("#celestial-map-timeloc").hide();
            setCookie("config", JSON.stringify({"timeloc": false }));
        }    
    });

    $("#target_enable").on("change", function() {
        if ($('#target_enable').is(':checked')) {
            $("#celestial-map-target").show();
            $("#target_autohide").attr('disabled', false);
            setCookie("config", JSON.stringify({"target_coords": true }));
        } else {
            $("#celestial-map-target").hide();
            $("#target_autohide").attr('disabled', true);
            setCookie("config", JSON.stringify({"target_coords": false }));
        }    
    });

    $("#target_autohide").on("change", function() {
        if ($('#target_autohide').is(':checked')) {
            $("#celestial-map-target").show();
            setCookie("config", JSON.stringify({"target_autohide": true }));
        } else {
            setCookie("config", JSON.stringify({"target_autohide": false }));
        }    
    });

    $("#system_timeloc").on("change", function() {
        if ($("#system_timeloc").is(':checked')) {
            systemLocationTime(true);
            setCookie("config", JSON.stringify({"use_system_loctime": true }));
        } else {
            systemLocationTime(false);
            setCookie("config", JSON.stringify({"use_system_loctime": false }));
        }    
    });
}

function toggleStatus() {
    $("#_system-status").addClass("button-active");
    $("#_system-events").removeClass("button-active");
    $("#_system-settings").removeClass("button-active");

    $("#system-status").css({display: "block"});
    $("#system-events").css({display: "none"});
    $("#system-settings").css({display: "none"});
}

function toggleEvents() {
    $("#_system-status").removeClass("button-active");
    $("#_system-events").addClass("button-active");
    $("#_system-settings").removeClass("button-active");

    $("#system-status").css({display: "none"});
    $("#system-events").css({display: "block"});
    $("#system-settings").css({display: "none"});
}

function toggleSettings() {
    $("#_system-status").removeClass("button-active");
    $("#_system-events").removeClass("button-active");
    $("#_system-settings").addClass("button-active");

    $("#system-status").css({display: "none"});
    $("#system-events").css({display: "none"});
    $("#system-settings").css({display: "block"});
}

function systemUpdate() {
    syslogPrint("System update procedure initiated", "warning", true);
    if (!confirm("Press OK to confirm system update")) {
        return;
    }

    var data = {'action': "update"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System update request timed out", "danger");
        } else {
            // syslogPrint("System update requested");
        }
    });
}

function systemBackup() {
    syslogPrint("System backup procedure initiated", "warning", true);
    if (!confirm("Press OK to confirm system backup")) {
        return;
    }

    var data = {'action': "backup"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System backup request timed out", "danger");
        } else {
            // syslogPrint("System backup requested");
        }
    });
}

function systemRestore() {
    syslogPrint("System restore procedure initiated", "warning", true);
    if (!confirm("Press OK to confirm system restore")) {
        return;
    }

    var data = {'action': "restore"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System restore request timed out", "danger");
        } else {
            // syslogPrint("System restore requested");
        }
    });
}

function systemRestart() {
    syslogPrint("System restart procedure initiated", "warning", true);
    if (!confirm("Press OK to confirm system restart")) {
        return;
    }

    var data = {'action': "restart"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System restart request timed out", "danger");
        } else {
            // syslogPrint("System restart requested");
        }
    });
}

function systemShutdown() {
    syslogPrint("System shudown procedure initiated", "warning", true);
    if (!confirm("Press OK to confirm system restore")) {
        return;
    }

    var data = {'action': "shutdown"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System shutdown request timed out", "danger");
        } else {
            // syslogPrint("System shudown requested");
        }
    });
}

function systemUpdateInfo() {
    var data = {'action': "info"};
    socket.timeout(5000).emit("system", data, (err) => {
        if (err) {
            //syslogPrint("System info request timed out", "danger");
        } else {
            // syslogPrint("System info update requested");
        }
    });
}

export {
    updateSystemInfo,
    systemEvents
}
