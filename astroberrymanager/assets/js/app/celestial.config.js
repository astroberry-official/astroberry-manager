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

export var celestialConfig = {	//https://github.com/ofrohn/d3-celestial
      width: 0,			// Default width, 0 = full parent width; height is determined by projection
      projection: "aitoff",	// Map projection used: airy, aitoff, armadillo, august, azimuthalEqualArea, azimuthalEquidistant, baker, berghaus, boggs,
                                // bonne, bromley, collignon, craig, craster, cylindricalEqualArea, cylindricalStereographic, eckert1,
                                // eckert2, eckert3, eckert4, eckert5, eckert6, eisenlohr, equirectangular, fahey, foucaut,
                                // ginzburg4, ginzburg5, ginzburg6, ginzburg8, ginzburg9, gringorten, hammer, hatano, healpix, hill,
                                // homolosine, kavrayskiy7, lagrange, larrivee, laskowski, loximuthal, mercator, miller, mollweide,
                                // mtFlatPolarParabolic, mtFlatPolarQuartic, mtFlatPolarSinusoidal, naturalEarth, nellHammer,
                                // orthographic, patterson, polyconic, rectangularPolyconic, robinson, sinusoidal, stereographic,
                                // times, twoPointEquidistant, vanDerGrinten, vanDerGrinten2, vanDerGrinten3, vanDerGrinten4,
                                // wagner4, wagner6, wagner7, wiechel, winkel3
      //projectionRatio: 2,     // Optional override for default projection ratio
      transform: "equatorial",  // Coordinate transformation: equatorial (default), ecliptic, galactic, supergalactic
      //center: [20, 0, 0],     // Initial center coordinates in equatorial transformation [hours, degrees, degrees],
                                // otherwise [degrees, degrees, degrees], 3rd parameter is orientation, null = default center
      orientationfixed: false,  // Keep orientation angle the same as center[2]
      background: { fill: "#000000", stroke: "#000000", opacity: 0.5 }, // Background style
      follow: "center",         // on which coordinates to center the map, default: zenith, if location enabled, otherwise center
      //zoomlevel: 1.25,        // initial zoom level 0...zoomextend; 0|null = default, 1 = 100%, 0 < x <= zoomextend
      zoomlevel: 1,
      zoomextend: 50,           // maximum zoom level
      adaptable: true,          // Sizes are increased with higher zoom-levels
      interactive: true,        // Enable zooming and rotation with mousewheel and dragging
      disableAnimations: false, // Disable all animations
      form: false,              // Display settings form
      controls: true,           // Display zoom controls
      formFields: {"location": true,  // Set visiblity for each group of fields with the respective id
                   "general": true,
                   "stars": true,
                   "dsos": true,
                   "constellations": true,
                   "lines": true,
                   "other": true,
                   "download": true},
      advanced: false,          // Display fewer form fields if false
      daterange: [],            // Calendar date range; null: displaydate-+10; [n<100]: displaydate-+n; [yr]: yr-+10;
                                // [yr, n<100]: [yr-n, yr+n]; [yr0, yr1]
      lang: "en",               // Language for names, so far only for constellations: de: german, es: spanish
                                // Default:en or empty string for english
      container: "celestial-map",   // ID of parent element, e.g. div
      datapath: "assets/js/d3-celestial/data/",  // Path/URL to data files, empty = subfolder 'data'
      stars: { // Stars
        show: true,             // Show stars
        limit: 6,               // Show only stars brighter than limit magnitude
        colors: true,           // Show stars in spectral colors, if not use "color"
        style: { fill: "#ffffff", opacity: 1 }, // Default style for stars
        designation: true,      // Show star names (Bayer, Flamsteed, Variable star, Gliese or designation,
                                // i.e. whichever of the previous applies first); may vary with culture setting
        designationType: "desig",  // Which kind of name is displayed as designation (fieldname in starnames.json)
        designationStyle: { fill: "#ddddbb", font: "10px 'Roboto Regular', Arial, sans-serif", align: "left", baseline: "top" },
        designationLimit: 3,    // Show only names for stars brighter than nameLimit
        propername: true,       // Show proper name (if present)
        propernameType: "name", // Languge for proper name, default IAU name; may vary with culture setting
                                // (see list below of languages codes available for stars)
        propernameStyle: { fill: "#ddddbb", font: "12px 'Roboto Regular', Arial, sans-serif", align: "right", baseline: "bottom" },
        propernameLimit: 2,     // Show proper names for stars brighter than propernameLimit
        size: 8,                // Maximum size (radius) of star circle in pixels
        exponent: -0.3,         // Scale exponent for star size, larger = more linear
        data: 'stars.6.json'  // Data source for stellar data
        //data: 'stars.8.json'    // Alternative deeper data source for stellar data
        //data: 'stars.14.json' // Alternative deepest data source for stellar data
      },
      dsos: { // Deep Space Objects
        show: true,             // Show Deep Space Objects
        limit: 6,               // Show only DSOs brighter than limit magnitude
        names: true,            // Show DSO names
        namesType: "name",      // Type of DSO ('desig' or language) name shown
                                // (see list below for languages codes available for dsos)
        nameStyle: { fill: "#cccccc", font: "12px 'Roboto Regular', Arial, sans-serif",
                     align: "left", baseline: "bottom" }, // Style for DSO names
        nameLimit: 6,           // Show only names for DSOs brighter than namelimit
        size: null,             // Optional seperate scale size for DSOs, null = stars.size
        exponent: 2.2,            // Scale exponent for DSO size, larger = more non-linear
        data: 'dsos.bright.json', // Data source for DSOs, opt. number indicates limit magnitude
        //data: 'dsos.6.json',
        //data: 'dsos.14.json',
        //data: 'dsos.20.json',
        //data: 'lg.json',
        //data: 'messier.json',
        symbols: { //DSO symbol styles, 'stroke'-parameter present = outline
          gg: {shape: "circle", stroke: "#f08c00", width: 1.5},          // Galaxy cluster
          g:  {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Generic galaxy
          s:  {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Spiral galaxy
          s0: {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Lenticular galaxy
          sd: {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Dwarf galaxy
          e:  {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Elliptical galaxy
          i:  {shape: "ellipse", stroke: "#f08c00", width: 1.5},         // Irregular galaxy
          oc: {shape: "circle", stroke: "#ffcc00", width: 1.5},          // Open cluster
          gc: {shape: "circle", stroke: "#ff9900", width: 1.5},          // Globular cluster
          en: {shape: "square", stroke: "#ff00cc", width: 1.5},          // Emission nebula
          bn: {shape: "square", stroke: "#ff00cc", width: 2},            // Generic bright nebula
          sfr:{shape: "square", stroke: "#cc00ff", width: 2},            // Star forming region
          rn: {shape: "square", stroke: "#0000ff", width: 1.5},          // Reflection nebula
          pn: {shape: "diamond", stroke: "#00cccc", width: 1.5},         // Planetary nebula
          snr:{shape: "diamond", stroke: "#ff00cc", width: 1.5},         // Supernova remnant
          dn: {shape: "square", stroke: "#999999", width: 2},            // Dark nebula grey
          pos:{shape: "marker", fill: "#cccccc",
               stroke: "#cccccc", width: 1.5}                            // Generic marker
        }
      },
      planets: {  //Show planet locations, if date-time is set
        show: true,
        // List of all objects to show
        which: ["sol", "mer", "ven", "ter", "lun", "mar", "jup", "sat", "ura", "nep"],
        // Font styles for planetary symbols
        symbols: {  // Character and color for each symbol in 'which' above (simple circle: \u25cf), optional size override for Sun & Moon
          "sol": {symbol: "\u2609", letter:"Su", fill: "#ffff00", size:""},
          "mer": {symbol: "\u263f", letter:"Me", fill: "#cccccc"},
          "ven": {symbol: "\u2640", letter:"V", fill: "#eeeecc"},
          "ter": {symbol: "\u2295", letter:"T", fill: "#00ccff"},
          "lun": {symbol: "\u25cf", letter:"L", fill: "#ffffff", size:""}, // overridden by generated crecent, except letter & size
          "mar": {symbol: "\u2642", letter:"Ma", fill: "#ff6600"},
          "cer": {symbol: "\u26b3", letter:"C", fill: "#cccccc"},
          "ves": {symbol: "\u26b6", letter:"Ma", fill: "#cccccc"},
          "jup": {symbol: "\u2643", letter:"J", fill: "#ffaa33"},
          "sat": {symbol: "\u2644", letter:"Sa", fill: "#ffdd66"},
          "ura": {symbol: "\u2645", letter:"U", fill: "#66ccff"},
          "nep": {symbol: "\u2646", letter:"N", fill: "#6666ff"},
          "plu": {symbol: "\u2647", letter:"P", fill: "#aaaaaa"},
          "eri": {symbol: "\u26aa", letter:"E", fill: "#eeeeee"}
        },
        symbolStyle: { fill: "#00ccff", font: "40px 'Roboto Regular', Arial, sans-serif", align: "center", baseline: "middle" },
        symbolType: "disk",     // Type of planet symbol: 'symbol' graphic planet sign, 'disk' filled circle scaled by magnitude
                                // 'letter': 1 or 2 letters S Me V L Ma J S U N
        names: true,            // Show name in nameType language next to symbol
        nameStyle: { fill: "#00ccff", font: "12px 'Roboto Regular', Arial, sans-serif", align: "right", baseline: "top" },
        namesType: "en"         // Language of planet name (see list below of language codes available for planets),
                                // or desig = 3-letter designation
      },
      constellations: { // Constellations
        names: true,            // Show constellation names
        namesType: "iau",       // Type of name Latin (iau, default), 3 letter designation (desig) or other language (see list below)
        nameStyle: { fill:"#cccccc", align: "center", baseline: "middle",
                     font: ["12px 'Roboto Regular', Arial, sans-serif",  // Style for constellations
                            "11px 'Roboto Regular', Arial, sans-serif",  // Different fonts for diff.
                            "10px 'Roboto Regular', Arial, sans-serif"]}, // ranked constellations
        lines: true,            // Show constellation lines, style below
        lineStyle: { stroke: "#cccccc", width: 0.8, opacity: 0.3 },
        bounds: true,          // Show constellation boundaries, style below
        boundStyle: { stroke: "#cccc00", width: 0.5, opacity: 0.8, dash: [2, 4] }
      },
      mw: { // Milky Way
        show: true,             // Show Milky Way as filled polygons
        style: { fill: "#415a6b", opacity: "0.1" }
      },
      lines: {
        graticule: { show: true, stroke: "#cccccc", width: 0.5, opacity: 0.5,                       // Show graticule lines
          lon: {pos: ["center"], fill: "#eee", font: "10px 'Roboto Regular', Arial, sans-serif"},   // grid values: "outline", "center", or [lat,...] specific position
          lat: {pos: ["center"], fill: "#eee", font: "10px 'Roboto Regular', Arial, sans-serif"}},  // grid values: "outline", "center", or [lon,...] specific position
        equatorial: { show: true, stroke: "#aaaaaa", width: 1.5, opacity: 0.7 },                    // Show equatorial plane
        ecliptic: { show: true, stroke: "#66cc66", width: 1, opacity: 0.7 },                        // Show ecliptic plane
        galactic: { show: false, stroke: "#cc6666", width: 1, opacity: 0.7 },                       // Show galactic plane
        supergalactic: { show: false, stroke: "#cc66cc", width: 1, opacity: 0.7 }                   // Show supergalactic plane
      },
      background: { // Background
        fill: "#000000",    // Area fill
        opacity: 1,
        stroke: "#000000",  // Outline
        width: 1.5
      },
      horizon: { //Show horizon marker, if location is set and map projection is all-sky
        show: true,
        stroke: "#990000",  // Line
        width: 0.4,
        fill: "#000000",    // Area below horizon
        opacity: 0.6
      },
      daylight: {  //Show day sky as a gradient, if location is set and map projection is hemispheric
        show: false
      }
};
