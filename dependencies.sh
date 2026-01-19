#!/bin/sh

apt update && apt install -y \
python3 python3-pip python3-venv \
libcairo2-dev gobject-introspection swig \
libgirepository-2.0-dev libdbus-1-dev libindi-dev libcfitsio-dev libnova-dev
