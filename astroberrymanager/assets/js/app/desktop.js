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

// API docs: https://github.com/novnc/noVNC/blob/master/docs/API.md

import RFB from '../noVNC/core/rfb.js';

const desktopUrl = 'wss://' + location.hostname + '/websockify';

let rfb;
let desktopName;

function requestDesktop() {
    // Creating a new RFB object will start a new connection
    rfb = new RFB(document.getElementById('desktop-container'), desktopUrl);

    // Add listeners to important events from the RFB module
    rfb.addEventListener("connect",  connectedToServer);
    rfb.addEventListener("disconnect", disconnectedFromServer);
    // rfb.addEventListener("serververification", serverVerify);
    rfb.addEventListener("credentialsrequired", credentialsAreRequired);
    //rfb.addEventListener("securityfailure", securityFailed);
    //rfb.addEventListener("clippingviewport", updateViewDrag);
    //rfb.addEventListener("capabilities", updatePowerButton);
    //rfb.addEventListener("clipboard", clipboardReceive);
    //rfb.addEventListener("bell", bell);
    rfb.addEventListener("desktopname", updateDesktopName);

    // Set parameters that can be changed on an active connection
    rfb.viewOnly = false;
    rfb.scaleViewport = true;
    rfb.clipViewport = true;
    rfb.dragViewport = false;
    // rfb.compressionLevel = 0;
    // rfb.qualityLevel = 9;

    //document.getElementById('sendCtrlAltDelButton')
    //    .onclick = sendCtrlAltDel;
}

function closeDesktop() {
    rfb.disconnect();
}

// When this function is called we have
// successfully connected to a server
function connectedToServer(e) {
    console.log("Desktop connected")
}

// This function is called when we are disconnected
function disconnectedFromServer(e) {
    if (e.detail.clean) {
        console.log("Desktop disconnected")
    } else {
        console.log("Lost connection to desktop!")
    }
}

// When this function is called, the server requires
// credentials to authenticate
function credentialsAreRequired(e) {
    const username = "astroberry";
    const password = prompt("Password Required:");
    rfb.sendCredentials({ username: username, password: password });
}

// When this function is called we have received
// a desktop name from the server
function updateDesktopName(e) {
    desktopName = e.detail.name;
}

// Since most operating systems will catch Ctrl+Alt+Del
// before they get a chance to be intercepted by the browser,
// we provide a way to emulate this key sequence.
function sendCtrlAltDel() {
    rfb.sendCtrlAltDel();
    return false;
}

// This function extracts the value of one variable from the
// query string. If the variable isn't defined in the URL
// it returns the default value instead.
function readQueryVariable(name, defaultValue) {
    // A URL with a query parameter can look like this:
    // https://www.example.com?myqueryparam=myvalue
    //
    // Note that we use location.href instead of location.search
    // because Firefox < 53 has a bug w.r.t location.search
    const re = new RegExp('.*[?&]' + name + '=([^&#]*)'),
            match = document.location.href.match(re);

    if (match) {
        // We have to decode the URL since want the cleartext value
        return decodeURIComponent(match[1]);
    }

    return defaultValue;
}

export { requestDesktop, closeDesktop }
