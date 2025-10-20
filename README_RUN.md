Run instructions for Service Car Simulator

Usage:
1. Double-click or run `run_app.bat` from the project root.
   - The script will check for Node/npm, run `npm install --silent`, then start the server in a new console window.
   - It will poll http://localhost:5000 (or the port set with environment variable PORT) for up to 30 seconds and open your default browser when the server responds.

Troubleshooting:
- If Node/npm is not found, install Node.js from https://nodejs.org/.
- If the server does not respond within 30 seconds, open the console window titled "ServiceCarSimulator" to see server logs.
- To change the port, set the environment variable `PORT` before running the batch file (e.g., `set PORT=8000` then run the batch file).

Notes:
- The script assumes PowerShell is available for polling. This is available on modern Windows installations.
- For CI or headless environments, run `npm install` and `npm start` manually.
