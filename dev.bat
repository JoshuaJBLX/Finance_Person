@echo off
title Finance Person - Dashboard
cd /d "%~dp0"

if not exist node_modules (
  echo [Finance Person] Instalando dependencias...
  call npm.cmd install
  if errorlevel 1 goto :error
)

echo [Finance Person] Modo desarrollo
echo   Frontend:  http://localhost:5173
echo   API:       http://localhost:4000/api
echo.
call npm.cmd run dev
goto :eof

:error
echo.
echo [Finance Person] Ocurrio un error durante la instalacion.
pause