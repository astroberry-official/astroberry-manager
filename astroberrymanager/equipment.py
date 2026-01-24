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

import ephem, time, json, logging, PyIndi
from datetime import datetime, timezone

# Local INDI server
INDI_HOST = '127.0.0.1'
INDI_PORT = 7624
TIMEOUT = 5

class IndiClient(PyIndi.BaseClient):
	def __init__(self):
		super(IndiClient, self).__init__()
		self.logger = logging.getLogger('IndiClient')
		self.logger.info('Creating an instance of IndiClient')

	def newDevice(self, d):
		'''Emmited when a new device is created from INDI server.'''
		self.logger.debug(f"New device: {d.getDeviceName()}")

	def removeDevice(self, d):
		'''Emmited when a device is deleted from INDI server.'''
		self.logger.debug(f"Remove device: {d.getDeviceName()}")

	def newProperty(self, p):
		'''Emmited when a new property is created for an INDI driver.'''
		self.logger.debug(f"New property: {p.getName()} as {p.getTypeAsString()} for device {p.getDeviceName()}")
		property = getProperty(p)
		if property:
			data = {'equipment': property}
			emitEquipment(self.socketio, data)

	def updateProperty(self, p):
		'''Emmited when a new property value arrives from INDI server.'''
		self.logger.debug(f"Update property: {p.getName()} as {p.getTypeAsString()} for device {p.getDeviceName()}")
		property = getProperty(p)
		if property:
			data = {'equipment': property}
			emitEquipment(self.socketio, data)

	def removeProperty(self, p):
		'''Emmited when a property is deleted for an INDI driver.'''
		self.logger.debug(f"Remove property: {p.getName()} as {p.getTypeAsString()} for device {p.getDeviceName()}")

	def newMessage(self, d, m):
		'''Emmited when a new message arrives from INDI server.'''
		self.logger.debug(f"New Message: {d.messageQueue(m)}")
		# msg = "2026-01-23T17:47:34: [INFO] Telescope
		msg = d.messageQueue(m).split(":")
		msg = msg[3].strip().split("]")
		msg = msg[1].strip()
		data = {'msg': msg }
		emitEquipment(self.socketio, data)

	def serverConnected(self):
		'''Emmited when the server is connected.'''
		self.logger.info(f"Server connected ({self.getHost()}:{self.getPort()})")

	def serverDisconnected(self, code):
		'''Emmited when the server gets disconnected.'''
		self.logger.info(f"Server disconnected (exit code = {code},{self.getHost()}:{self.getPort()})")
		self.disconnectServer() # double shot required to destroy instance

# Create an instance of the IndiClient class and initialize its host/port members
indiClient = IndiClient()
indiClient.setServer(INDI_HOST,INDI_PORT)

def getINDIServer(socketio, event):
	#logging.basicConfig(format = '%(asctime)s %(message)s', level = logging.INFO)
	logging.basicConfig(format = '%(message)s', level = logging.INFO)

	indiClient.socketio = socketio # use main socket

	while True:
		if not event.is_set():
			print("Closing INDI server connection")
			break # exit on request from main thread

		while not indiClient.isServerConnected():
			try:
				indiClient.connectServer()
				time.sleep(1)
				if not indiClient.isServerConnected():
					indiClient.logger.info(f"Cannot connect to INDI server on {indiClient.getHost()}:{str(indiClient.getPort())}. Retrying in {str(TIMEOUT)} seconds.")
					time.sleep(TIMEOUT)
			except Exception as err:
				indiClient.logger.info(f"Error connecting to INDI server: {err}")

		time.sleep(1)

def getProperty(property):
	"""
	Return RFC 8259 compliant JSON assembled from properties of devices connected to INDI server
	{ device_type:
		{ device_name:
		  {	property_name: [value, label],
				'GROUP': group,
				'LABEL':label,
				'TYPE': type,
				'STATE': state,
				'PERM': perm
		  }
		}
	}
	"""

	device_type = getDeviceType(property.getBaseDevice().getDriverInterface())
	device_name = property.getDeviceName()
	name = property.getName()
	label = property.getLabel()
	group = property.getGroupName()
	type = property.getTypeAsString()
	state = property.getStateAsString()
	perm = property.getPermission()

	if device_type is None or device_name is None or name is None:
		return

	device_data = json.loads("{}")
	device_properties = json.loads("{}")
	device_property = json.loads("{}")

	if property.getType() == PyIndi.INDI_TEXT:
		for t in property.getText():
			device_property.update({t.name:[t.text, t.label]})
			device_properties.update({name: device_property})
	elif property.getType()==PyIndi.INDI_NUMBER:
		for t in property.getNumber():
			device_property.update({t.name:[t.value, t.label]})
			device_properties.update({name: device_property})
	elif property.getType()==PyIndi.INDI_SWITCH:
		for t in property.getSwitch():
			device_property.update({t.name:[strISState(t.s), t.label]})
			device_properties.update({name: device_property})
	elif property.getType()==PyIndi.INDI_LIGHT:
		for t in property.getLight():
			device_property.update({t.name:[strIPState(t.s), t.label]})
			device_properties.update({name: device_property})
	elif property.getType()==PyIndi.INDI_BLOB:
		for t in property.getBLOB():
			device_property.update({t.name:['<blob ' + str(t.size) + ' bytes>', t.label]})
			device_properties.update({name: device_property})
	else:
		IndiClient.logger.error(f"Unknown property type ({type})")

	device_properties.update({'GROUP': group, 'LABEL':label, 'TYPE': type, 'STATE': state, 'PERM': perm})

	device_data.update({device_type: { device_name: device_properties }})

	return device_data

