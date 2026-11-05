@echo off
rem Windows launcher. The app scripts are bash scripts, so this runs them with Git Bash (installed with Git for Windows).
rem Usage: start.cmd         -> start the app    |    start.cmd stop   -> stop it
setlocal
set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%GITBASH%" set "GITBASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not exist "%GITBASH%" (
  echo Git Bash nao encontrado. Instale o Git for Windows: https://git-scm.com/download/win
  exit /b 1
)
cd /d "%~dp0"
if /i "%~1"=="stop" ("%GITBASH%" scripts/start-local.sh stop) else ("%GITBASH%" scripts/start-local.sh)
endlocal
