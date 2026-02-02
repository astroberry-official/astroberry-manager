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

import sys, os, shutil, subprocess, io
import pty, fcntl, termios, struct, select
import pam, socket, logging

from gevent import monkey
monkey.patch_all()

from threading import Event
from flask import Flask, render_template, redirect, url_for, request, session, send_file
from flask_socketio import SocketIO

from .location import getLocation
from .weather import getWeather
from .almanac import getAlmanac
from .equipment import getEquipment, setEquipment
from .system import getSystemReports, getSystemReportOnce, runSystemUpdate, runSystemBackup, runSystemRestore, runSystemRestart, runSystemShutdown, process_status, getCA

__author__ = 'Radek Kaczorek'
__copyright__ = 'Copyright 2026, Radek Kaczorek'
__license__ = 'GPL-3'
__version__ = '1.0.0'

# working directory
wdir = os.getenv('HOME', '/')
os.chdir(wdir)

# networking
app_addr = '127.0.0.1'
app_port = 8080
app_host = socket.gethostname()

# main app
app = Flask(__name__, static_folder='assets')
app.secret_key = os.getenv('APP_KEY', 'e55325c30acadadaae4006cf80c6439502043408f792afe57f501c2db4a0fc22')
socketio = SocketIO(app)

# Setup logger
logging.basicConfig(level = logging.ERROR)

# web terminal file descriptor & process
fd = None
child_pid = None

# background threads
locationThread = None
terminalThread = None
sysmonThread = None
equipmentThread = None

# start/stop event for INDI client
equipmentThreadEvent = Event()

@app.route('/welcome')
def welcome():
    return render_template('welcome.html')

@app.route('/ca.crt')
def certificate():
    bytes = io.BytesIO(getCA())
    return send_file(bytes, mimetype='application/x-x509-ca-cert')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        remember = request.form.get('remember')
        login = pam.authenticate(username, password)
        if login:
            app.logger.info("User %s login successful" % username)
            session['username'] = username
            if remember:
                session.permanent = True
            else:
                session.permanent = False
            return redirect(url_for('index'))
        else:
            app.logger.info("User %s login failed" % username)
    return render_template('login.html')

@app.route('/logout')
def logout():
    app.logger.info("User session closed")
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/')
def index():
    if 'username' in session:
        return render_template('index.html')
    return redirect(url_for('login'))

@socketio.on('connect')
def connect():
    if 'username' in session:
        app.logger.info("Socket connected")
        getSystemReportOnce(socketio)
        return True
    else:
        app.logger.info("Socket connection rejected")
        return False

@socketio.on('disconnect')
def disconnect():
    app.logger.info("Socket disconnected")
    return True

@socketio.on('weather')
def weather(data):
    getWeather(socketio, data["latitude"], data["longitude"])

@socketio.on('almanac')
def almanac(data):
    getAlmanac(socketio, data["time"], data["latitude"], data["longitude"], data["altitude"])

@socketio.on('equipment')
def equipment(data):
    setEquipment(data)

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
    global fd
    max_read_bytes = 1024 * 20
    while True:
        socketio.sleep(0.01)
        if fd:
            timeout_sec = 0
            (data_ready, _, _) = select.select([fd], [], [], timeout_sec)
            if data_ready:
                output = os.read(fd, max_read_bytes).decode(
                    errors="ignore"
                )
                socketio.emit("pty-output", {"output": output})

def shut_down():
    app.logger.info('Good Bye\n')
    sys.exit()

def main():
    global app_addr, app_port
    global fd, child_pid
    global terminalThread, locationThread, sysmonThread, equipmentThread

    try:
        print("Astroberry Manager v"+__version__+"\n")

        if locationThread is None:
            print("✓ Starting location services")
            locationThread = socketio.start_background_task(getLocation, socketio)

        if terminalThread is None:
            print("✓ Starting terminal services")
            terminalThread = socketio.start_background_task(read_and_forward_pty_output)
            (child_pid, fd) = pty.fork()
            if child_pid == 0:
                cmd = shutil.which("bash")
                while True:
                    subprocess.run([cmd])

        if sysmonThread is None:
            print("✓ Starting system services")
            sysmonThread = socketio.start_background_task(getSystemReports, socketio)

        if equipmentThread is None:
            print("✓ Starting equipment services")
            equipmentThreadEvent.set() # call equipmentThreadEvent.clear() to terminate background thread
            equipmentThread = socketio.start_background_task(getEquipment, socketio, equipmentThreadEvent)

        print("✓ Starting main application\n")

        print("Point your browser to http://%s.local:%d/\n" % (app_host, app_port))

        # start main app
        socketio.run(app, host=app_addr, port = app_port, debug=False)
        app.logger.info("Application exited")
        shut_down()

    except KeyboardInterrupt:
        shut_down()

if __name__ == "__main__":
    main()
