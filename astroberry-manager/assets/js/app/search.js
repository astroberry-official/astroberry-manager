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

import { geoLocation } from "./location.js";
import { deg2dms, deg2hms, JulianDateFromUnixTime, raDecToAltAz } from "./functions.js";
import { dsoType, centerOnCoords } from "./celestial.js";
import { syslogPrint } from "./helpers.js";

const datapath = "assets/js/d3-celestial/data/";
const database = "dsos.14.json";

// names of objects available in local database
var localNames = [];

getLocalNames();

setTimeout(function() { // wait for autocomplete database is loaded
    $( "#search-text" ).autocomplete({
        minLength: 2,
        //source: localNames
        autoFocus: true,
        source: function (request, response) {
            var results = $.ui.autocomplete.filter(localNames, request.term);
            response(results.slice(0, 100).sort());
        }
    });
    //console.log(localNames);
    syslogPrint("Search engine loaded", "success");
}, 1000)

// TODO:
// - add planets, sun and moon

function getLocalNames(names) {
    if (names === undefined) {
        $.getJSON(datapath+database, function(data) {
            //console.log("Search engine starting");
            var names = []; 
            var result = $.each(data.features, function(index, element) {
                names.push(element.id);
                if ( ! names.includes(element.properties.desig))
                     names.push(element.properties.desig);
            });
            localNames = [...names]; // set names database for search autocomplete
        });
    }
}

function searchObject(query) {
    if (query === undefined)
        return;

    query = query.toLowerCase(); // change to lower case

    $.getJSON( datapath+database, function(data) {
        //console.log(data.features);
        var result = $.grep(data.features, function(element, index) {
            return (element.id.toLowerCase() === query || element.properties.desig.toLowerCase() === query);
        });

        if (result[0]) {
            showResults(result[0]);
        } else {
            result = searchSimbad(query);
        }
    });
}

function searchLucky() {
    $.getJSON( datapath+database, function(data) {
        var min = 0;
        var max = data.features.length;
        var i = Math.floor(Math.random() * (max - min + 1)) + min;
        var result = data.features[i];
        if (result)
            showResults(result);
    });
}

function searchSimbad(query) {
    // SIMBAD user guide: https://simbad.u-strasbg.fr/guide/index.htx
    // How to query SIMBAD by URLs: https://simbad.u-strasbg.fr/Pages/guide/sim-url.htx
    // SIMBAD tables: https://simbad.u-strasbg.fr/simbad/tap/tapsearch.html
    // SIMBAD tap service: https://simbad.cds.unistra.fr/simbad/sim-tap/
    // SIMBAD object types: https://vizier.cds.unistra.fr/viz-bin/OType

    // SIMBAD database query
    var url = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=text&query=";
    url += "SELECT main_id, RA, DEC, basic.otype, galdim_majaxis, galdim_minaxis, description"
    url += " FROM basic";
    url += " JOIN ident ON ident.oidref = basic.oid"
    //url += " JOIN flux ON flux.oidref = basic.oid" // many object missing with this enabled
    url += " JOIN otypedef ON otypedef.otype = basic.otype"
    url += " WHERE ident.id = '" + query + "';";

    $.ajax({
        type: 'GET',
        url: url,
        success: function(data)
        {
            //console.log(data);
            
            // object not found
            if (data.split("\n").length < 4) {
                showResults();
                return;
            }

            // process object data
            var result = data.split("\n")[2].split("|");

            // read data
            if (result[0]) var id = result[0].trim().replaceAll('"', ''); // id
            var type = result[6].trim().replaceAll('"', ''); // description
            var desig = null;
            if (result[4].trim() && result[5].trim() ) var dim = parseInt(result[4].trim()) + "x" + parseInt(result[5].trim()); // galdim_majaxis & galdim_minaxis
            if (result[6]) var mag = parseFloat(result[6]); // flux
            if (result[3]) var morph = result[3].trim().replaceAll('"', ''); // otype
            var bv = null;
            if (result[1]) var ra = parseFloat(result[1]); // ra
            if (result[2]) var dec = parseFloat(result[2]); // dec
            var description = null;

            // format data
            var data =  {'id': id, 'geometry': {'coordinates': [ra, dec]}, 
                'properties': {'type': type, 'desig': desig, 'dim': dim, 'mag': mag, 'morph': morph, 'bv': bv}};

            showResults(data, true); // online flag on
        },
        error: function(e)
        {
            console.log("Error querying Simbad database", e.responseText);
        }
    });
}

