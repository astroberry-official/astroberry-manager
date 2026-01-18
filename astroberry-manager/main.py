#!/usr/bin/env python3
# coding=utf-8

"""
Copyright(c) 2026 Radek Kaczorek  <rkaczorek AT gmail DOT com>

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
"""

import sys, os, shutil, subprocess
import pty, fcntl, termios, struct, select
import pam

from gevent import monkey
monkey.patch_all()

from threading import Event
from flask import Flask, render_template, redirect, url_for, request, session
from flask_socketio import SocketIO

from location import getLocation
from weather import getWeather
from almanac import getAlmanac
from equipment import getINDIServer, telescopeControl
from system import getSystemReports, getSystemReportOnce, runSystemUpdate, runSystemBackup, runSystemRestore, runSystemRestart, runSystemShutdown, process_status

__author__ = 'Radek Kaczorek'
__copyright__ = 'Copyright 2024, Radek Kaczorek'
__license__ = 'GPL-3'
__version__ = '1.0.0'

os.chdir('/home/astroberry')

app = Flask(__name__, static_folder='assets')
app.secret_key = os.getenv('APP_KEY', 'secret_key!')
socketio = SocketIO(app)

# terminal file descriptor & process
fd = None
child_pid = None

# background threads
terminalThread = None
vncServerThread = None
vncSocketThread = None
indiAPIThread = None
equipmentThread = None
locationThread = None
sysmonThread = None

# start/stop event for INDI client
equipmentThreadEvent = Event()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        remember = request.form.get('remember')
        login = pam.authenticate(username, password)
        if login:
            print("User %s login successful" % username)
            if remember:
                session.permanent = True
            else:
                session.permanent = False
            session['username'] = username
            return redirect(url_for('index'))
        else:
            print("User %s login failed" % username)
    return render_template('login.html')

@app.route('/logout')
def logout():
    print("User session closed")
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/')
def index():
    if 'username' in session:
        return render_template('index.html')
    return redirect(url_for('login'))

@socketio.on('connect')
def connect():
    print("Socket connected")

    # update system info once at start for user experience
    getSystemReportOnce(socketio)

@socketio.on('disconnect')
def disconnect():
    print("Socket disconnected")

@socketio.on('weather')
def weather(data):
    getWeather(socketio, data["latitude"], data["longitude"])

@socketio.on('almanac')
def almanac(data):
    getAlmanac(socketio, data["time"], data["latitude"], data["longitude"], data["altitude"])

@socketio.on('equipment')
def equipment(data):
    global equipmentThread, equipmentThreadEvent

    if 'connect' in data.keys() and data['connect']:
        print("Connecting to INDI server")
        equipmentThreadEvent.set()
        equipmentThread = socketio.start_background_task(getINDIServer, socketio, equipmentThreadEvent)

    if 'disconnect' in data.keys() and data['disconnect']:
        print("Disconnecting from INDI server")
        equipmentThreadEvent.clear()
        equipmentThread = None

@socketio.on('telescope')
def telescope(data):
    telescopeControl(data)

@socketio.on('system')
def system(data):
    if "action" not in data:
        return

    if data['action'] == "update":
        runSystemUpdate(socketio)
    elif data['action'] == "backup":
        runSystemBackup(socketio)
    elif data['action'] == "restore":
        runSystemRestore(socketio)
    elif data['action'] == "restart":
        runSystemRestart(socketio)
    elif data['action'] == "shutdown":
        runSystemShutdown(socketio)
    elif data['action'] == "info":
        getSystemReportOnce(socketio)
    else:
        return

@socketio.on("pty-input")
def pty_input(data):
    global fd
    if fd:
        os.write(fd, data["input"].encode())

@socketio.on("resize")
def resize(data):
    global fd
    if fd:
        set_terminal_winsize(data["rows"], data["cols"])

def set_terminal_winsize(row, col, xpix=0, ypix=0):
    global fd
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def read_and_forward_pty_output():
    #print("Running terminal background thread")
    global fd
    max_read_bytes = 1024 * 20
    while True:
        socketio.sleep(0.01)
        #time.sleep(0.01)
        if fd:
            timeout_sec = 0
            (data_ready, _, _) = select.select([fd], [], [], timeout_sec)
            if data_ready:
                output = os.read(fd, max_read_bytes).decode(
                    errors="ignore"
                )
                socketio.emit("pty-output", {"output": output})

def shut_down():
    print('Good Bye\n')
    sys.exit()

def main():
    global fd, child_pid, terminalThread, locationThread, indiAPIThread, sysmonThread, vncSocketThread, vncServerThread
    try: # Start main app
        print("Astroberry Manager v"+__version__)

        if terminalThread is None:
            print("Starting terminal")
            terminalThread = socketio.start_background_task(read_and_forward_pty_output)

            # create child process attached to a pty
            (child_pid, fd) = pty.fork()
            if child_pid == 0:
                # this is the child process fork
                cmd = shutil.which("bash") # run bash shell as default
                while True: # always respawn
                    subprocess.run([cmd])

        if locationThread is None:
            print("Starting geolocation")
            locationThread = socketio.start_background_task(getLocation, socketio)

        if indiAPIThread is None:
            cmd = shutil.which("indi-web")
            if cmd and not process_status("indi-web"):
                print("Starting INDI API")
                indiAPIThread = subprocess.Popen([cmd, "--cors", "http://astroberry:8080"])

        if vncServerThread is None: # https://wiki.archlinux.org/title/X11vnc
            cmd = shutil.which("x11vnc")
            if cmd and not process_status("x11vnc"):
                print("Starting remote desktop")
                vncServerThread = subprocess.Popen([cmd, "-display", ":0", "-auth", "guess", "-forever", "-loop", "-noxdamage", "-nowf", "-no6", "-noipv6", "-listen", "localhost", "-avahi"])

        if vncSocketThread is None:
            cmd = shutil.which("websockify")
            if cmd and not process_status("websockify"):
                print("Starting desktop socket")
                vncSocketThread = subprocess.Popen([cmd, ":8070", "127.0.0.1:5900"])

        if sysmonThread is None:
            print("Starting system monitoring")
            sysmonThread = socketio.start_background_task(getSystemReports, socketio)

        # start main app
        socketio.run(app, host='0.0.0.0', port = 8080, debug=False)
        shut_down()

    except KeyboardInterrupt:
        shut_down()


if __name__ == "__main__":
    main()
