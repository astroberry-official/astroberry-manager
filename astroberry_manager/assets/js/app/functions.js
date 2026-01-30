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

function hour2degree(ra) {
  return ra > 12 ? (ra - 24) * 15 : ra * 15;
}

function dms2deg (dms) {
    var _dms = dms.split(' ');
    var _deg = parseFloat(_dms[0].substr(-3, 2));
    var _min = parseFloat(_dms[0].substr(-3, 2));
    var _sec  = parseFloat(_dms[0].substr(-3, 2));

    var deg = (_deg * 3600 + _min * 60 + _sec) / 3600;
    return deg;
}

function deg2hms (deg) {
    if (deg === null || isNaN(parseFloat(deg))) return;
    var ra = deg < 0 ? (deg + 360) / 15 : deg / 15,
       h = Math.floor (ra),
       rest1 = (ra - h) * 60,
       m = Math.floor(rest1),
       rest2 = (rest1 - m) * 60,
       s = Math.round(rest2);
    return '' + pad(h) + 'ʰ ' + pad(m) + 'ᵐ ' + pad(s) + 'ˢ';
}

function deg2dms (deg) {
    if (deg === null || isNaN(parseFloat(deg))) return;
    var d = Math.floor (deg),
       rest1 = (deg - d) * 60,
       m = Math.floor(rest1),
       rest2 = (rest1 - m) * 60;
       var s = Math.round(rest2);
    return '' + pad(d) + '° ' + pad(m) + '′ ' + pad(s) + '″'; // 2 digits padding
    //return '' + pad(pad(d)) + '° ' + pad(m) + '′ ' + pad(s) + '″'; // 3 digits padding
}

function pad(n) { 
    if (n < 0) return n > -10 ? '-0' + Math.abs(n) : n;
    return n < 10 ? '0' + n : n; 
}

//Greg Miller (gmiller@gregmiller.net) 2021
//Released as public domain
//http://www.celestialprogramming.com/

function JulianDateFromUnixTime(t){
	//Not valid for dates before Oct 15, 1582
	return (t / 86400000) + 2440587.5;
}

function UnixTimeFromJulianDate(jd){
	//Not valid for dates before Oct 15, 1582
	return (jd-2440587.5)*86400000;
}

//All input and output angles are in radians, jd is Julian Date in UTC
function raDecToAltAz(ra, dec, lat, lon, jd_ut) {
    //Meeus 13.5 and 13.6, modified so West longitudes are negative and 0 is North
    const gmst = greenwichMeanSiderealTime(jd_ut);
    let localSiderealTime = (gmst + lon) % (2 * Math.PI);

    let H = (localSiderealTime - ra);
    if (H < 0) {H += 2 * Math.PI;}
    if (H > Math.PI) { H = H - 2 * Math.PI;}

    let az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)));
    let alt = (Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)));
    az -= Math.PI;

    if (az < 0) {az += 2 * Math.PI;}
    return [az, alt, localSiderealTime, H];
}

function greenwichMeanSiderealTime(jd){
    //"Expressions for IAU 2000 precession quantities" N. Capitaine1,P.T.Wallace2, and J. Chapront
    const t = ((jd - 2451545.0)) / 36525.0;

    // Precession Model P03 in force since 01.01.2009
    let gmst = earthRotationAngle(jd) + (0.014506 + 4612.156534 * t + 1.3915817 * t * t - 0.00000044 * t * t * t - 0.000029956 * t * t * t * t - 0.0000000368 * t * t * t * t * t) / 60.0 / 60.0 * Math.PI / 180.0;  //eq 42
    gmst %= 2 * Math.PI;
    if (gmst < 0) gmst += 2 * Math.PI;

    return gmst;
}

function earthRotationAngle(jd){
    //IERS Technical Note No. 32

    const t = jd - 2451545.0;
    const f = jd % 1.0;

    let theta = 2 * Math.PI * (f + 0.7790572732640 + 0.00273781191135448 * t); //eq 14
    theta %= 2 * Math.PI;
    if (theta < 0) theta += 2 * Math.PI;

    return theta;
}

export {
    JulianDateFromUnixTime,
    UnixTimeFromJulianDate,
    raDecToAltAz,
    greenwichMeanSiderealTime,
    earthRotationAngle,
    hour2degree,
    dms2deg,
    deg2hms,
    deg2dms,
    pad
};