function showResults(data, online = false) {
    if (data === undefined || data == null) {
        var results = "<h2>Object not found</h2>";
        results += "<span>Use object name or symbol to search for stars, clusters, nebulas and galaxies.<br><br>";
        results += 'For Solar System objects use<span id="open-almanac" class="fa fa-sun-o" data-tooltip="tooltip" title="Open Almanac"></span> Almanac.</span>';

        $("#search-results-text").html(results); // render info
        $("#search-results-image").css({'background': 'url(assets/images/deneb.jpg)', 'background-size': '180px 180px'}); // set default image

        // Disable actions
        $("#search-results-center").prop( "disabled", true );

        return;
    }

    // set output
    var id = data.id;
    //console.log(id.substring(0,3));
    if (id.substring(0,4) == 'NAME')
        id = id.substring(4);
    var coordinates = data.geometry.coordinates;
    var type = data.properties.type;
    var desig = data.properties.desig;
    var dim = data.properties.dim;
    var mag = data.properties.mag;
    var morph = data.properties.morph;
    var bv = data.properties.bv;
    var description = data.properties.description;

    // Format object info
    var results = "<h2>"+id;
    if (online) results += "<span class=\"fa fa-plug\" data-tooltip=\"tooltip\" title=\"Data retrieved from online SIMBAD astronomical database.\"></span>";
    results += "</h2>";
    if (type) results += "<span>Type:        " + dsoType[type] + "</span>";    
    if (desig) results += "<span>Designation: " + desig + "</span>";
    if (dim) results += "<span>Dimentions:  " + dim + " arcmin</span>";
    if (mag) results += "<span>Magnitude:   " + mag + "</span>";
    if (morph) results += "<span>Morphology:  " + morph + "</span>";
    if (bv) results += "<span>BV:          " + bv + "</span>";

    $("#search-results-text").html(results); // render info

    // add center button
    var results = '<button id="search-results-center" class="btn" data-tooltip="tooltip" title="Center object in star chart" disabled>Center</button>';

    // calculate field of view
    var fov = dim ? parseInt(dim.split("x")[0]) * 1.5/60 : 2;
    if (fov < 1)
        fov = 1;
    
    // add details button
    var simbad = 'http://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + id + '&NbIdent=1&Radius=' + fov + '&Radius.unit=deg';
    results += '<a href="' + simbad + '" target="_blank" data-tooltip="tooltip" title="Look up object in SIMBAD Astronomical Database">Details</a>';

    // add images button
    var astrobin = 'https://app.astrobin.com/search';
    results += '<a href="' + astrobin + '" target="_blank" data-tooltip="tooltip" title="Look up images of the object published on Astrobin">Images</a>';

    $("#search-results-actions").html(results); // render buttons

    // Get equatorial coordinates
    var ra = coordinates[0];
    var dec = coordinates[1];

    var results = "<span>RA: " + deg2hms(ra) + "</span>";
    results += "<span> | DEC: " + deg2dms(dec) + "</span><br>";

    // get current LAT & LON
    if (geoLocation && geoLocation.latitude && geoLocation.longitude) {
        var lat = geoLocation.latitude;
        var lon = geoLocation.longitude;

        // compute UT julian date
        const now = new Date();
        const jd = JulianDateFromUnixTime(now.getTime());

        // convert coordinates to radians
        var _ra = ra * Math.PI / 180;
        var _dec = dec * Math.PI / 180;
        lat *= Math.PI / 180;
        lon *= Math.PI / 180;

        // calculate azalt
        var azalt = raDecToAltAz(_ra, _dec, lat, lon, jd); // returns [az, alt, LST, H];
        var az = azalt[0] * 180 / Math.PI;
        var alt = azalt[1] * 180 / Math.PI;

        results += "<span>AZ: " + deg2dms(az) + "</span>";
        results += "<span> | ALT: " + deg2dms(alt) + "</span>";        
    }

    // show object coordinates
    $("#search-results-coordinates").html(results); // render coords

    // show object description
    var results = null; // TODO
    $("#search-results-description").html(results); // render coords

    // show image
    var _ra = ra;
    if (_ra < 0) // convert RA from -180...+180 to 0...360 deg
        _ra += 360;

    var image = 'https://www.sky-map.org/imgcut?survey=DSS2&w=128&h=128&ra=' + ra/15 + '&de=' + dec + '&angle=' + fov + '&output=PNG';
    var aladin = 'https://aladin.cds.unistra.fr/AladinLite/?target='+_ra+'+'+dec+'&fov='+fov+'&survey=CDS%2FP%2FDSS2%2Fcolor';
    var results = '<a href="' + aladin + '" target="_blank" data-tooltip="tooltip" title="Look up object in Aladin Sky Atlas">';
    results += '<img src='+image+' width="178" />';
    results += '</a>';
    
    $("#search-results-image").html(results); // render image

    // TODO Get image thumnail from SIMBAD: http://alasky.u-strasbg.fr/cgi/simbad-thumbnails/get-thumbnail.py?oid=434630&size=200&legend=true
    // Problem: we don't have oid in local database

    // Enable actions
    $("#search-results-center").prop( "disabled", false );

    // convert RA from -180...+180 to 0...360 deg
    // required by the following functions
    if (ra < 0)
        ra += 360;

    $("#search-results-center").on("click", function() {
        centerOnCoords(ra, dec);
        syslogPrint("Centering on RA: " + deg2hms(ra) + " DEC: " + deg2dms(dec), "success");
    });
}

