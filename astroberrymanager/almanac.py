#!/usr/bin/env python3
# coding=utf-8

"""
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
"""

import datetime, ephem, numpy

def getAlmanac(socketio, gpstime, latitude, longitude, elevation):
    t = datetime.datetime.strptime(str(gpstime), '%Y-%m-%dT%H:%M:%S.%f%z')
    t = t.replace(tzinfo=datetime.timezone.utc) #Convert it to an aware datetime object in UTC time.

    lat = "%s" % latitude
    lon = "%s" % longitude
    alt = "%.2f" % elevation

    # init observer
    home = ephem.Observer()

    # set geo position
    home.lat = lat
    home.lon = lon
    home.elevation = float(alt)
    home.date = t

    # get polaris data
    polaris_data = getPolarisData(home)

    # emit celestial data
    socketio.emit('almanac', {
    'latitude': "%.2f" % numpy.degrees(home.lat),
    'longitude': "%.2f" % numpy.degrees(home.lon),
    'elevation': "%.2f" % home.elevation,
    'polaris_hour_angle': "%.2f" % polaris_data[0],
    'polaris_next_transit': "%s" % polaris_data[1],
    'moon_phase': "%s" % getMoonPhase(home),
    'moon_light': "%.1f" % ephem.Moon(home).phase,
    'moon_rise': "%s" % getBodyPositions(home,ephem.Moon(home))[0],
    'moon_transit': "%s" % getBodyPositions(home,ephem.Moon(home))[1],
    'moon_set': "%s" % getBodyPositions(home,ephem.Moon(home))[2],
    'moon_az': "%.2f°" % numpy.degrees(ephem.Moon(home).az),
    'moon_alt': "%.2f°" % numpy.degrees(ephem.Moon(home).alt),
    'moon_ra': "%.2f" % numpy.degrees(ephem.Moon(home).ra),
    'moon_dec': "%.2f" % numpy.degrees(ephem.Moon(home).dec),
    'moon_new': "%s" % ephem.localtime(ephem.next_new_moon(t)).strftime("%Y-%m-%d %H:%M:%S"),
    'moon_full': "%s" % ephem.localtime(ephem.next_full_moon(t)).strftime("%Y-%m-%d %H:%M:%S"),
    'sun_at_start': getSunTwilights(home)[2][0],
    'sun_ct_start': getSunTwilights(home)[0][0],
    'sun_rise': "%s" % getBodyPositions(home,ephem.Sun(home))[0],
    'sun_transit': "%s" % getBodyPositions(home,ephem.Sun(home))[1],
    'sun_set': "%s" % getBodyPositions(home,ephem.Sun(home))[2],
    'sun_ct_end': getSunTwilights(home)[0][1],
    'sun_at_end': getSunTwilights(home)[2][1],
    'sun_az': "%.2f°" % numpy.degrees(ephem.Sun(home).az),
    'sun_alt': "%.2f°" % numpy.degrees(ephem.Sun(home).alt),
    'sun_ra': "%.2f" % numpy.degrees(ephem.Sun(home).ra),
    'sun_dec': "%.2f" % numpy.degrees(ephem.Sun(home).dec),
    'sun_equinox': "%s" % ephem.localtime(ephem.next_equinox(t)).strftime("%Y-%m-%d %H:%M:%S"),
    'sun_solstice': "%s" % ephem.localtime(ephem.next_solstice(t)).strftime("%Y-%m-%d %H:%M:%S"),
    'mercury_rise': "%s" % getBodyPositions(home,ephem.Mercury(home))[0],
    'mercury_transit': "%s" % getBodyPositions(home,ephem.Mercury(home))[1],
    'mercury_set': "%s" % getBodyPositions(home,ephem.Mercury(home))[2],
    'mercury_az': "%.2f°" % numpy.degrees(ephem.Mercury(home).az),
    'mercury_alt': "%.2f°" % numpy.degrees(ephem.Mercury(home).alt),
    'venus_rise': "%s" % getBodyPositions(home,ephem.Venus(home))[0],
    'venus_transit': "%s" % getBodyPositions(home,ephem.Venus(home))[1],
    'venus_set': "%s" % getBodyPositions(home,ephem.Venus(home))[2],
    'venus_az': "%.2f°" % numpy.degrees(ephem.Venus(home).az),
    'venus_alt': "%.2f°" % numpy.degrees(ephem.Venus(home).alt),
    'mars_rise': "%s" % getBodyPositions(home,ephem.Mars(home))[0],
    'mars_transit': "%s" % getBodyPositions(home,ephem.Mars(home))[1],
    'mars_set': "%s" % getBodyPositions(home,ephem.Mars(home))[2],
    'mars_az': "%.2f°" % numpy.degrees(ephem.Mars(home).az),
    'mars_alt': "%.2f°" % numpy.degrees(ephem.Mars(home).alt),
    'jupiter_rise': "%s" % getBodyPositions(home,ephem.Jupiter(home))[0],
    'jupiter_transit': "%s" % getBodyPositions(home,ephem.Jupiter(home))[1],
    'jupiter_set': "%s" % getBodyPositions(home,ephem.Jupiter(home))[2],
    'jupiter_az': "%.2f°" % numpy.degrees(ephem.Jupiter(home).az),
    'jupiter_alt': "%.2f°" % numpy.degrees(ephem.Jupiter(home).alt),
    'saturn_rise': "%s" % getBodyPositions(home,ephem.Saturn(home))[0],
    'saturn_transit': "%s" % getBodyPositions(home,ephem.Saturn(home))[1],
    'saturn_set': "%s" % getBodyPositions(home,ephem.Saturn(home))[2],
    'saturn_az': "%.2f°" % numpy.degrees(ephem.Saturn(home).az),
    'saturn_alt': "%.2f°" % numpy.degrees(ephem.Saturn(home).alt),
    'uranus_rise': "%s" % getBodyPositions(home,ephem.Uranus(home))[0],
    'uranus_transit': "%s" % getBodyPositions(home,ephem.Uranus(home))[1],
    'uranus_set': "%s" % getBodyPositions(home,ephem.Uranus(home))[2],
    'uranus_az': "%.2f°" % numpy.degrees(ephem.Uranus(home).az),
    'uranus_alt': "%.2f°" % numpy.degrees(ephem.Uranus(home).alt),
    'neptune_rise': "%s" % getBodyPositions(home,ephem.Neptune(home))[0],
    'neptune_transit': "%s" % getBodyPositions(home,ephem.Neptune(home))[1],
    'neptune_set': "%s" % getBodyPositions(home,ephem.Neptune(home))[2],
    'neptune_az': "%.2f°" % numpy.degrees(ephem.Neptune(home).az),
    'neptune_alt': "%.2f°" % numpy.degrees(ephem.Neptune(home).alt)
    })

