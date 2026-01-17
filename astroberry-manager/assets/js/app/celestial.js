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

// Celestial Docs: https://armchairastronautics.blogspot.com/search/label/D3-Celestial

import { geoLocation } from './location.js';
import { syslogPrint } from './helpers.js';
import { JulianDateFromUnixTime, raDecToAltAz,  deg2dms, deg2hms } from './functions.js';
import { celestialConfig } from './celestial.config.js';
import { socket } from './sockets.js';

var planets = {"sol": "Sun", "mer": "Mercury", "ven": "Venus", "lun": "Moon", "mar": "Mars", "jup": "Jupiter",
  "sat": "Saturn", "ura": "Uranus", "nep": "Neptune", "cer": "Ceres", "plu": "Pluto"};

var dsoType = {g: "Galaxy", s: "Spiral Galaxy", s0: "Lenticular Galaxy", sd: "Dwarf Galaxy", e: "Elliptical Galaxy",
  i: "Irregular Galaxy", oc: "Open Cluster", gc: "Globular Cluster", en: "Emission Nebula", bn: "Bright Nebula",
  sfr: "HII Region", rn: "Reflection Nebula", pn: "Planetary Nebula", snr: "Supernova Remnant",
  dn: "Dark Nebula", pos:"N/A"};

var telescopeCoords = { 'RA': 0, 'DEC': 0, 'chartlock': false };

var reticleRadius = 40;

var reticleChart = d3.select("body").append("img")
  .attr("id", "reticle-chart")
  .attr("width", reticleRadius)
  .attr("height", reticleRadius)
  .attr("src", "assets/images/reticle_chart.svg")
  .style({opacity: 0.8, "z-index": 50});

var reticleTelescope = d3.select("body").append("img")
  .attr("id", "reticle-telescope")
  .attr("width", reticleRadius)
  .attr("height", reticleRadius)
  .attr("src", "assets/images/reticle_telescope.svg")
  .style({opacity: 0.8, "z-index": 50});

var targetTimeout = 0; // hides target widget after 3s of inactivity

function requestStarChart() {
  Celestial.display(celestialConfig);
  Celestial.addCallback(updateStarChartCoords);
  systemLocationTime(true);
  loadStarChartLock();
}

function getPointCoordinates(data) {
  var x = data.offsetX;
  var y = data.offsetY;
  var coordinates = Celestial.mapProjection.invert([x, y]);
  return coordinates; // [right ascension -180...180 degrees, declination -90...90 degrees]
}

function loadStarChartLock() {
  // Load status of Lock button
  if (telescopeCoords.chartlock)
    $("#starchart_lock").addClass("button-active");
  else
    $("#starchart_lock").removeClass("button-active");
}

function updateStarChartLocation() { // update star chart geo location based on location service
  var lastGeoloc = Celestial.location();

  if (geoLocation.latitude != lastGeoloc[0] || geoLocation.longitude != lastGeoloc[1]) {
    Celestial.location([geoLocation.latitude, geoLocation.longitude]);
  }
}

