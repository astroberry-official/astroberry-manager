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
import { getCookie, setCookie, syslogPrint } from "./helpers.js";
import { socket } from "./sockets.js";

var path = "../assets/images/weather/";
var weatherIcon = document.getElementById("weather_icon"); //.contentDocument.rootElement;

const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const weekdays_short = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function requestWeather() {
  var data = {};
  data['latitude'] = parseFloat(geoLocation.latitude);
  data['longitude'] = parseFloat(geoLocation.longitude);

  if (!data) return;

  socket.timeout(5000).emit("weather", data, (err) => {
      if (err) {
          syslogPrint("Weather data request timed out", "danger");
      } else {
          //syslogPrint("Weather data requested");
      }
  });
}

function loadWeather() {
    // Load units preferrence
    if (getCookie("config")) {
      var config = JSON.parse(getCookie("config"));

      // load units
      if (config["weather_units"] == "F") {
        $('#weather_units_f').prop("checked", true);
      } else {
        $('#weather_units_c').prop("checked", true);
      }

      // load alerts
      if (config["alert_noclouds"]) {
          $('#weather_alerts_noclouds').prop("checked", true);
      } else {
          $('#weather_alerts_noclouds').prop("checked", false);
      }

      if (config["alert_humidity"]) {
          $('#weather_alerts_humidity').prop("checked", true);
      } else {
          $('#weather_alerts_humidity').prop("checked", false);
      }

      if (config["alert_wind"]) {
          $('#weather_alerts_wind').prop("checked", true);
      } else {
          $('#weather_alerts_wind').prop("checked", false);
      }

      // load forecast hour
      if (config["weather_forecast_at"] == "00") $('#weather_forecast_00').prop("checked", true);
      if (config["weather_forecast_at"] == "06") $('#weather_forecast_06').prop("checked", true);
      if (config["weather_forecast_at"] == "12") $('#weather_forecast_12').prop("checked", true);
      if (config["weather_forecast_at"] == "18") $('#weather_forecast_18').prop("checked", true);
  } else {
      $('#weather_units_c').prop("checked", true);
      $('#weather_alerts_noclouds').prop("checked", false);
      $('#weather_alerts_humidity').prop("checked", false);
      $('#weather_alerts_wind').prop("checked", false);
      $('#weather_forecast_00').prop("checked", true);
  }

  requestWeather();
}

function updateWeather(data) {
    updateWeatherMetno(data); // Weather forecast from met.no, delivered by the Norwegian Meteorological Institute
    //console.log("Weather updated");
}

function updateWeatherMetno(data) {
    /* https://github.com/metno/weatherapi-docs/blob/master/doc/locationforecast/HowTO.md */
    /* apiurl = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + lat + "&lon=" + lon; */

    var _data = JSON.parse(data)

    if (!_data || !_data._timeseries)
        return;

    //var dateUTC = new Date(Date.UTC(thisDay.getUTCFullYear(), thisDay.getUTCMonth(), thisDay.getUTCDate(), thisDay.getUTCHours(), thisDay.getUTCMinutes(), thisDay.getUTCSeconds()));
    var thisDay = new Date(_data.updated_at);
    var forecastHour = $('input[name="weather_forecast_time"]:checked').val() ?  $('input[name="weather_forecast_time"]:checked').val() : "00";
    var scope = [];

    // Find dates for days covered by forecast 
    for (var day = 0; day <= 5; day++) {
        var nextDay = new Date(Date.UTC(thisDay.getUTCFullYear(), thisDay.getUTCMonth(), thisDay.getUTCDate() + day, forecastHour, "00", "00"));

        // Find timeseries index for days covered by forecast
        for (var i in _data._timeseries) {
            var d = new Date(_data._timeseries[i].time);
            if (nextDay.getTime() == d.getTime()) {
                scope[day] = parseInt(i);
            }
        }

        if (!scope[day]) // if no data for specified time, fall back to latest update
            scope[day] = 0;
    }

    getForecast(_data, scope);

    // Set weather details
    var dt = new Date(_data.updated_at).toTimeString().split(" (")[0];
    $("#weather_updated").html("Last updated:<br>" + dt);

}

