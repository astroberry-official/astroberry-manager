cmake_minimum_required(VERSION 3.16)
PROJECT(astroberry-manager NONE)

set (VERSION_MAJOR 1)
set (VERSION_MINOR 0)

set(INSTALL_DIR "/opt")
set(CONFIG_INSTALL_DIR "/etc")
set(TMP_DIR "/tmp")

execute_process(COMMAND which python OUTPUT_VARIABLE PYTHON)
string(STRIP ${PYTHON} PYTHON)
message(STATUS "Python binary = ${PYTHON}")

message(STATUS "Creating python virtual environment")
execute_process(
  COMMAND ${PYTHON} -m venv .venv
  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  COMMAND_ERROR_IS_FATAL ANY
)

message(STATUS "Installing requirements")
execute_process(
  COMMAND ${CMAKE_CURRENT_BINARY_DIR}/.venv/bin/pip install -r ${CMAKE_CURRENT_SOURCE_DIR}/requirements.txt
  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  COMMAND_ERROR_IS_FATAL ANY
)

message(STATUS "Installing build module")
execute_process(
  COMMAND ${CMAKE_CURRENT_BINARY_DIR}/.venv/bin/pip install build
  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  COMMAND_ERROR_IS_FATAL ANY
)

message(STATUS "Building python package")
execute_process(
  COMMAND ${CMAKE_CURRENT_BINARY_DIR}/.venv/bin/python -m build --wheel --outdir ${CMAKE_CURRENT_BINARY_DIR}/dist ${CMAKE_CURRENT_SOURCE_DIR}
  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  COMMAND_ERROR_IS_FATAL ANY
)

if (${CMAKE_SYSTEM_NAME} MATCHES "Linux")
	install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/files/astroberry-manager.service DESTINATION ${CONFIG_INSTALL_DIR}/systemd/system)
	install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/files/indiwebmanager.service DESTINATION ${CONFIG_INSTALL_DIR}/systemd/system)
	install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/files/vncserver.service DESTINATION ${CONFIG_INSTALL_DIR}/systemd/system)
	install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/files/websockify.service DESTINATION ${CONFIG_INSTALL_DIR}/systemd/system)
	install(FILES ${CMAKE_CURRENT_BINARY_DIR}/dist/astroberry_manager-${VERSION_MAJOR}.${VERSION_MINOR}-py3-none-any.whl DESTINATION ${TMP_DIR})
endif()