function updateTelescopeCoords(data) {
  data = data['equipment']; // strip header
  if (data === undefined || data.TELESCOPE === undefined)
    return;

  var telescopeNames = Object.keys(data.TELESCOPE); // get all active telescopes
  const telescopeId = 0; // use the first telescope ONLY

  if (data.TELESCOPE[telescopeNames[telescopeId]]['EQUATORIAL_EOD_COORD']) {
    // Get last coordinates
    var lastRA = telescopeCoords.RA ? telescopeCoords.RA : 0;
    var lastDEC = telescopeCoords.DEC ? telescopeCoords.DEC : 0;

    // get equatorial coordinates from telescope
    var _telescopeCoords = data.TELESCOPE[telescopeNames[telescopeId]]['EQUATORIAL_EOD_COORD'];
    telescopeCoords.RA = _telescopeCoords.RA[0];
    telescopeCoords.DEC = _telescopeCoords.DEC[0];

    // Update position of telescope reticle
    getTelescopeReticle();

    // get equatorial coordinates from star chart
    var starchartCoords = Celestial.rotate()

    // convert RA from -180...+180 to 0...360 deg
    if (starchartCoords[0] < 0)
      starchartCoords[0] += 360;

    //console.log({'RA': telescopeCoords.RA * 15, 'DEC': telescopeCoords.DEC}, {'RA': starchartCoords[0], 'DEC': starchartCoords[1]});

    // If star chart coords equal telescope coords ~30 arsec, set icon status
    var coordsPrecision = 30/3600;
    if (Math.abs(telescopeCoords.RA * 15 - starchartCoords[0]) < coordsPrecision && Math.abs(telescopeCoords.DEC - starchartCoords[1]) < coordsPrecision) {
      starchartStatusIcon(true);
    } else {
      starchartStatusIcon(false);
    }

    // If chart locked on telescope and coordinates of telescope and chart are different, center chart
    var updateThreshold = 15 * 60 / 3600;
    if (telescopeCoords.chartlock && (!telescopeCoords || Math.abs(telescopeCoords.RA * 15 - starchartCoords[0]) > updateThreshold  || Math.abs(telescopeCoords.DEC - starchartCoords[1]) > updateThreshold)) {
      centerOnTelescope();
    }
  }

  // if (data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD']) {
  //   // get location from telescope
  //   var scopeLocation = {
  //     LAT: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LAT[0],
  //     LONG: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG[0] > 180 ? 180 - data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG : data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG,
  //     ELEV: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].ELEV[0]
  //   };

  //   // Display warning if telescope location does not match system location
  //   if (scopeLocation['LAT'].toFixed(2) == parseFloat(geoLocation.latitude).toFixed(2) && scopeLocation['LONG'].toFixed(2) == parseFloat(geoLocation.longitude).toFixed(2)) {
  //     locationStatusIcon(true);
  //   } else {
  //     locationStatusIcon(false);
  //     syslogPrint("Telescope location is different than system location", "danger", true);
  //     console.log(scopeLocation['LAT'], scopeLocation['LONG']);
  //   }
  // }
}

function setTelescopeLocation(data) {
  if (data === undefined || data[0] === undefined || data[1] === undefined)
      return;

  var lat = data[0];
  var lon = data[1];
  var alt = data[2] ? data[2] : 0;

  if (typeof lat !== 'number' || !isFinite(lat)) return;
  if (typeof lon !== 'number' || !isFinite(lon)) return;
  if (typeof alt !== 'number' || !isFinite(alt)) return;

  if (lat < -90 || lon > 90) return;
  if (lon < 0 || lon > 360) return;

  var _data = {};
  _data['action'] = "setlocation";
  _data['params'] = {};
  _data['params']['lat'] = lat;
  _data['params']['lon'] = lon;
  _data['params']['alt'] = alt;
  socket.timeout(5000).emit("telescope", _data, (err) => {
      if (err) {
          syslogPrint("Telescope request timed out", "danger");
      } else {
          //syslogPrint("Telescope location requested");
      }
  });
}

function getAzAlt(ra, dec) {
  var lat = geoLocation.latitude;
  var lon = geoLocation.longitude;

  // compute UT julian date
  const now = new Date();
  const jd = JulianDateFromUnixTime(now.getTime());

  // convert to radians
  ra *= 15 * Math.PI / 180;
  dec *= Math.PI / 180;
  lat *= Math.PI / 180;
  lon *= Math.PI / 180;

  // calculate azalt
  var azalt = raDecToAltAz(ra, dec, lat, lon, jd); // returns [az, alt, LST, H];

  return azalt;
}

function updateTargetCoords(data) {
  if (data === undefined || data === null)
    return;

  var ra = data[0];
  var dec = data[1];

  // Show current RA & DEC
  $("#target_ra").text(deg2hms(ra));
  $("#target_dec").text(deg2dms(dec));

  // get current LAT & LON
  if (!geoLocation || !geoLocation.latitude || !geoLocation.longitude)
    return;

  // convert RA from -180...+180 to 0...360 deg
  if (ra < 0)
    ra += 360;

  var azalt = getAzAlt(ra/15, dec);

  // display current alt, az
  var az = deg2dms(azalt[0] * 180 / Math.PI);
  var alt = deg2dms(azalt[1] * 180 / Math.PI);

  // Show current Azimuth & Altitude
  $("#target_az").text(az);
  $("#target_alt").text(alt);
}

