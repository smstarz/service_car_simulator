@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ================================================================
REM Service Car Simulator - 초기 설정 스크립트
REM ================================================================

cd /d "%~dp0"

echo.
echo ====================================================
echo   Service Car Simulator 초기 설정
echo ====================================================
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo Node.js를 설치하려면 https://nodejs.org 를 방문하세요.
    echo.
    pause
    exit /b 1
)

echo [확인] Node.js 설치됨
node --version

echo.
echo [진행중] npm 의존성 설치...
call npm install

if errorlevel 1 (
    echo [오류] 의존성 설치에 실패했습니다.
    pause
    exit /b 1
)

echo.
echo [완료] 초기 설정이 완료되었습니다!
echo.
echo 다음 단계:
echo  1. run.bat 파일을 더블 클릭하여 앱을 시작합니다.
echo  2. 또는 run_simple.bat 파일을 실행하여 터미널에서 직접 실행할 수 있습니다.
echo.
pause