function getForecast(data, scope) { // Forecast - get weather summary and details for next 5 DAYS from 14:00 to 20:00 (day time weather)
    var forecast = [];

    for (var day in scope) {
        var tp = data._timeseries[scope[day]];
        var date = tp.time;

        // Get weekday
        var thisDate = new Date(date);
        var weekday = weekdays_short[thisDate.getDay()];

        // Display weather
        if (day == 0) {
            var summary = tp.data.next_1_hours.summary.symbol_code;
            var details = tp.data.instant.details;
            //console.log(details);

            // Set weather icon and legend
            weatherIcon.setAttribute('src', path + summary + '.svg'); // // Set weather icon
            $("#weather_legend").html(getWeatherSummary(summary)); // Display weather text legend

            if ($('input[name="weather_units"]:checked').val() == "C") {
                var temperature = details.air_temperature + " °C";
                var dewpoint = details.dew_point_temperature + " °C";
                var humidity = details.relative_humidity + " %";
                var pressure = details.air_pressure_at_sea_level + " hPa";
                var clouds = details.cloud_area_fraction + " %";
                var wind = details.wind_speed + " m/s";
                //var winddir = details.wind_from_direction + " °";
                var precipitation = 0 + " mm";
            } else {
                var temperature = (details.air_temperature * 9/5 + 32).toFixed(1) + " °F";
                var dewpoint = (details.dew_point_temperature * 9/5 + 32).toFixed(1) + " °F";
                var humidity = details.relative_humidity + " %";
                var pressure = (details.air_pressure_at_sea_level * 0.0145037738).toFixed(1) + " psi";
                var clouds = details.cloud_area_fraction + " %";
                var wind = (details.wind_speed * 2.237).toFixed(1)  + " mph";
                //var winddir = details.wind_from_direction + " °";
                var precipitation = (0 / 25.4).toFixed(1)  + " ″";
            }

            $("#weather_temperature").html(temperature);
            $("#weather_dewpoint").html("Dew point: " + dewpoint);
            $("#weather_humidity").html("Humidity: " + humidity);
            $("#weather_pressure").html("Pressure: " + pressure);
            $("#weather_clouds").html("<span class='fa fa-cloud' ></span>" + clouds);
            $("#weather_wind").html("<span class='fa fa-align-justify'></span>" + wind);
            //$("#weather_winddir").html("Wind direction: " + winddir);
            $("#weather_precipitation").html("<span class='fa fa-tint'></span>" + precipitation);
        } else {
            var summary = tp.data.next_6_hours.summary.symbol_code;
            var details = tp.data.instant.details;

            var days = $(".weather_next div");
            // Daily icons
            days[day-1].children.item(1).setAttribute('src', path + summary + '.svg');

            // Daily forecast
            if ($('input[name="weather_units"]:checked').val() == "C") {
                var temperature = details.air_temperature + " °C";
            } else {
                var temperature = (details.air_temperature * 9/5 + 32).toFixed(1) + " °F";
            }
            $(".weather_next div").find(".weather_weekday").eq(day-1).html(weekday);
            $(".weather_next div").find(".weather_temp_sm").eq(day-1).html("<span class='fa fa-thermometer-full'></span> " + temperature);
            $(".weather_next div").find(".weather_clouds_sm").eq(day-1).html("<span class='fa fa-cloud'></span> " + details.cloud_area_fraction + " %");

            // Alerts
            if (details.cloud_area_fraction < 1 && $('#weather_alerts_noclouds').is(':checked')) { // No clouds
                $(".weather_next div").find(".weather_weekday").eq(day-1).html(weekday);
                $(".weather_next div").find(".weather_weekday").eq(day-1).html(
                  "<span class='weather_alert_noclouds blink' data-tooltip='tooltip' title='Clear Sky'>" + weekday + "</span>"
                );
            }

            if (details.wind_speed > 20 && $('#weather_alerts_wind').is(':checked')) { // Wind
              $(".weather_next div").find(".weather_weekday").eq(day-1).html(
                "<span class='weather_alert_wind blink' data-tooltip='tooltip' title='Wind Alert'>" + weekday + "</span>"
              );
            }

            if (details.relative_humidity > 80 && $('#weather_alerts_humidity').is(':checked')) { // Humidity
              $(".weather_next div").find(".weather_weekday").eq(day-1).html(
                "<span class='weather_alert_humidity blink'  data-tooltip='tooltip' title='Humidity Alert'>" + weekday + "</span>"
              );
            }

        }

        forecast[day] = {'date': date, 'weekday': weekday, 'summary': summary, 'details': details};
    }

    $("#weather_update").removeClass("fa-spin");

    return forecast;
}

function getWeatherSummary(code) {
    var weatherSummary;
    
    $.each(legend, function(index, data) {
        if (data["Symbol ID"] == code.split("_")[0])
            weatherSummary = data["English"];
    });

    return weatherSummary;
}

/* ================================================================== */
/*                             EVENTS
/* ================================================================== */

function weatherEvents() {
  $("#toggle-weather-forecast").on("click", function () {
      toggleWeatherForecast();
  });

  $("#toggle-weather-settings").on("click", function () {
      toggleWeatherSettings();
  });

  $("#weather_update").on("click", function () {
      $("#weather_update").addClass("fa-spin");
      requestWeather();
  });

  $("#weather_units").on("change", function() {
      setCookie("config", JSON.stringify({"weather_units": $('input[name="weather_units"]:checked').val()}));
      requestWeather();
  });

  $("#weather_alerts_noclouds").on("change", function() {
    if ($('#weather_alerts_noclouds').is(':checked')) {
      setCookie("config", JSON.stringify({"alert_noclouds": true}));
    } else {
      setCookie("config", JSON.stringify({"alert_noclouds": false}));
    }
  });

  $("#weather_alerts_humidity").on("change", function() {
    if ($('#weather_alerts_humidity').is(':checked')) {
      setCookie("config", JSON.stringify({"alert_humidity": true}));
    } else {
      setCookie("config", JSON.stringify({"alert_humidity": false}));
    }
  });

  $("#weather_alerts_wind").on("change", function() {
    if ($('#weather_alerts_wind').is(':checked')) {
      setCookie("config", JSON.stringify({"alert_wind": true}));
    } else {
      setCookie("config", JSON.stringify({"alert_wind": false}));
    }
  });

  $("#weather_forecast_time").change(function () {
      setCookie("config", JSON.stringify({"weather_forecast_at": $('input[name="weather_forecast_time"]:checked').val()}));
      requestWeather();
  });

  $("#weather_alerts").change(function () {
      requestWeather();
  });

}