function updateStarChartCoords() {
  var coordinates = Celestial.rotate();
  var timeloc = Celestial.skyview();

  var ra = coordinates[0];
  var dec = coordinates[1];

  // Show current RA & DEC
  $("#starchart_ra").text(deg2hms(ra));
  $("#starchart_dec").text(deg2dms(dec));

  // get current LAT & LON
  if (!geoLocation || !geoLocation.latitude || !geoLocation.longitude)
    return;

  // convert RA from -180...+180 to 0...360 deg
  if (ra < 0)
    ra += 360;

  var azalt = getAzAlt(ra/15, dec);

  // display current alt, az
  var az = deg2dms(azalt[0] * 180 / Math.PI);
  var alt = deg2dms(azalt[1] * 180 / Math.PI);

  // Show current Azimuth & Altitude
  $("#starchart_az").text(az);
  $("#starchart_alt").text(alt);

  // show current time and location
  var dt = new Date(timeloc.date).toString().split(" (")[0];
  $("#celestial-map-datetime").html(dt);
  $("#celestial-map-latitude").html(deg2dms(timeloc.location[0]));
  $("#celestial-map-longitude").html(deg2dms(timeloc.location[1]));
  //$("#celestial-map-timezone").html(timeloc.timezone);

  // show center of the star chart
  getChartReticle(); // update reticle
}

function updateTelecopeCoords() {
  // get current RA & DEC
  if (!telescopeCoords)
    return;

  var ra = telescopeCoords.RA;
  var dec = telescopeCoords.DEC;

  // display current ra in HMS
  $("#starchart_telescope_ra").text(deg2hms(ra * 15));

  // display current dec
  $("#starchart_telescope_dec").text(deg2dms(dec));

  // get current LAT & LON
  if (!geoLocation || !geoLocation.latitude || !geoLocation.longitude)
    return;

  var azalt = getAzAlt(ra, dec);

  // display current alt, az
  var az = deg2dms(azalt[0] * 180 / Math.PI);
  var alt = deg2dms(azalt[1] * 180 / Math.PI);

  $("#starchart_telescope_az").text(az);
  //$("#starchart_telescope_az").prop('title', 'DEG');

  $("#starchart_telescope_alt").text(alt);
  //$("#starchart_telescope_alt").prop('title', 'DEG');
}

function centerOnTelescope() { // Center on celestial coordinates
  if (!telescopeCoords)
    return;

  var ra = telescopeCoords.RA * 15; // converting ra from hours to degrees
  var dec = telescopeCoords.DEC;

  centerOnCoords(ra, dec);
}

function centerOnCoords(ra, dec, rot=0) { // degrees
  if (ra === undefined || dec == undefined)
    return;

  if (typeof ra !== 'number' || !isFinite(ra)) return;
  if (typeof dec !== 'number' || !isFinite(dec)) return;

  if (ra < 0 || ra > 360) return;
  if (dec < -90 || dec > 90) return;

  var config = { center: [ra, dec, rot] };
  Celestial.rotate(config); // go to
}

function centerOnSolarObject(id) {
  var dt = new Date();
  var p = Celestial.getPlanet(id, dt);
  centerOnCoords(p.ephemeris.pos[0], p.ephemeris.pos[1]);
}

function animsStarChart(id, params) {
  //console.log(id, params);
  var anims = [];
  switch (id) {
    case 'zoom-in':
      anims.push({ param: "zoom", value: 2, duration: 0 });
      break;
    case 'zoom-out':
      //anims.push({param:"center", value:[ra*15, dec], duration:0});
      anims.push({ param: "zoom", value: 1, duration: 0 });
      break;
    case 'center':
      anims.push({ param: "center", value: [params[0], params[1]], duration: 0 });
      break;
    default:
      anims.push({ param: "zoom", value: 2, duration: 0 });
      anims.push({ param: "zoom", value: 1, duration: 200 });
  }

  // run animation
  if (anims)
    Celestial.animate(anims, false);
}

function px(n) { return n + "px"; }

function getChartReticle(enabled = true) {
  if (!enabled)
    return;

  var coordinates = Celestial.rotate()
  var pt = Celestial.mapProjection(coordinates);
  reticleChart.style({left: px(pt[0]-reticleRadius/2+2), top:px(pt[1]-reticleRadius/2+2), opacity:0.8});
}

function getTelescopeReticle() {
  if (!telescopeCoords) {
    $("#reticle-telescope").hide();
    return;
  }

  $("#reticle-telescope").hide();

  var ra = telescopeCoords.RA * 15; // converting ra from hours to degrees
  var dec = telescopeCoords.DEC;

  var coordinates = [ra, dec];
  var pt = Celestial.mapProjection(coordinates);
  reticleTelescope.style({left: px(pt[0]-reticleRadius/2+2), top:px(pt[1]-reticleRadius/2+2), opacity:0.8});
}