def getJSON(devices):
	"""
	Return RFC 8259 compliant JSON assembled from properties of devices connected to INDI server
	{ device_type:
		{ device_name:
		  {	property_name: [value, label],
				'GROUP': group,
				'LABEL':label,
				'TYPE': type,
				'STATE': state,
				'PERM': perm
		  }
		}
	}
        """

	if not devices:
		return

	equipment = json.loads("{}")

	for device in devices:
		if device.getDriverInterface():
			device_type = getDeviceType(device.getDriverInterface())
		else:
			continue

		device_name = device.getDeviceName()
		device_data = json.loads("{}")
		properties = device.getProperties()
		device_properties = json.loads("{}")

		for property in properties:
			device_property = json.loads("{}")
			property_name = property.getName()
			if property.getType() == PyIndi.INDI_TEXT:
				for t in property.getText():
					device_property.update({t.name:[t.text, t.label]})
					device_properties.update({property_name: device_property})
			elif property.getType()==PyIndi.INDI_NUMBER:
				for t in property.getNumber():
					device_property.update({t.name:[t.value, t.label]})
					device_properties.update({property_name: device_property})
			elif property.getType()==PyIndi.INDI_SWITCH:
				for t in property.getSwitch():
					device_property.update({t.name:[strISState(t.s), t.label]})
					device_properties.update({property_name: device_property})
			elif property.getType()==PyIndi.INDI_LIGHT:
				for t in property.getLight():
					device_property.update({t.name:[strIPState(t.s), t.label]})
					device_properties.update({property_name: device_property})
			elif property.getType()==PyIndi.INDI_BLOB:
				for t in property.getBLOB():
					device_property.update({t.name:['<blob ' + str(t.size) + ' bytes>', t.label]})
					device_properties.update({property_name: device_property})

		device_data.update({device_name: device_properties})

		# Handle multiple devices of a type
		if device_type in equipment.keys():
			existing_device_type_json = equipment[device_type]
			existing_device_type_json.update(device_data)
		else:
			equipment.update({device_type: device_data})

	return equipment

def emitEquipment(socketio, data):
	if socketio and data:
		socketio.emit('indiserver', data )
	else:
		print(data)

def strISState(s):
	if (s == PyIndi.ISS_ON):
		return "ON"
	else:
		return "OFF"

def strIPState(s):
	if (s == PyIndi.IPS_IDLE):
		return "IDLE"
	elif (s == PyIndi.IPS_OK):
		return "OK"
	elif (s == PyIndi.IPS_BUSY):
		return "BUSY"
	elif (s == PyIndi.IPS_ALERT):
		return "ALERT"

# Based on https://github.com/indilib/indi/blob/master/libs/indidevice/basedevice.h#L83
def getDeviceType(s):
	if s & 0:
		return "GENERAL"
	elif s & (1 << 0):
		return "TELESCOPE"
	elif s & (1 << 1):
		return "CCD"
	elif s & (1 << 2):
		return "GUIDER"
	elif s & (1 << 3):
		return "FOCUSER"
	elif s & (1 << 4):
		return "FILTER"
	elif s & (1 << 5):
		return "DOME"
	elif s & (1 << 6):
		return "GPS"
	elif s & (1 << 7):
		return "WEATHER"
	elif s & (1 << 8):
		return "AO"
	elif s & (1 << 9):
		return "DUSTCAP"
	elif s & (1 << 10):
		return "LIGHTBOX"
	elif s & (1 << 11):
		return "DETECTOR"
	elif s & (1 << 12):
		return "ROTATOR"
	elif s & (1 << 13):
		return "SPECTROGRAPH"
	elif s & (1 << 14):
		return "CORRELATOR"
	elif s & (1 << 15):
		return "AUX"
	else:
		return

# https://docs.indilib.org/drivers/
def telescopeControl(data):
	if 'action' in data and data['action'] == 'setlocation':
		try:
			devices = indiClient.getDevices()
			for device in devices:
				if getDeviceType(device.getDriverInterface()) == "TELESCOPE":
					telescope = device.getDeviceName()
					break # use first seen telescope

			device = indiClient.getDevice(telescope)

			if not (device) or not (device.isConnected()):
				print("Setting telescope location aborted. No telescope device found")
				return

			if data['params']['lat'] < -90 or data['params']['lat'] > 90 or data['params']['lon'] < 0 or data['params']['lon'] > 360:
				print("Setting telescope location aborted. Invalid location requested")
				return

			observer = device.getNumber("GEOGRAPHIC_COORD") # Get telescope location
			# latitude = observer[0].getValue()
			# longitude = observer[1].getValue()
			# elevation = observer[2].getValue()

			# Set telescope location
			observer[0].setValue(data['params']['lat'])
			observer[1].setValue(data['params']['lon'])
			observer[2].setValue(data['params']['alt'])

			indiClient.sendNewProperty(observer)
			print("%s location set to LAT %s LONG %s" % (telescope, target["ra"], target["dec"]))
		except Exception as e:
			print(e)
			return

# TODO: Fix ephem returning slightly different altitude than celestial map
def getAzAlt(coordinates, location, time = None):
	if not time:
		time = datetime.now(timezone.utc)

	# define target
	target = ephem.FixedBody()
	target._ra = coordinates[0] * ephem.degree
	target._dec = coordinates[1] * ephem.degree

	# define observer
	observer = ephem.Observer()
	observer.lat = location[0] * ephem.degree
	observer.lon = location[1] * ephem.degree
	observer.elevation = location[2]
	observer.date = time
	target.compute(observer)
	#alt_norefract = ephem.unrefract(0, 0, target.alt)

	return(str(target.az), str(target.alt))
