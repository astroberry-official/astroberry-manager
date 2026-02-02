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

import os, psutil, shutil, time, subprocess, requests

POLLING = 60

def get_release_info():
    from .main import __version__
    ui_version = __version__

    path = '/etc/astroberry/version'
    if os.path.exists(path):
        with open(path) as f:
            osv = f.read()
            os_version = "Astroberry OS " + osv
    else:
        os_version = os.popen("grep PRETTY_NAME /etc/os-release | cut -d= -f2").read().replace("\"","").strip()

    if os.popen("dpkg -l | grep libindi1").read():
        indi_version = os.popen("dpkg -s libindi1|grep Version: | cut -d' '  -f2 | cut -d+ -f1").read().strip()
    else:
        indi_version = "unknown"

    if os.popen("dpkg -l | grep kstars-bleeding").read():
        kstars_version = os.popen("dpkg -s kstars-bleeding|grep Version: | cut -d' '  -f2 | cut -d+ -f1").read().strip()
    else:
        kstars_version = "unknown"

    if os.popen("dpkg -l | grep phd2").read():
        phd2_version = os.popen("dpkg -s phd2|grep Version: | cut -d' '  -f2 | cut -d+ -f1").read().strip()
    else:
        phd2_version = "unknown"

    return {
        "ui_version": ui_version,
        "os_version": os_version,
        "indi_version": indi_version,
        "kstars_version": kstars_version,
        "phd2_version": phd2_version
    }

def get_kernel_info():
    return {
        "kernel_version": os.uname().release,
        "system_name": os.uname().sysname,
        "node_name": os.uname().nodename,
        "machine": os.uname().machine
    }

def get_memory_info():
    return {
        "total_memory": psutil.virtual_memory().total / (1024.0 ** 3),
        "available_memory": psutil.virtual_memory().available / (1024.0 ** 3),
        "used_memory": psutil.virtual_memory().used / (1024.0 ** 3),
        "memory_percentage": psutil.virtual_memory().percent
    }

def get_cpu_info():
    return {
        "physical_cores": psutil.cpu_count(logical=False),
        "total_cores": psutil.cpu_count(logical=True),
        "processor_speed": psutil.cpu_freq().current,
        "cpu_usage_per_core": dict(enumerate(psutil.cpu_percent(percpu=True, interval=1))),
        "total_cpu_usage": psutil.cpu_percent(interval=1)
    }

def get_disk_info():
    partitions = psutil.disk_partitions()
    disk_info = {}
    for partition in partitions:
        partition_usage = psutil.disk_usage(partition.mountpoint)
        disk_info[partition.mountpoint] = {
            "total_space": partition_usage.total / (1024.0 ** 3),
            "used_space": partition_usage.used / (1024.0 ** 3),
            "free_space": partition_usage.free / (1024.0 ** 3),
            "usage_percentage": partition_usage.percent
        }
    return disk_info

def get_network_info():
    net_io_counters = psutil.net_io_counters()
    return {
        "bytes_sent": net_io_counters.bytes_sent,
        "bytes_recv": net_io_counters.bytes_recv
    }