function getRegionOfInterest(coordinates, fov = 5) {
  if (coordinates === undefined || coordinates == null)
    return;

  var ra = coordinates[0];
  var dec = coordinates[1];

  // convert RA from -180...+180 to 0...360 deg
  if (ra < 0)
    ra += 360;

  var width = 256;
  $("#region-of-interest").remove(); // clear
  var box = d3.select("body").append("div").attr("id", "region-of-interest").style("z-index", 100);//.style("width", px(width+2));
  var pt = Celestial.mapProjection(coordinates);
  // var properties = {'name': 'NGC 224', 'desig': 'M31', 'alt': 'Andromeda Galaxy', 'cl': 'Spiral Galaxy', 'mag': 5, 'dim': 10};
  var properties = {}; // TODO: show data for a major object in the region

  var imageUrl = 'http://www.sky-map.org/imgcut?survey=DSS2&w=128&h=128&ra=' + coordinates[0]/15 + '&de=' + dec + '&angle=' + fov + '&output=PNG';
  var detailsUrl = 'http://simbad.u-strasbg.fr/simbad/sim-coo?Coord=' + ra + '+' + dec + '&Radius=' + fov + '&Radius.unit=deg&output.max=10'

  box.style({left:px(ra + pt[0] - width/2), top:px(dec + pt[1]), opacity:1, border: "solid 1px #e1e1e11f"});

  box.selectAll("*").remove();

  box.append("h2").text("Region of Interest");
  if (properties.name || properties.desig || properties.alt || properties.cl || dsoType[properties.type]) {
    box.append("span").classed("data", true).text("Names: ");
    if (properties.name) box.append("span").classed("title", true).text(properties.name+", ")
    if (properties.desig) box.append("span").text(properties.desig  + ", ");
    if (properties.alt) box.append("span").text(properties.alt).append("br"); 
    if (dsoType[properties.type]) box.append("span").text(dsoType[properties.type]).append("br");
    if (properties.cl) {
      box.append("span").classed("data", true).text("Class: ");
      box.append("span").text(properties.cl).append("br");
    }
  }
  if (properties.mag || properties.dim) {
    box.append("span").classed("data", true).text("Properties: ");
    if (properties.mag) {
      box.append("span").classed("data", true).text("m").append("sub").text("v");
      box.append("span").text("\u2009" + properties.mag);
    }
    if (properties.dim) {
      box.append("span").classed("data", true).text("\u00a0\u00a0\u00a0\u2205\u00a0");
      box.append("span").text(properties.dim + "'");
    }
  }
  if (imageUrl) box.append("div").attr("id", "region-of-interest-image").style({background: "url("+imageUrl+")", "margin-top": "10px" });

  box.append("button").attr("id", "region-of-interest-center").attr("class", "btn").attr("data-tooltip", "tooltip").attr("title", "Center object in star chart").text("Center");

  if (detailsUrl) box.append("a").attr({href: detailsUrl, target: "_blank", "data-tooltip": "tooltip", title: "Look up the region in SIMBAD online database"}).text("Details");
  if (fov) box.append("span").text("FOV: " + fov + "°").style({position: "absolute", bottom: "280px", right: "20px", color: "#aaa"});

  box.append("span").classed("label", true).text("RA");
  box.append("span").classed("starchart-coords", true).text(deg2hms(ra));
  box.append("span").classed("label", true).text("DEC");
  box.append("span").classed("starchart-coords", true).text(deg2dms(dec));
  box.append("br");

  // get azimuth and altitude
  var azalt = getAzAlt(ra/15, dec);
  var az = deg2dms(azalt[0] * 180 / Math.PI);
  var alt = deg2dms(azalt[1] * 180 / Math.PI);

  box.append("span").classed("label", true).text("AZ");
  box.append("span").classed("starchart-coords", true).text(az);
  box.append("span").classed("label", true).text("ALT");
  box.append("span").classed("starchart-coords", true).text(alt);

  // register events
  d3.select("#region-of-interest-image").on("click", function() {
    $("#region-of-interest").remove(); // hide ROI
  });

  d3.select("#region-of-interest-center").on("click", function() {
    centerOnCoords(ra, dec);
  });

}

