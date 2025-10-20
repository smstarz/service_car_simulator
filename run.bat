@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ================================================================
REM Service Car Simulator 실행 스크립트
REM ================================================================

echo.
echo ====================================================
echo    Service Car Simulator 실행 중...
echo ====================================================
echo.

REM 현재 디렉토리를 스크립트 위치로 변경
cd /d "%~dp0"

REM 포트 설정 (기본값: 5000)
set PORT=5000

REM Node.js 설치 여부 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo Node.js를 먼저 설치해주세요: https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM npm 설치 여부 확인
where npm >nul 2>nul
if errorlevel 1 (
    echo [오류] npm이 설치되어 있지 않습니다.
    pause
    exit /b 1
)

REM 의존성 설치 확인 및 설치
if not exist "node_modules" (
    echo [진행중] 의존성 설치 중...
    call npm install
    if errorlevel 1 (
        echo [오류] 의존성 설치에 실패했습니다.
        pause
        exit /b 1
    )
    echo [완료] 의존성 설치 완료
    echo.
)

REM 서버 시작
echo [정보] 서버를 포트 %PORT%에서 시작합니다...
echo [정보] 잠시 후 브라우저가 자동으로 열립니다.
echo.
echo 서버를 중지하려면 이 창을 닫으세요.
echo.

REM 새 터미널 창에서 서버 시작 (백그라운드)
start cmd /k "cd /d "%~dp0" & npm start"

REM 서버 시작 대기
timeout /t 3 /nobreak

REM 브라우저 자동 시작
echo [정보] http://localhost:%PORT% 로 접속 중...
start http://localhost:%PORT%

REM 스크립트 대기
timeout /t 120

echo.
echo [정보] 서버 실행을 계속하려면 아무 키나 누르세요...
pause
