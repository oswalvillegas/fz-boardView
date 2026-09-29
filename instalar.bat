@echo off
setlocal
cd /d "%~dp0"
title FZ BoardView - Instalar

echo ============================================================
echo    FZ BoardView - Instalacion
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

echo [OK] Node.js encontrado:
node -v
call npm -v
echo.

if not exist "package.json" goto :nopackage

if exist "node_modules" goto :have_modules

echo Instalando dependencias con npm install...
echo (puede tardar varios minutos la primera vez)
echo.
call npm install
if errorlevel 1 goto :fail

goto :done

:have_modules
echo [AVISO] Ya existe la carpeta node_modules.
echo Se ejecutara npm install igualmente para actualizarla.
echo.
call npm install
if errorlevel 1 goto :fail

:done
echo.
echo ============================================================
echo    Instalacion completada
echo ============================================================
echo.
echo Ahora ejecuta  ejecutar.bat  para abrir el programa.
echo Si quieres modificarlo, los archivos estan aqui:
echo %cd%
echo.
pause
exit /b 0

:nonode
echo [ERROR] Node.js no esta instalado o no esta en el PATH.
echo.
echo Descargalo desde: https://nodejs.org  (version LTS)
echo Luego cierra esta ventana y ejecuta otra vez instalar.bat
echo.
pause
exit /b 1

:nopackage
echo [ERROR] No se encontro package.json en:
echo %cd%
echo Coloca instalar.bat dentro de la carpeta del proyecto.
echo.
pause
exit /b 1

:fail
echo.
echo [ERROR] La instalacion fallo.
echo Revisa tu conexion a internet o la configuracion de proxy
echo e intenta de nuevo.
echo.
pause
exit /b 1