function telescopeStatusIcon(status) {
  if (status) {
    $("#celestial-map-telescope-icon").css({"background-image": "url(assets/images/telescope-active.png)"});
    $("#celestial-map-telescope-coords").show();
    $("#starchart_center").prop('disabled', false);
    $("#starchart_lock").prop('disabled', false);
    $("#reticle-telescope").show();
  } else {
    $("#celestial-map-telescope-icon").css({"background-image": "url(assets/images/telescope.png)"});
    $("#celestial-map-telescope-coords").hide();
    $("#starchart_center").prop('disabled', true);
    $("#starchart_lock").prop('disabled', true);
    $("#reticle-telescope").hide();
  }
}

function starchartStatusIcon(status) {
  return; // function disabled
  if (status === undefined) {
      var color = "#ffffff";
  } else if (status) {
      var color = "#009933";
  } else {
      var color = "#ff0000";
  }

  $("#celestial-map-icon").css({color: color});
}

function locationStatusIcon(status) {
  return; // function disabled
  if (status === undefined) {
      var color = "#ffffff";
  } else if (status) {
      var color = "#009933";
  } else {
      var color = "#ff0000";
  }

  $("#celestial-map-location-icon").css({color: color});
}

function systemLocationTime(enabled) { // Enable/Disable location and date/time fields in celestial display settings
  if (enabled) {
    $("#lat").attr('disabled', true);
    $("#lon").attr('disabled', true);
    $("#datetime").attr('disabled', true);
    $("#here").css({ opacity: 0, cursor: 'default' });
    $("#day-left").css({ opacity: 0, cursor: 'default' });
    $("#now").css({ opacity: 0, cursor: 'default' });
    $("#day-right").css({ opacity: 0, cursor: 'default' });
  } else {
    $("#lat").attr('disabled', false);
    $("#lon").attr('disabled', false);
    $("#datetime").attr('disabled', false);
    $("#here").css({ opacity: 1, cursor: 'pointer' });
    $("#day-left").css({ opacity: 1, cursor: 'pointer' });
    $("#now").css({ opacity: 1, cursor: 'pointer' });
    $("#day-right").css({ opacity: 1, cursor: 'pointer' });
  }
}

function clearWorkspace() {
  // clear workspace
  $("#region-of-interest").remove(); // hide ROI
  $("#celestial-form").hide(); // hide star chart settings
  $("#terminal-container").hide(); // hide terminal
  $(".panel-container").hide(); // hide main dock panels
  $("#main-dock span").removeClass("dock-item-active"); // inactivate docker items
  // $("#main-dock").animate({width: 'toggle'}, 200); // hide main dock
  $("#main-dock-handle").trigger("click");
}

// function drawReticleOnCanvas(ra, dec) {
//   //console.log([ra, dec]);
//   // Celestial.Canvas.symbol().type("circle").position(Celestial.getPoint([ra,dec], "equatorial" ))();
//   // Celestial.display();
//   // return;

//   if (typeof ra !== 'number' || !isFinite(ra)) return;
//   if (typeof dec !== 'number' || !isFinite(dec)) return;

//   if (ra < 0 || ra > 360) return;
//   if (dec < -90 || dec > 90) return;

//   // Convert ra from 0...360 to -180...180
//   if (ra > 180)
//     ra -= 360;

//   // Style properties for lines and text
//   var lineStyle = {
//     width: 0.8,
//     stroke: "rgba(255, 0, 0, 1)",
//     fill: "rgba(255, 0, 0, 0.1)"
//   };

//   var textStyle = {
//       fill: "rgba(255, 0, 0, 1)",
//       font: "normal 11px 'Roboto Regular', Arial, sans-serif",
//       align: "left",
//       baseline: "top"
//   };

//   var jsonLine = {
//     "type": "FeatureCollection",
//     "features": [ // this is an array, add as many objects as you want
//       {
//         "type": "Feature",
//         "id": "Telescope",
//         "properties": {
//           "name": "Telescope",
//         },
//         "geometry": {
//           "type": "Point",
//           "coordinates": [ra, dec]
//         }
//       }
//     ]
//   };

