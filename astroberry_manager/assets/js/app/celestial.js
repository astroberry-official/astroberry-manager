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

// Celestial Docs: https://armchairastronautics.blogspot.com/search/label/D3-Celestial

import { timeNow } from './time.js';
import { geoLocation, updateGeoLocation } from './location.js';
import { syslogPrint } from './helpers.js';
import { JulianDateFromUnixTime, raDecToAltAz, deg2dms, deg2hms } from './functions.js';
import { celestialConfig } from './celestial.config.js';
import { socket } from './sockets.js';

var planets = {
  "sol": "Sun", "mer": "Mercury", "ven": "Venus", "lun": "Moon", "mar": "Mars", "jup": "Jupiter",
  "sat": "Saturn", "ura": "Uranus", "nep": "Neptune", "cer": "Ceres", "plu": "Pluto"
};

var dsoType = {
  g: "Galaxy", s: "Spiral Galaxy", s0: "Lenticular Galaxy", sd: "Dwarf Galaxy", e: "Elliptical Galaxy",
  i: "Irregular Galaxy", oc: "Open Cluster", gc: "Globular Cluster", en: "Emission Nebula", bn: "Bright Nebula",
  sfr: "HII Region", rn: "Reflection Nebula", pn: "Planetary Nebula", snr: "Supernova Remnant",
  dn: "Dark Nebula", pos: "N/A"
};

var telescopeCoords = { 'RA': 0, 'DEC': 0, 'chartlock': false };

var reticleRadius = 40;

var reticleChart = d3.select("body").append("img")
  .attr("id", "reticle-chart")
  .attr("width", reticleRadius)
  .attr("height", reticleRadius)
  .attr("src", "assets/images/reticle_chart.svg")
  .style({ opacity: 0.8, "z-index": 50 });

var reticleTelescope = d3.select("body").append("img")
  .attr("id", "reticle-telescope")
  .attr("width", reticleRadius)
  .attr("height", reticleRadius)
  .attr("src", "assets/images/reticle_telescope.svg")
  .style({ opacity: 0.8, "z-index": 50, display: "none" });

var targetTimeout = 0; // hides target widget after 3s of inactivity

function requestStarChart() {
  Celestial.display(celestialConfig);
  Celestial.addCallback(updateStarChartCoords);
  systemLocationTime(true);
  loadStarChartLock();
  console.log("Star Chart loaded");
}

function getPointCoordinates(data) {
  if (data === undefined || data === null)
    return;
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

function updateTelescope(data) {
  if (data === undefined || data === null)
    return;

  data = data['equipment']; // strip header
  if (data === undefined || data.TELESCOPE === undefined)
    return;

  var telescopeNames = Object.keys(data.TELESCOPE); // get all active telescopes

  const telescopeId = 0; // use the first telescope ONLY

  if (data.TELESCOPE[telescopeNames[telescopeId]]['EQUATORIAL_EOD_COORD']) {
    // remember last coordinates
    var lastRA = telescopeCoords.RA ? telescopeCoords.RA : 0;
    var lastDEC = telescopeCoords.DEC ? telescopeCoords.DEC : 0;

    // get coordinates from telescope
    var _telescopeCoords = data.TELESCOPE[telescopeNames[telescopeId]]['EQUATORIAL_EOD_COORD'];
    telescopeCoords.RA = _telescopeCoords.RA[0];
    telescopeCoords.DEC = _telescopeCoords.DEC[0];

    // update telescope status
    updateTelescopeStatusIcon(true);

    // update position of telescope reticle
    updateTelescopeReticle(telescopeCoords);

    // get equatorial coordinates from star chart
    var starchartCoords = Celestial.rotate()

    // convert RA from -180...+180 to 0...360 deg
    if (starchartCoords[0] < 0)
      starchartCoords[0] += 360;

    //console.log({'RA': telescopeCoords.RA * 15, 'DEC': telescopeCoords.DEC}, {'RA': starchartCoords[0], 'DEC': starchartCoords[1]});

    // If star chart coords equal telescope coords ~30 arsec, set icon status
    var coordsPrecision = 30 / 3600;
    if (Math.abs(telescopeCoords.RA * 15 - starchartCoords[0]) < coordsPrecision && Math.abs(telescopeCoords.DEC - starchartCoords[1]) < coordsPrecision) {
      updateStarchartStatusIcon(true);
    } else {
      updateStarchartStatusIcon(false);
    }

    // If chart locked on telescope, follow the telescope
    var updateThreshold = 15 * 60 / 3600;
    if (telescopeCoords.chartlock && (!telescopeCoords || Math.abs(telescopeCoords.RA * 15 - starchartCoords[0]) > updateThreshold || Math.abs(telescopeCoords.DEC - starchartCoords[1]) > updateThreshold)) {
      centerOnTelescope();
    }
  }

  if (data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD']) {
    //console.log(data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD']);

    var scopeLocation = {
      mode: "telescope",
      latitude: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LAT[0],
      longitude: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG[0] > 180 ? 180 - data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG[0] : data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].LONG[0],
      altitude: data.TELESCOPE[telescopeNames[telescopeId]]['GEOGRAPHIC_COORD'].ELEV[0]
    };

    if ($('input[name="geoloc_mode"]:checked').val() == "telescope")
      updateGeoLocation(scopeLocation);

    if (scopeLocation.latitude.toFixed(2) == parseFloat(geoLocation.latitude).toFixed(2) && scopeLocation.longitude.toFixed(2) == parseFloat(geoLocation.longitude).toFixed(2)) {
      updateLocationStatusIcon(true);
    } else {
      updateLocationStatusIcon(false);
      syslogPrint("Telescope location and Star chart location are different", "danger", true);
      //console.log(scopeLocation.latitude, scopeLocation.longitude);
    }
  }
}

