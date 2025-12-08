@echo off
cls
echo ========================================
echo   RESTARTING AGROKUCHING SERVER
echo ========================================
echo.
echo [1/3] Stopping any running Python processes...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo [2/3] Starting Flask server with SocketIO...
echo.
echo ========================================
echo   SERVER STARTING...
echo ========================================
echo.
echo Look for these messages:
echo   - Database initialized.
echo   - Running on http://0.0.0.0:5000
echo.
echo Then open: http://localhost:5000/HTML code/messages.html
echo.
echo ========================================
echo.
python app.py
pause