def get_process_info():
    process_info = []
    for process in psutil.process_iter(['pid', 'name', 'memory_percent', 'cpu_percent']):
        try:
            process_info.append({
                "pid": process.info['pid'],
                "name": process.info['name'],
                "memory_percent": process.info['memory_percent'],
                "cpu_percent": process.info['cpu_percent']
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return process_info

def get_load_average():
    load_avg_1, load_avg_5, load_avg_15 = psutil.getloadavg()
    return {
        "load_average_1": load_avg_1,
        "load_average_5": load_avg_5,
        "load_average_15": load_avg_15
    }

def get_disk_io_counters():
    io_counters = psutil.disk_io_counters()
    return {
        "read_count": io_counters.read_count,
        "write_count": io_counters.write_count,
        "read_bytes": io_counters.read_bytes,
        "write_bytes": io_counters.write_bytes,
        "read_time": io_counters.read_time,
        "write_time": io_counters.write_time
    }
 
def get_net_io_counters():
    io_counters = psutil.net_io_counters()
    return {
        "bytes_sent": io_counters.bytes_sent,
        "bytes_recv": io_counters.bytes_recv,
        "packets_sent": io_counters.packets_sent,
        "packets_recv": io_counters.packets_recv,
        "errin": io_counters.errin,
        "errout": io_counters.errout,
        "dropin": io_counters.dropin,
        "dropout": io_counters.dropout
    }

def get_system_uptime():
    boot_time_timestamp = psutil.boot_time()
    current_time_timestamp = time.time()
    uptime_seconds = current_time_timestamp - boot_time_timestamp
    uptime_minutes = uptime_seconds // 60
    uptime_hours = uptime_minutes // 60
    uptime_days = uptime_hours // 24
    uptime_str = f"{int(uptime_days)}d {int(uptime_hours % 24)}h {int(uptime_minutes % 60)}m"
    return {"uptime": uptime_str}

def get_model_info():
    path = '/proc/device-tree/model'
    if os.path.exists(path):
        with open(path) as f:
            model = f.read()
            return {"version": model}
    return {"version": "unknown"}

def getSystemReports(socketio):
    while True:
        getSystemReportOnce(socketio)
        time.sleep(POLLING)

def getSystemReportOnce(socketio):
    data = {
        "release_info": get_release_info(),
        "kernel_info": get_kernel_info(),
        "memory_info": get_memory_info(),
        "cpu_info": get_cpu_info(),
        "disk_info": get_disk_info(),
        #"network_info": get_network_info(),
        # "process_info": get_process_info(),
        "system_uptime": get_system_uptime(),
        "load_average": get_load_average(),
        #"disk_io_counters": get_disk_io_counters(),
        #"net_io_counters": get_net_io_counters(),
        "model_info": get_model_info(),
    }
    socketio.emit('system', data)
    #print("System data published")

def process_status(process_name):
    for process in psutil.process_iter(['pid', 'name']):
        if process.info['name'] == process_name:
            return True
    return False

def runSystemUpdate(socketio):
    sudo = shutil.which("sudo")
    cmd = shutil.which("apt")
    if cmd and not process_status("apt"):
        ret = subprocess.run([sudo, cmd, "update"])
        if not ret.returncode:
            ret = subprocess.run([sudo, cmd, "upgrade", "-y"])
        status = ret.returncode
    else:
        status = 1

    if not status:
        data = {"update": True}
    else:
        data = {"update": False}

    socketio.emit('system', data)

def runSystemBackup(socketio):
    cmd = shutil.which("backup.sh")
    if cmd and not process_status("backup.sh"):
        ret = subprocess.run([cmd])
        status = ret.returncode
    else:
        status = 1

    if not status:
        data = {"backup": True}
    else:
        data = {"backup": False}

    socketio.emit('system', data)

def runSystemRestore(socketio):
    cmd = shutil.which("restore.sh")
    if cmd and not process_status("restore.sh"):
        ret = subprocess.run([cmd])
        status = ret.returncode
    else:
        status = 1

    if not status:
        data = {"restore": True}
    else:
        data = {"restore": False}

    socketio.emit('system', data)

def runSystemRestart(socketio):
    sudo = shutil.which("sudo")
    cmd = shutil.which("reboot")
    if cmd and not process_status("reboot"):
        ret = subprocess.run([sudo, cmd])
        status = ret.returncode
    else:
        status = 1

    if not status:
        data = {"restart": True}
    else:
        data = {"restart": False}

    socketio.emit('system', data)

def runSystemShutdown(socketio):
    sudo = shutil.which("sudo")
    cmd = shutil.which("poweroff")
    if cmd and not process_status("poweroff"):
        ret = subprocess.run([sudo, cmd])
        status = ret.returncode
    else:
        status = 1

    if not status:
        data = {"shutdown": True}
    else:
        data = {"shutdown": False}

    socketio.emit('system', data)

def getCA():
    url = "http://localhost:2019/pki/ca/local"
    try:
        response = requests.get(url)
        json = response.json()
    except:
        pass
    return json['root_certificate'].encode()