def getMoonPhase(observer):
    target_date_utc = observer.date
    target_date_local = ephem.localtime( target_date_utc ).date()
    next_full = ephem.localtime( ephem.next_full_moon(target_date_utc) ).date()
    next_new = ephem.localtime( ephem.next_new_moon(target_date_utc) ).date()
    next_last_quarter = ephem.localtime( ephem.next_last_quarter_moon(target_date_utc) ).date()
    next_first_quarter = ephem.localtime( ephem.next_first_quarter_moon(target_date_utc) ).date()
    previous_full = ephem.localtime( ephem.previous_full_moon(target_date_utc) ).date()
    previous_new = ephem.localtime( ephem.previous_new_moon(target_date_utc) ).date()
    previous_last_quarter = ephem.localtime( ephem.previous_last_quarter_moon(target_date_utc) ).date()
    previous_first_quarter = ephem.localtime( ephem.previous_first_quarter_moon(target_date_utc) ).date()

    if target_date_local in (next_full, previous_full):
        return 'Full'
    elif target_date_local in (next_new, previous_new):
        return 'New'
    elif target_date_local in (next_first_quarter, previous_first_quarter):
        return 'First Quarter'
    elif target_date_local in (next_last_quarter, previous_last_quarter):
        return 'Last Quarter'
    elif previous_new < next_first_quarter < next_full < next_last_quarter < next_new:
        return 'Waxing Crescent'
    elif previous_first_quarter < next_full < next_last_quarter < next_new < next_first_quarter:
        return 'Waxing Gibbous'
    elif previous_full < next_last_quarter < next_new < next_first_quarter < next_full:
        return 'Waning Gibbous'
    elif previous_last_quarter < next_new < next_first_quarter < next_full < next_last_quarter:
        return 'Waning Crescent'

