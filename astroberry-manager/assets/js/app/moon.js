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

// Inspired by https://engaging-data.com/pages/scripts/moon/moon2.html

var size  = 140; // moon picture width & height (px)

var svg = d3.select("#moon_shadow")
	.append("svg")
		.attr("width",  size)
		.attr("height", size);

var centerx = 299*size/600;
var centery = 301*size/600;
var r = 278*size/600;

$("#moon_picture").width(size);
$("#moon_picture").height(size);

function updateMoon(shadow) {
	DrawMoonShade(shadow, centerx, centery, r);
}

function DrawMoonShade(Phase, CX, CY, R) {
	//erase previous dark region
	svg.select("path").remove();
	svg.select("circle").remove();

	// full moon
	if(Phase == 1) { 
		return;
	};
	
	// new moon
	if(Math.abs(Phase) == 0) {
		svg.append("circle")
			.attr({
				"class": "moonShade",
				"cx":    CX,
				"cy":    CY,
				"r":     R
			});
		return;
	};
	
	var d = "M" + CX + "," + (CY - R) +
		"A" + R + "," + R +
		" 0 1 " + ((Phase > 0) ? "0" : "1") +
		" " + CX + "," + (CY + R);
		// console.log(d3.polygonArea(d));

	if(Math.abs(Phase) == 0.5) {
		// half moon
		d += "Z";
	}
	else {
		var h = 2 * R * (
			((Phase > -0.5) && (Phase < 0.5) ? 1 - Math.abs(Phase) : Math.abs(Phase))
						- 0.5);
		var leg = Math.sqrt(R * R + h * h);
	
		var bigR = leg * leg / (2 * Math.sqrt(leg * leg - R * R));
	
		d += "A" + bigR + "," + bigR +
			" 0 0 " + 
			((Phase < -0.5) || ((Phase > 0) && (Phase < 0.5)) ? "0" : "1") +
			" " + CX + "," + (CY - R);
	};
	
	svg.append("path")
		.attr({
			"class": "moonShade",
			"d":     d,
			"id":'moonShadow'
		});
};

export { updateMoon }
