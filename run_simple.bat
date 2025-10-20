@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ================================================================
REM Service Car Simulator 실행 스크립트 (간단한 버전)
REM ================================================================

cd /d "%~dp0"
set PORT=5000

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 설치해주세요.
    pause
    exit /b 1
)

REM 의존성 자동 설치
if not exist "node_modules" (
    echo 의존성 설치 중...
    call npm install
)

REM 서버 시작
echo.
echo ====================================================
echo 서버 시작 중... (포트: %PORT%)
echo http://localhost:%PORT% 에서 접속 가능합니다.
echo.
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo ====================================================
echo.

npm start