//   Celestial.clear();
//   Celestial.add({
//     type: "line",
//     callback: function (error, json) {
//       if (error) return console.warn(error);
//       // Load the geoJSON file and transform to correct coordinate system, if necessary
//       var reticle = Celestial.getData(jsonLine, celestialConfig.transform);
//       Celestial.container.selectAll(".asterisms").data(reticle.features).enter().append("path").attr("class", "ast");
//       Celestial.redraw();
//     },

//       redraw: function() {
//         // Select the added objects by class name as given previously
//         Celestial.container.selectAll(".ast").each(function(d) {
//           // If point is visible (this doesn't work automatically for points)
//           if (Celestial.clip(d.geometry.coordinates)) {
//             // get point coordinates
//             var pt = Celestial.mapProjection(d.geometry.coordinates);
//             // object radius in pixel, could be varable depending on e.g. dimension or magnitude
//             //var r = Math.pow(20 - prop.mag, 0.7); // replace 20 with dimmest magnitude in the data
//             var r = 10;

//             // draw reticle
//             Celestial.setStyle(lineStyle);
//             Celestial.context.beginPath();
//             Celestial.context.arc(pt[0], pt[1], r, 0, 2 * Math.PI);
//             Celestial.context.closePath();
//             Celestial.context.stroke();
//             //Celestial.context.fill();

//             // draw name
//             Celestial.setTextStyle(textStyle);
//             Celestial.context.fillText(d.properties.name, pt[0] + r - 1, pt[1] - r + 1);
//           }
//         });
//     }
//   });
//   Celestial.display(celestialConfig);
// }


/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function starchartEvents() {
  $("#starchart_center").on("click", function () {
    centerOnTelescope();
  });

  $("#starchart_lock").on("click", function () {
    $("#starchart_lock").toggleClass("button-active");
    telescopeCoords.chartlock = !telescopeCoords.chartlock;
  });

  $("#celestial-map-icon").on("click", function () {
    $("#celestial-form").toggle();
  });

  $("#celestial-map-telescope-icon").on("click", function() {
    // hide all
    $("#main-dock span").removeClass("dock-item-active");
    $(".panel-container").css({display: "none"});

    // show equipment
    $("#main-dock-equipment").addClass("dock-item-active");
    $("#panel-equipment").css({display: "block"});
  });

  $("#celestial-map")
  .on("click", function (data) {
      //clearWorkspace(); // hide dock, panels, terminal etc
  })
  .on("dblclick", function (data) { // Get cursor celestial coordinates
    if (data === undefined)
      return;

    var coordinates = getPointCoordinates(data);
    getRegionOfInterest(coordinates);
  })
  .on("mousemove", function (data) { // Get cursor celestial coordinates
    clearTimeout(targetTimeout);

    if ($("#target_enable").is(':checked'))
      $("#celestial-map-target").fadeIn();

    var coordinates = getPointCoordinates(data);
    updateTargetCoords(coordinates);

    targetTimeout = setTimeout(function(){
      if ($("#target_autohide").is(':checked'))
        $("#celestial-map-target").fadeOut(2000);
    }, 3000)
  });

  $("#reticle-chart").on("dblclick", function() {
    var coordinates = Celestial.rotate();
    getRegionOfInterest(coordinates);
  })

  $("#reticle-telescope").on("dblclick", function() {
    var coordinates = Celestial.rotate();
    getRegionOfInterest(coordinates);
  })

  $("#reticle-chart").bind('mousewheel', function(e) {
    if(e.originalEvent.wheelDelta < 0) {
      Celestial.zoomBy(0.25);
    } else {
      Celestial.zoomBy(4);
    }
    // var event = new WheelEvent(e.originalEvent.type, e.originalEvent);
    // $("#celestial-map").get(0).dispatchEvent(event);
  })

  $("#reticle-telescope").bind('mousewheel', function(e) {
    if(e.originalEvent.wheelDelta < 0) {
      Celestial.zoomBy(0.25);
    } else {
      Celestial.zoomBy(4);
    }
  })
}

export {
  dsoType,
  requestStarChart,
  updateStarChartLocation,
  updateTelescopeCoords,
  getTelescopeReticle,
  setTelescopeLocation,
  loadStarChartLock,
  updateTelecopeCoords,
  updateStarChartCoords,
  centerOnTelescope,
  centerOnCoords,
  centerOnSolarObject,
  telescopeStatusIcon,
  starchartStatusIcon,
  locationStatusIcon,
  systemLocationTime,
  starchartEvents
};
