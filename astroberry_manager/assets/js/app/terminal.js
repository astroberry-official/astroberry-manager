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

import { socket } from "./sockets.js";
import { FitAddon } from "../xterm/xterm-addon-fit.js";
import { SearchAddon } from "../xterm/xterm-addon-search.js";
import { WebLinksAddon } from "../xterm/xterm-addon-web-links.js";

const logo = "\
               _             _                            \
     /\       | |           | |                           \
    /  \   ___| |_ _ __ ___ | |__   ___ _ __ _ __ _   _   \
   / /\ \ / __| __| '__/ _ \| '_ \ / _ \ '__| '__| | | |  \
  / ____ \\__ \ |_| | | (_) | |_) |  __/ |  | |  | |_| |  \
 /_/    \_\___/\__|_|  \___/|_.__/ \___|_|  |_|   \__, |  \
                                                   __/ |  \
                                                  |___/   ";


const term = new Terminal({
  fontSize: 12,
  cursorBlink: true,
  macOptionIsMeta: true,
  enableBold: true,
  cols: 120,
  rows: 42,
  screenKeys: true,
  scrollback: true,
});

const fit = new FitAddon();
const wait_ms = 50;
window.onresize = debounce(fitToscreen, wait_ms);

function requestTerminal() {
  term.attachCustomKeyEventHandler(customKeyEventHandler); // https://github.com/xtermjs/xterm.js/issues/2941
  term.open(document.getElementById("terminal"));
  fitToscreen();
  term.writeln("Welcome to Astroberry OS");
  term.writeln("https://astroberry.io/");
  term.writeln(" ");

  term.onData((data) => {
    //console.log("new input received from browser:", data);
    socket.timeout(5000).emit("pty-input", { input: data });
  });

  socket.on("pty-output", function (data) {
    //console.log("new output received from server:", data.output);
    term.write(data.output);
  });

  //$("#terminal-container").draggable();

  console.log("Terminal loaded");
}

function fitToscreen() {
  fit.fit();
  const dims = { cols: term.cols, rows: term.rows };
  socket.timeout(5000).emit("resize", dims);
}

function focusTerminal() {
  term.focus();
}

function debounce(func, wait_ms) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait_ms);
  };
}

function customKeyEventHandler(e) {
  if (e.type !== "keydown") {
    return true;
  }
  if (e.ctrlKey && e.shiftKey) {
    const key = e.key.toLowerCase();
    if (key === "v") {
      // ctrl+shift+v: paste whatever is in the clipboard
      navigator.clipboard.readText().then((toPaste) => {
        term.writeText(toPaste);
      });
      return false;
    } else if (key === "c" || key === "x") {
      const toCopy = term.getSelection();
      navigator.clipboard.writeText(toCopy);
      term.focus();
      return false;
    }
  }
  return true;
}

export { requestTerminal, focusTerminal }
