#!/bin/bash

## python
apt install -y \
python3 python3-pip python3-venv

## development
apt install -y \
cmake libgirepository-2.0-dev libdbus-1-dev

## indi
apt install -y \
libcfitsio-dev libnova-dev libindi-dev swig

## virtualgps
apt install -y \
gpsd gpsd-tools apparmor-utils

## yr_weather
sudo apt install -y \
libcairo2-dev gobject-introspection libgirepository1.0-dev