function toggleWeatherForecast() {
$("#toggle-weather-forecast").addClass("button-active");
$("#toggle-weather-settings").removeClass("button-active");

$("#weather_forecast").css({display: "block"});
$("#weather_settings").css({display: "none"});
}

function toggleWeatherSettings() {
$("#toggle-weather-forecast").removeClass("button-active");
$("#toggle-weather-settings").addClass("button-active");

$("#weather_forecast").css({display: "none"});
$("#weather_settings").css({display: "block"});
}

const legend = [
  {
    "Symbol ID": "clearsky",
    "English": "Clear sky",
    "Variants": 1
  },
  {
    "Symbol ID": "fair",
    "English": "Fair",
    "Variants": 1
  },
  {
    "Symbol ID": "partlycloudy",
    "English": "Partly cloudy",
    "Variants": 1
  },
  {
    "Symbol ID": "cloudy",
    "English": "Cloudy",
    "Variants": 0
  },
  {
    "Symbol ID": "lightrainshowers",
    "English": "Light rain showers",
    "Variants": 1
  },
  {
    "Symbol ID": "rainshowers",
    "English": "Rain showers",
    "Variants": 1
  },
  {
    "Symbol ID": "heavyrainshowers",
    "English": "Heavy rain showers",
    "Variants": 1
  },
  {
    "Symbol ID": "lightrainshowersandthunder",
    "English": "Light rain showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "rainshowersandthunder",
    "English": "Rain showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "heavyrainshowersandthunder",
    "English": "Heavy rain showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "lightsleetshowers",
    "English": "Light sleet showers",
    "Variants": 1
  },
  {
    "Symbol ID": "sleetshowers",
    "English": "Sleet showers",
    "Variants": 1
  },
  {
    "Symbol ID": "heavysleetshowers",
    "English": "Heavy sleet showers",
    "Variants": 1
  },
  {
    "Symbol ID": "lightssleetshowersandthunder",
    "English": "Light sleet showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "sleetshowersandthunder",
    "English": "Sleet showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "heavysleetshowersandthunder",
    "English": "Heavy sleet showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "lightsnowshowers",
    "English": "Light snow showers",
    "Variants": 1
  },
  {
    "Symbol ID": "snowshowers",
    "English": "Snow showers",
    "Variants": 1
  },
  {
    "Symbol ID": "heavysnowshowers",
    "English": "Heavy snow showers",
    "Variants": 1
  },
  {
    "Symbol ID": "lightssnowshowersandthunder",
    "English": "Light snow showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "snowshowersandthunder",
    "English": "Snow showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "heavysnowshowersandthunder",
    "English": "Heavy snow showers and thunder",
    "Variants": 1
  },
  {
    "Symbol ID": "lightrain",
    "English": "Light rain",
    "Variants": 0
  },
  {
    "Symbol ID": "rain",
    "English": "Rain",
    "Variants": 0
  },
  {
    "Symbol ID": "heavyrain",
    "English": "Heavy rain",
    "Variants": 0
  },
  {
    "Symbol ID": "lightrainandthunder",
    "English": "Light rain and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "rainandthunder",
    "English": "Rain and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "heavyrainandthunder",
    "English": "Heavy rain and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "lightsleet",
    "English": "Light sleet",
    "Variants": 0
  },
  {
    "Symbol ID": "sleet",
    "English": "Sleet",
    "Variants": 0
  },
  {
    "Symbol ID": "heavysleet",
    "English": "Heavy sleet",
    "Variants": 0
  },
  {
    "Symbol ID": "lightsleetandthunder",
    "English": "Light sleet and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "sleetandthunder",
    "English": "Sleet and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "heavysleetandthunder",
    "English": "Heavy sleet and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "lightsnow",
    "English": "Light snow",
    "Variants": 0
  },
  {
    "Symbol ID": "snow",
    "English": "Snow",
    "Variants": 0
  },
  {
    "Symbol ID": "heavysnow",
    "English": "Heavy snow",
    "Variants": 0
  },
  {
    "Symbol ID": "lightsnowandthunder",
    "English": "Light snow and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "snowandthunder",
    "English": "Snow and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "heavysnowandthunder",
    "English": "Heavy snow and thunder",
    "Variants": 0
  },
  {
    "Symbol ID": "fog",
    "English": "Fog",
    "Variants": 0
  }
];

export {
  requestWeather,
  loadWeather,
  updateWeather,
  weatherEvents
};