// function getDsoType(t) {
//     if (t===undefined)
//         return;

//     if (t.length > 3)
//         return t;

//     var type = null;

//     // based on celestial.config.js
//     switch(t) {
//         case 'gg':
//             type = "Galaxy cluster";
//             break;
//         case 'g':
//             type = "Generic galaxy";
//             break;
//         case 's':
//             type = "Spiral galaxy";
//             break;
//         case 's0':
//             type = "Lenticular galaxy";
//             break;
//         case 'sd':
//             type = "Dwarf galaxy";
//             break;
//         case 'e':
//             type = "Elliptical galaxy";
//             break;
//         case 'i':
//             type = "Irregular galaxy";
//             break;
//         case 'oc':
//             type = "Open cluster";
//             break;        
//         case 'gc':
//             type = "Globular cluster";
//             break;
//         case 'en':
//             type = "Emission nebula";
//             break;
//         case 'bn':
//             type = "Generic bright nebula";
//             break;
//         case 'sfr':
//             type = "Star forming region";
//             break;
//         case 'rn':
//             type = "Reflection nebula";
//             break;
//         case 'pn':
//             type = "Planetary nebula";
//             break;
//         case 'snr':
//             type = "Supernova remnant";
//             break;
//         case 'dn':
//             type = "Dark nebula grey";
//             break;
//         case 'pos':
//             type = "Generic";
//             break;
//         default:
//             type = "Generic";
//     }
//     return type;
// }

function searchEvents() {
    $("#toggle-search").on("click", function() {
        var query = $("#search-text").val();
        searchObject(query);
    });

    $("#search-text").on("keypress", function(data) {
        if (data.which == 13)
            $("#toggle-search").trigger("click");
    })

    $("#toggle-lucky").on("click", function() {
        searchLucky();
    })

    // $("#search-results-image").on("mousemove", function(data) {
    //     var x = 0.5 * 256 * data.offsetX / 180 - (256 - 180);
    //     var y = 0.5 * 256 * data.offsetY / 180 - (256 - 180);

    //     if (x > 0)
    //         x = 0;

    //     if (y > 0)
    //         y = 0;

    //     //console.log(x, y);
    //     $("#search-results-image").css({'background-size': '256px 256px', 'background-position': x+'px '+y+'px' });
    // });

    // $("#search-results-image").on("mouseout", function() {
    //     $("#search-results-image").css({'background-size': '180px 180px', 'background-position': '0 0' });
    // });
}

export { searchEvents }