def getBodyPositions(observer, body):
    positions = []

    # test for always below horizon or always above horizon
    try:
        if ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.previous_transit(body) < observer.previous_setting(body) < observer.date:
            positions.append(observer.previous_rising(body))
            positions.append(observer.previous_transit(body))
            positions.append(observer.previous_setting(body))
        elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.previous_transit(body) < observer.date < observer.next_setting(body):
            positions.append(observer.previous_rising(body))
            positions.append(observer.previous_transit(body))
            positions.append(observer.next_setting(body))
        elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.date < observer.next_transit(body) < observer.next_setting(body):
            positions.append(observer.previous_rising(body))
            positions.append(observer.next_transit(body))
            positions.append(observer.next_setting(body))
        elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and  observer.date < observer.next_rising(body) < observer.next_transit(body) < observer.next_setting(body):
            positions.append(observer.next_rising(body))
            positions.append(observer.next_transit(body))
            positions.append(observer.next_setting(body))
        else:
            positions.append(observer.next_rising(body))
            positions.append(observer.next_transit(body))
            positions.append(observer.next_setting(body))
    except (ephem.NeverUpError, ephem.AlwaysUpError):
        try:
            if ephem.localtime(observer.previous_transit(body)).date() == ephem.localtime(observer.date).date() and observer.previous_transit(body) < observer.date:
                positions.append('-')
                positions.append(observer.previous_transit(body))
                positions.append('-')
            elif ephem.localtime(observer.previous_transit(body)).date() == ephem.localtime(observer.date).date() and observer.next_transit(body) > observer.date:
                positions.append('-')
                positions.append(observer.next_transit(body))
                positions.append('-')
            else:
                positions.append('-')
                positions.append('-')
                positions.append('-')
        except (ephem.NeverUpError, ephem.AlwaysUpError):
            positions.append('-')
            positions.append('-')
            positions.append('-')

    if positions[0] != '-':
        positions[0] = ephem.localtime( positions[0] ).strftime("%H:%M:%S")
    if positions[1] != '-':
        positions[1] = ephem.localtime( positions[1] ).strftime("%H:%M:%S")
    if positions[2] != '-':
        positions[2] = ephem.localtime( positions[2] ).strftime("%H:%M:%S")

    return positions

def getSunTwilights(observer):
    results = []

    """
    An observer at the North Pole would see the Sun circle the sky at 23.5° above the horizon all day.
    An observer at 90° – 23.5° = 66.5° would see the Sun spend the whole day on the horizon, making a circle along its circumference.
    An observer would have to be at 90° – 23.5° – 18° = 48.5° latitude or even further south in order for the Sun to dip low enough for them to observe the level of darkness defined as astronomical twilight. 

    civil twilight = -6
    nautical twilight = -12
    astronomical twilight = -18

    getSunTwilights(home)[0][0]   -   civil twilight end
    getSunTwilights(home)[0][1]   -   civil twilight start

    getSunTwilights(home)[1][0]   -   nautical twilight end
    getSunTwilights(home)[1][1]   -   nautical twilight start

    getSunTwilights(home)[2][0]   -   astronomical twilight end
    getSunTwilights(home)[2][1]   -   astronomical twilight start
    """

    # remember entry observer horizon
    observer_horizon = observer.horizon

    # twilights, their horizons and whether to use the centre of the Sun or not
    twilights = [('-6', True), ('-12', True), ('-18', True)]

    for twi in twilights:
        observer.horizon = twi[0]
        try:
            rising_setting = getBodyPositions(observer,ephem.Sun(observer))
            results.append((rising_setting[0], rising_setting[2]))
        except ephem.AlwaysUpError:
            results.append(('n/a', 'n/a'))

    # reset observer horizon to entry
    observer.horizon = observer_horizon

    return results

def getPolarisData(observer):
    polaris_data = []

    """
    lst = 100.46 + 0.985647 * d + lon + 15 * ut [based on http://www.stargazing.net/kepler/altaz.html]
    d - the days from J2000 (1200 hrs UT on Jan 1st 2000 AD), including the fraction of a day
    lon - your longitude in decimal degrees, East positive
    ut - the universal time in decimal hours
    """

    j2000 = ephem.Date('2000/01/01 12:00:00')
    d = observer.date - j2000

    lon = numpy.rad2deg(float(observer.lon))

    utstr = observer.date.datetime().strftime("%H:%M:%S")
    ut = float(utstr.split(":")[0]) + float(utstr.split(":")[1])/60 + float(utstr.split(":")[2])/3600

    lst = 100.46 + 0.985647 * d + lon + 15 * ut
    lst = lst - int(lst / 360) * 360

    polaris = ephem.readdb("Polaris,f|M|F7,2:31:49.095,89:15:50.79,2.02,2000")
    polaris.compute()

    polaris_ra_deg = numpy.rad2deg(float(polaris._ra))

    # polaris Hour Angle = LST - RA Polaris [expressed in degrees or 15*(h+m/60+s/3600)]
    pha = lst - polaris_ra_deg

    # normalize
    if pha < 0:
        pha += 360
    elif pha > 360:
        pha -= 360

    # append polaris hour angle
    polaris_data.append(pha)

    # append polaris next transit
    try:
        pnt = ephem.localtime(observer.next_transit(polaris)).strftime("%H:%M:%S")
        polaris_data.append(pnt)
    except (ephem.NeverUpError, ephem.AlwaysUpError):
        polaris_data.append('-')

    return polaris_data