function getAzAlt(ra, dec) {
  if (ra === undefined || ra === null || dec === undefined || dec === null)
    return;

  var lat = geoLocation.latitude;
  var lon = geoLocation.longitude;

  // compute UT julian date
  const jd = JulianDateFromUnixTime(timeNow.getTime());

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

  var azalt = getAzAlt(ra / 15, dec);

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
  if (geoLocation === undefined || geoLocation === null || geoLocation.latitude === undefined || geoLocation.latitude === null || geoLocation.longitude === undefined || geoLocation.longitude === undefined)
    return;

  // convert RA from -180...+180 to 0...360 deg
  if (ra < 0)
    ra += 360;

  var azalt = getAzAlt(ra / 15, dec);

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

  // show center of the star chart
  updateChartReticle(); // update starchart reticle
  updateTelescopeReticle(telescopeCoords); // update telescope reticle
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

function centerOnCoords(ra, dec, rot = 0) { // degrees
  if (ra === undefined || ra === null || dec === undefined || dec === null)
    return;

  if (typeof ra !== 'number' || !isFinite(ra)) return;
  if (typeof dec !== 'number' || !isFinite(dec)) return;

  if (ra < 0 || ra > 360) return;
  if (dec < -90 || dec > 90) return;

  var config = { center: [ra, dec, rot] };
  Celestial.rotate(config); // go to
}

function setTelescopeCoordinates(ra, dec) {
  if (ra === undefined || ra === null || dec === undefined || dec === null)
    return;

  if (typeof ra !== 'number' || !isFinite(ra)) return;
  if (typeof dec !== 'number' || !isFinite(dec)) return;

  if (ra < 0 || ra > 360) return;
  if (dec < -90 || dec > 90) return;

  var coordinates = { ra: ra, dec: dec };

  socket.timeout(5000).emit("equipment", coordinates, (err) => {
    if (err) {
      console.log("Setting telescope coordinates timed out");
    } else {
      //console.log("Telescope coordinates requested");
    }
  });
}

function centerOnSolarObject(id) {
  if (id === undefined || id === null) return;
  var p = Celestial.getPlanet(id, timeNow);
  centerOnCoords(p.ephemeris.pos[0], p.ephemeris.pos[1]);
}

function animsStarChart(id, params) {
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

function updateChartReticle() {
  var coordinates = Celestial.rotate()
  var pt = Celestial.mapProjection(coordinates);
  reticleChart.style({ left: px(pt[0] - reticleRadius / 2 + 2), top: px(pt[1] - reticleRadius / 2 + 2), opacity: 0.8 });
}

function updateTelescopeReticle(data) {
  if (data === undefined || data === null) {
    return;
  }

  var ra = data.RA * 15; // converting ra from hours to degrees
  var dec = data.DEC;

  var coordinates = [ra, dec];
  var pt = Celestial.mapProjection(coordinates);
  reticleTelescope.style({ left: px(pt[0] - reticleRadius / 2 + 2), top: px(pt[1] - reticleRadius / 2 + 2), opacity: 0.8 });
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
  var box = d3.select("body").append("div").attr("id", "region-of-interest").style("z-index", 100);
  var pt = Celestial.mapProjection(coordinates);

  var imageUrl = 'https://www.sky-map.org/imgcut?survey=DSS2&w=128&h=128&ra=' + coordinates[0] / 15 + '&de=' + dec + '&angle=' + fov + '&output=PNG';
  //var imageUrl = 'https://sky.esa.int/esasky-tap/skyimage?target=' + ra + ' ' + dec + '&fov=' + fov + '&aspectratio=1&size=400';
  var aladinUrl = 'https://aladin.cds.unistra.fr/AladinLite/?target=' + ra + '+' + dec + '&fov=' + fov + '&survey=CDS%2FP%2FDSS2%2Fcolor';
  //var detailsUrl = 'https://simbad.u-strasbg.fr/simbad/sim-coo?Coord=' + ra + '+' + dec + '&Radius=' + fov + '&Radius.unit=deg&output.max=10'
  var detailsUrl = 'https://simbad.u-strasbg.fr/simbad/sim-coo?Coord=' + ra + '+' + dec + '&CooFrame=ICRS&CooEqui=2000.0&CooEpoch=J2000&&&Radius.unit=deg&submit=Query+around&Radius=' + fov + '&output.max=10';

  // var properties = {'name': 'NGC 224', 'desig': 'M31', 'alt': 'Andromeda Galaxy', 'cl': 'Spiral Galaxy', 'mag': 5, 'dim': 10};
  var properties = {}; // TODO: show data for a major object in the region

  box.style({ left: px(ra + pt[0] - width / 2), top: px(dec + pt[1]), opacity: 1, border: "solid 1px #e1e1e11f" });

  box.selectAll("*").remove();

  if (properties.name || properties.desig || properties.alt || properties.cl || dsoType[properties.type]) {
    box.append("span").classed("data", true).text("Names: ");
    if (properties.name) box.append("span").classed("title", true).text(properties.name + ", ")
    if (properties.desig) box.append("span").text(properties.desig + ", ");
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

  if (imageUrl && aladinUrl) {
    box.append("div").attr("id", "region-of-interest-image").append("a").attr({ "href": aladinUrl, "target": "_blank", "data-tooltip": "tooltip", title: "Look up object in Aladin Sky Atlas" })
      .append("img").attr({ "src": imageUrl, "width": 256 });
  }

  box.append("span").attr({ "id": "region-of-interest-fav", "class": "fa fa-star", "data-tooltip": "tooltip", title: "Add this region to favorites" })
    .style({ position: "absolute", top: "15px", left: "15px" });

  box.append("span").text("Region of Interest").style({ position: "absolute", top: "14px", left: "45px", color: "#aaa" });

  if (fov) box.append("span").text("FOV: " + fov + "  ").style({ position: "absolute", top: "14px", right: "50px", color: "#aaa" });

  box.append("span").attr({ "id": "region-of-interest-close", "class": "fa fa-times", "data-tooltip": "tooltip", title: "Close region of interest" })
    .style({ position: "absolute", top: "12px", right: "12px" });

  box.append("button").attr("id", "region-of-interest-center").attr("class", "btn btn-primary").attr("data-tooltip", "tooltip").attr("title", "Center object in star chart").text("Center");

  if (detailsUrl) {
    box.append("a").attr({ "id": "region-of-interest-details", "href": detailsUrl, target: "_blank", "data-tooltip": "tooltip", title: "Look up the region in SIMBAD online database" }).text("Details");
  }

  box.append("button").attr("id", "region-of-interest-goto").attr("class", "btn btn-primary").attr("data-tooltip", "tooltip").attr("title", "Center telescope on the object").text("Go to");

  box.append("span").classed("label", true).text("RA");
  box.append("span").classed("starchart-coords", true).text(deg2hms(ra));
  box.append("span").classed("label", true).text("DEC");
  box.append("span").classed("starchart-coords", true).text(deg2dms(dec));
  box.append("br");

  // get azimuth and altitude
  var azalt = getAzAlt(ra / 15, dec);
  var az = deg2dms(azalt[0] * 180 / Math.PI);
  var alt = deg2dms(azalt[1] * 180 / Math.PI);

  box.append("span").classed("label", true).text("AZ");
  box.append("span").classed("starchart-coords", true).text(az);
  box.append("span").classed("label", true).text("ALT");
  box.append("span").classed("starchart-coords", true).text(alt);

  // register events
  $("#region-of-interest").draggable();

  d3.select("#region-of-interest-fav").on("click", function (data) {
    addROItoFavorites(data);
  });

  d3.select("#region-of-interest-center").on("click", function () {
    centerOnCoords(ra, dec);
  });

  d3.select("#region-of-interest-goto").on("click", function () {
    setTelescopeCoordinates(ra, dec);
  });

  d3.select("#region-of-interest-close").on("click", function () {
    $("#region-of-interest").remove();
  });
}

function updateTelescopeStatusIcon(status) {
  if (status) {
    $("#celestial-map-telescope-icon").css({ "background-image": "url(assets/images/telescope-active.png)" });
    $("#celestial-map-telescope-coords").show();
    $("#starchart_center").prop('disabled', false);
    $("#starchart_lock").prop('disabled', false);
  } else {
    $("#celestial-map-telescope-icon").css({ "background-image": "url(assets/images/telescope.png)" });
    $("#celestial-map-telescope-coords").hide();
    $("#starchart_center").prop('disabled', true);
    $("#starchart_lock").prop('disabled', true);
  }
}

function updateStarchartStatusIcon(status) {
  return // disabled
  if (status === undefined) {
    var color = "#ffffff";
  } else if (status) {
    var color = "#009933";
  } else {
    var color = "#ff0000";
  }

  $("#celestial-map-icon").css({ color: color });
}

function updateLocationStatusIcon(status) {
  if (status === undefined) {
    var color = "#ffffff";
  } else if (status) {
    var color = "#009933";
  } else {
    var color = "#ff0000";
  }

  $("#celestial-map-location-icon").css({ color: color });
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

function addROItoFavorites(data) {
  console.log(data);
}


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

  $("#celestial-map-telescope-icon").on("click", function () {
    $("#main-dock-equipment").trigger("click");
  });

  $("#celestial-map")
    .on("click", function (data) {
      if (data === undefined || data === null)
        return;
      //clearWorkspace(); // hide dock, panels, terminal etc
    })
    .on("dblclick", function (data) { // Get cursor celestial coordinates
      if (data === undefined || data === null)
        return;

      var coordinates = getPointCoordinates(data);
      centerOnCoords(coordinates[0], coordinates[1]);
    })
    .on("mousemove", function (data) { // Get cursor celestial coordinates
      if (data === undefined || data === null)
        return;

      clearTimeout(targetTimeout);

      if ($("#target_enable").is(':checked'))
        $("#celestial-map-target").fadeIn();

      var coordinates = getPointCoordinates(data);
      updateTargetCoords(coordinates);

      targetTimeout = setTimeout(function () {
        if ($("#target_autohide").is(':checked'))
          $("#celestial-map-target").fadeOut(2000);
      }, 3000)
    });

  $("#reticle-chart").on("dblclick", function () {
    var coordinates = Celestial.rotate();
    getRegionOfInterest(coordinates);
  })

  $("#reticle-telescope").on("dblclick", function () {
    var coordinates = Celestial.rotate();
    getRegionOfInterest(coordinates);
  })

  $("#reticle-chart").bind('mousewheel', function (e) {
    if (e.originalEvent.wheelDelta < 0) {
      Celestial.zoomBy(0.25);
    } else {
      Celestial.zoomBy(4);
    }
  })

  $("#reticle-telescope").bind('mousewheel', function (e) {
    if (e.originalEvent.wheelDelta < 0) {
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
  updateTelescope,
  centerOnCoords,
  centerOnSolarObject,
  updateTelescopeStatusIcon,
  systemLocationTime,
  starchartEvents
};
