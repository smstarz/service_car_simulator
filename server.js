const express = require('express');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const tmapRouteService = require('./services/tmapRouteService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));
// parse JSON bodies for API endpoints (allow larger CSV bodies)
app.use(express.json({ limit: '5mb' }));
// parse text bodies for CSV uploads
app.use(express.text({ limit: '5mb' }));

// Setup multer for file uploads (CSV files only, in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.get('/config', (req, res) => {
  const token = process.env.MAPBOX_TOKEN || '';
  res.json({ MAPBOX_TOKEN: token });
});

// Return list of project folders under ./projects
app.get('/projects', (req, res) => {
  const projectsDir = path.join(__dirname, 'projects');
  const fs = require('fs');
  fs.readdir(projectsDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('Failed to read projects dir', err);
      return res.json({ projects: [] });
    }
    const dirs = files.filter(f => f.isDirectory()).map(d => d.name);
    res.json({ projects: dirs });
  });
});

// Create a new project folder under ./projects
app.post('/projects', (req, res) => {
  const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ error: 'Missing project name' });
  // basic sanitize: allow letters, numbers, dash and underscore
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name. Use letters, numbers, - or _' });
  const projectsDir = path.join(__dirname, 'projects');
  const fs = require('fs');
  const target = path.join(projectsDir, name);
  fs.stat(target, (err, stats) => {
    if (!err && stats.isDirectory()) return res.status(409).json({ error: 'Project already exists' });
    fs.mkdir(target, { recursive: true }, (err) => {
      if (err) {
        console.error('Failed to create project', err);
        return res.status(500).json({ error: 'Failed to create project' });
      }
      // create default metadata file for the project
      const defaultMeta = {
        waitTimeLimit: 10,
        operatingTime: {
          start: '09:00',
          end: '18:00'
        }
      };
      const metaPath = path.join(target, 'project.json');
      fs.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2), 'utf8', (werr) => {
        if (werr) {
          console.error('Failed to write project metadata', werr);
          // still consider project created but warn client
          return res.status(201).json({ name, metaCreated: false });
        }
        return res.status(201).json({ name, metaCreated: true });
      });
    });
  });
});

// GET project metadata (project.json)
app.get('/projects/:name/meta', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const metaPath = path.join(__dirname, 'projects', name, 'project.json');
  const fs = require('fs');
  fs.stat(metaPath, (err, stats) => {
    if (err || !stats.isFile()) return res.status(404).json({ error: 'Metadata not found' });
    fs.readFile(metaPath, 'utf8', (rerr, data) => {
      if (rerr) return res.status(500).json({ error: 'Failed to read metadata' });
      try {
        const json = JSON.parse(data);
        return res.json(json);
      } catch (e) {
        return res.status(500).json({ error: 'Invalid metadata format' });
      }
    });
  });
});

// POST (save) project metadata
app.post('/projects/:name/meta', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const meta = req.body;
  if (!meta || typeof meta !== 'object') return res.status(400).json({ error: 'Missing metadata body' });
  const projectsDir = path.join(__dirname, 'projects');
  const targetDir = path.join(projectsDir, name);
  const fs = require('fs');
  fs.stat(targetDir, (err, stats) => {
    if (err || !stats.isDirectory()) return res.status(404).json({ error: 'Project not found' });
    const metaPath = path.join(targetDir, 'project.json');
    fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8', (werr) => {
      if (werr) {
        console.error('Failed to write project metadata', werr);
        return res.status(500).json({ error: 'Failed to save metadata' });
      }
      return res.status(201).json({ name, saved: true });
    });
  });
});

// GET demand CSV for a project
app.get('/projects/:name/demand', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).send('Invalid project name');
  const filePath = path.join(__dirname, 'projects', name, 'demand_data.csv');
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return res.status(404).send('Not found');
    res.sendFile(filePath);
  });
});

// POST demand CSV for a project (save or overwrite demand_data.csv)
// Supports two methods:
// 1. JSON body with { csv: "csv content" } - saves CSV text directly
// 2. FormData with file field - uploads and saves CSV file
app.post('/projects/:name/demand', upload.single('file'), (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  
  const projectsDir = path.join(__dirname, 'projects');
  const targetDir = path.join(projectsDir, name);
  const fs = require('fs');
  
  // Determine CSV content source
  let csvContent = null;
  
  // Priority 1: File upload (FormData)
  if (req.file) {
    csvContent = req.file.buffer.toString('utf8');
  }
  // Priority 2: JSON body with csv field
  else if (req.body && req.body.csv && typeof req.body.csv === 'string') {
    csvContent = req.body.csv;
  }
  
  if (!csvContent) {
    return res.status(400).json({ error: 'Missing csv content or file' });
  }
  
  // ensure project dir exists
  fs.stat(targetDir, (err, stats) => {
    if (err || !stats.isDirectory()) return res.status(404).json({ error: 'Project not found' });
    const filePath = path.join(targetDir, 'demand_data.csv');
    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + csvContent;
    fs.writeFile(filePath, contentWithBOM, 'utf8', (err) => {
      if (err) {
        console.error('Failed to write demand_data.csv', err);
        return res.status(500).json({ error: 'Failed to save csv' });
      }
      // Return success with saved file info
      return res.status(201).json({ 
        name, 
        saved: true,
        message: 'CSV file saved successfully'
      });
    });
  });
});

// Download demand CSV for a project as an attachment
app.get('/projects/:name/demand/download', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).send('Invalid project name');
  const filePath = path.join(__dirname, 'projects', name, 'demand_data.csv');
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return res.status(404).send('Not found');
    // name the downloaded file as <project>_demand_data.csv
    const downloadName = `${name}_demand_data.csv`;
    res.download(filePath, downloadName, (err) => {
      if (err) {
        console.error('Download error', err);
        if (!res.headersSent) res.status(500).send('Download failed');
      }
    });
  });
});

// GET simulation result JSON for a project
app.get('/projects/:name/simulation-result', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const filePath = path.join(__dirname, 'projects', name, 'simulation_result.json');
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return res.status(404).json({ error: 'Simulation result not found' });
    fs.readFile(filePath, 'utf8', (rerr, data) => {
      if (rerr) return res.status(500).json({ error: 'Failed to read simulation result' });
      try {
        const json = JSON.parse(data);
        return res.json(json);
      } catch (e) {
        return res.status(500).json({ error: 'Invalid simulation result format' });
      }
    });
  });
});

// CHECK if simulation result exists for a project
app.get('/projects/:name/simulation-result/exists', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const filePath = path.join(__dirname, 'projects', name, 'simulation_result.json');
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    const exists = !err && stats.isFile();
    res.json({ exists });
  });
});

// GET report HTML for a project
app.get('/projects/:name/report', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const filePath = path.join(__dirname, 'projects', name, 'simulation_report.html');
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return res.status(404).json({ error: 'Report not found' });
    fs.readFile(filePath, 'utf8', (rerr, data) => {
      if (rerr) return res.status(500).json({ error: 'Failed to read report' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(data);
    });
  });
});

// POST (save) report HTML for a project
app.post('/projects/:name/report', (req, res) => {
  const name = String(req.params.name || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'Invalid project name' });
  const html = req.body;
  if (!html || typeof html !== 'string') return res.status(400).json({ error: 'Missing HTML content' });
  
  const projectsDir = path.join(__dirname, 'projects');
  const targetDir = path.join(projectsDir, name);
  const fs = require('fs');
  fs.stat(targetDir, (err, stats) => {
    if (err || !stats.isDirectory()) return res.status(404).json({ error: 'Project not found' });
    const filePath = path.join(targetDir, 'simulation_report.html');
    fs.writeFile(filePath, html, 'utf8', (werr) => {
      if (werr) {
        console.error('Failed to write report HTML', werr);
        return res.status(500).json({ error: 'Failed to save report' });
      }
      return res.status(201).json({ name, saved: true });
    });
  });
});

// GET vehicles CSV for a project
app.get('/projects/:name/vehicles', (req, res) => {
  const name = String(req.params.name || '').trim();
  console.log('[GET /projects/:name/vehicles] name:', name);
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    console.log('[GET /projects/:name/vehicles] Invalid name');
    return res.status(400).send('Invalid project name');
  }
  
  const filePath = path.join(__dirname, 'projects', name, 'vehicle_set.csv');
  console.log('[GET /projects/:name/vehicles] filePath:', filePath);
  
  const fs = require('fs');
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      console.log('[GET /projects/:name/vehicles] File not found, returning default');
      // Return default vehicles if file not found
      const defaultVehicles = 'name,start_latitude,start_longitude,job_type\nVehicle_1,37.5665,126.9780,call\n';
      return res.send(defaultVehicles);
    }
    console.log('[GET /projects/:name/vehicles] File found, sending data');
    res.send(data);
  });
});

// POST vehicles CSV for a project
app.post('/projects/:name/vehicles', (req, res) => {
  const name = String(req.params.name || '').trim();
  console.log('[POST /projects/:name/vehicles] name:', name);
  console.log('[POST /projects/:name/vehicles] body type:', typeof req.body);
  console.log('[POST /projects/:name/vehicles] body length:', req.body ? req.body.length : 0);
  console.log('[POST /projects/:name/vehicles] body sample:', (req.body || '').substring(0, 100));
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    console.log('[POST /projects/:name/vehicles] Invalid name');
    return res.status(400).json({ error: 'Invalid project name' });
  }
  
  const csv = req.body;
  if (!csv || typeof csv !== 'string') {
    console.log('[POST /projects/:name/vehicles] Missing CSV content, csv:', csv);
    return res.status(400).json({ error: 'Missing CSV content' });
  }
  
  const filePath = path.join(__dirname, 'projects', name, 'vehicle_set.csv');
  console.log('[POST /projects/:name/vehicles] filePath:', filePath);
  
  const fs = require('fs');
  
  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csv;
  
  fs.writeFile(filePath, csvWithBOM, 'utf-8', (err) => {
    if (err) {
      console.error('[POST /projects/:name/vehicles] Write error:', err);
      return res.status(500).json({ error: 'Failed to save vehicles' });
    }
    console.log('[POST /projects/:name/vehicles] Successfully saved');
    res.json({ success: true, message: 'Vehicles saved' });
  });
});

// GET job types CSV for a project
app.get('/projects/:name/job-types', (req, res) => {
  const name = String(req.params.name || '').trim();
  console.log('[GET /projects/:name/job-types] name:', name);
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    console.log('[GET /projects/:name/job-types] Invalid name');
    return res.status(400).send('Invalid project name');
  }
  
  const filePath = path.join(__dirname, 'projects', name, 'job_type.csv');
  console.log('[GET /projects/:name/job-types] filePath:', filePath);
  
  const fs = require('fs');
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      console.log('[GET /projects/:name/job-types] File not found, returning default');
      // Return default job types if file not found
      const defaultJobTypes = 'id,job,service_time\n0001,call,15\n';
      return res.send(defaultJobTypes);
    }
    console.log('[GET /projects/:name/job-types] File found, sending data');
    res.send(data);
  });
});

// POST job types CSV for a project
app.post('/projects/:name/job-types', (req, res) => {
  const name = String(req.params.name || '').trim();
  console.log('[POST /projects/:name/job-types] name:', name);
  console.log('[POST /projects/:name/job-types] body type:', typeof req.body);
  console.log('[POST /projects/:name/job-types] body length:', req.body ? req.body.length : 0);
  console.log('[POST /projects/:name/job-types] body sample:', (req.body || '').substring(0, 100));
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    console.log('[POST /projects/:name/job-types] Invalid name');
    return res.status(400).json({ error: 'Invalid project name' });
  }
  
  const csv = req.body;
  if (!csv || typeof csv !== 'string') {
    console.log('[POST /projects/:name/job-types] Missing CSV content, csv:', csv);
    return res.status(400).json({ error: 'Missing CSV content' });
  }
  
  const filePath = path.join(__dirname, 'projects', name, 'job_type.csv');
  console.log('[POST /projects/:name/job-types] filePath:', filePath);
  
  const fs = require('fs');
  
  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csv;
  
  fs.writeFile(filePath, csvWithBOM, 'utf-8', (err) => {
    if (err) {
      console.error('[POST /projects/:name/job-types] Write error:', err);
      return res.status(500).json({ error: 'Failed to save job types' });
    }
    console.log('[POST /projects/:name/job-types] Successfully saved');
    res.json({ success: true, message: 'Job types saved' });
  });
});
app.get('/download/form', (req, res) => {
  const filePath = path.join(__dirname, 'demand_table_form.csv');
  res.download(filePath, 'demand_table_form.csv', (err) => {
    if (err) {
      console.error('Download error', err);
      if (!res.headersSent) res.status(404).send('File not found');
    }
  });
});

// ===== TMAP Route API =====

/**
 * POST /api/route
 * 단일 경로 탐색
 * Body: { startPoint: [lng, lat], endPoint: [lng, lat], departureTime: "HH:MM:SS" }
 */
app.post('/api/route', async (req, res) => {
  try {
    const { startPoint, endPoint, departureTime } = req.body;

    if (!startPoint || !endPoint) {
      return res.status(400).json({ 
        error: 'Missing required parameters: startPoint and endPoint are required' 
      });
    }

    console.log('🚗 Route request:', { startPoint, endPoint, departureTime });

    const routeData = await tmapRouteService.getCarRoute({
      startPoint,
      endPoint,
      departureTime
    });

    res.json({
      success: true,
      data: routeData
    });

  } catch (error) {
    console.error('❌ Route API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/route/batch
 * 다중 경로 탐색 (배치 처리)
 * Body: { routes: [{ startPoint, endPoint, departureTime, vehicleId }, ...] }
 */
app.post('/api/route/batch', async (req, res) => {
  try {
    const { routes } = req.body;

    if (!routes || !Array.isArray(routes)) {
      return res.status(400).json({ 
        error: 'Missing required parameter: routes must be an array' 
      });
    }

    console.log(`🚗 Batch route request: ${routes.length} routes`);

    const routeDataList = await tmapRouteService.getMultipleRoutes(routes);

    res.json({
      success: true,
      count: routeDataList.length,
      data: routeDataList
    });

  } catch (error) {
    console.error('❌ Batch route API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/route/events
 * 경로를 timestamp 이벤트로 변환
 * Body: { startPoint, endPoint, departureTime, startTimestamp }
 */
app.post('/api/route/events', async (req, res) => {
  try {
    const { startPoint, endPoint, departureTime, startTimestamp } = req.body;

    if (!startPoint || !endPoint || startTimestamp === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: startPoint, endPoint, and startTimestamp are required' 
      });
    }

    console.log('📅 Route events request:', { startPoint, endPoint, departureTime, startTimestamp });

    // 경로 탐색
    const routeData = await tmapRouteService.getCarRoute({
      startPoint,
      endPoint,
      departureTime
    });

    // timestamp 이벤트 생성
    const events = tmapRouteService.generateTimestampEvents(routeData, startTimestamp);

    res.json({
      success: true,
      data: {
        route: routeData,
        events: events
      }
    });

  } catch (error) {
    console.error('❌ Route events API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/route/test
 * TMAP API 연결 테스트
 */
app.get('/api/route/test', (req, res) => {
  const apiKey = process.env.TMAP_API_KEY;
  
  if (!apiKey) {
    return res.json({
      configured: false,
      message: 'TMAP_API_KEY is not set in environment variables'
    });
  }

  res.json({
    configured: true,
    message: 'TMAP API is configured',
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey.substring(0, 8) + '...'
  });
});

// ============================================
// Simulation Engine API
// ============================================

const SimulationEngine = require('./services/simulationEngine');

// Store active simulations for cancellation
const activeSimulations = new Map(); // sessionId -> { engine, cancelled }

/**
 * Run simulation for a project with SSE progress updates
 * GET /api/simulation/run/:projectName (SSE endpoint)
 */
app.get('/api/simulation/run/:projectName', async (req, res) => {
  const projectName = String(req.params.projectName || '').trim();
  
  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid project name' 
    });
  }
  
  const projectPath = path.join(__dirname, 'projects', projectName);
  const fs = require('fs');
  
  // Check if project exists
  try {
    const stats = await fs.promises.stat(projectPath);
    if (!stats.isDirectory()) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
  } catch (err) {
    return res.status(404).json({ 
      success: false, 
      error: 'Project not found' 
    });
  }
  
  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Generate session ID
  const sessionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Send initial message
  res.write(`data: ${JSON.stringify({ type: 'started', sessionId, projectName })}\n\n`);
  
  console.log(`\n🚀 Starting simulation for project: ${projectName} (session: ${sessionId})`);
  
  // Progress callback
  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
  };
  
  const checkCancelled = () => {
    const session = activeSimulations.get(sessionId);
    return session && session.cancelled;
  };
  
  try {
    // Create simulation engine
    const engine = new SimulationEngine(projectPath);
    
    // Register session
    activeSimulations.set(sessionId, { engine, cancelled: false });
    
    // Initialize
    sendProgress({ status: 'initializing', message: 'Initializing simulation...' });
    await engine.initialize();
    
    if (checkCancelled()) {
      res.write(`data: ${JSON.stringify({ type: 'cancelled', message: 'Simulation cancelled by user' })}\n\n`);
      res.end();
      activeSimulations.delete(sessionId);
      return;
    }
    
    // Run simulation with progress callback
    sendProgress({ status: 'running', message: 'Running simulation...' });
    await engine.run(sendProgress, checkCancelled);
    
    if (checkCancelled()) {
      res.write(`data: ${JSON.stringify({ type: 'cancelled', message: 'Simulation cancelled by user' })}\n\n`);
      res.end();
      activeSimulations.delete(sessionId);
      return;
    }
    
    // Generate result JSON
    sendProgress({ status: 'generating', message: 'Generating result file...' });
    const result = await engine.generateResultJSON();
    
    // Delete existing report file if it exists
    const reportPath = path.join(projectPath, 'simulation_report.html');
    console.log(`📍 Attempting to delete report at: ${reportPath}`);
    try {
      const fileExists = fs.existsSync(reportPath);
      console.log(`📍 File exists check: ${fileExists}`);
      
      if (fileExists) {
        await fs.promises.unlink(reportPath);
        console.log(`🗑️  Successfully deleted old report file: ${reportPath}`);
      } else {
        console.log(`ℹ️  Report file does not exist (first run): ${reportPath}`);
      }
    } catch (err) {
      console.error(`❌ Error deleting report file: ${err.message}`);
      console.error(`Error code: ${err.code}, Stack: ${err.stack}`);
    }
    
    console.log(`✅ Simulation completed for project: ${projectName}\n`);
    
    // Send completion
    res.write(`data: ${JSON.stringify({
      type: 'completed',
      success: true,
      projectName: projectName,
      resultFile: `projects/${projectName}/simulation_result.json`,
      summary: {
        duration: result.metadata.totalDurationSeconds,
        vehicles: result.metadata.vehicleCount,
        demands: result.metadata.demandCount,
        completed: result.metadata.completedDemands,
        rejected: result.metadata.rejectedDemands,
        completionRate: (result.metadata.completedDemands / result.metadata.demandCount * 100).toFixed(1) + '%',
        utilization: (result.metadata.vehicleUtilizationRate * 100).toFixed(1) + '%'
      }
    })}\n\n`);
    
    res.end();
    activeSimulations.delete(sessionId);
    
  } catch (error) {
    console.error(`❌ Simulation failed for project: ${projectName}`);
    console.error(error);
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })}\n\n`);
    
    res.end();
    activeSimulations.delete(sessionId);
  }
});

/**
 * Cancel running simulation
 * POST /api/simulation/cancel/:sessionId
 */
app.post('/api/simulation/cancel/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = activeSimulations.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Simulation session not found'
    });
  }
  
  session.cancelled = true;
  console.log(`⏹️  Cancelling simulation session: ${sessionId}`);
  
  res.json({
    success: true,
    message: 'Cancellation requested'
  });
});

/**
 * Get simulation result for a project
 * GET /api/simulation/result/:projectName
 */
app.get('/api/simulation/result/:projectName', async (req, res) => {
  const projectName = String(req.params.projectName || '').trim();
  
  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid project name' 
    });
  }
  
  const resultPath = path.join(__dirname, 'projects', projectName, 'simulation_result.json');
  const fs = require('fs');
  
  try {
    const data = await fs.promises.readFile(resultPath, 'utf8');
    const result = JSON.parse(data);
    res.json(result);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ 
        success: false, 
        error: 'Simulation result not found. Run simulation first.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to read simulation result' 
    });
  }
});

/**
 * Check if simulation result exists
 * GET /api/simulation/status/:projectName
 */
app.get('/api/simulation/status/:projectName', async (req, res) => {
  const projectName = String(req.params.projectName || '').trim();
  
  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid project name' 
    });
  }
  
  const resultPath = path.join(__dirname, 'projects', projectName, 'simulation_result.json');
  const fs = require('fs');
  
  try {
    const stats = await fs.promises.stat(resultPath);
    const data = await fs.promises.readFile(resultPath, 'utf8');
    const result = JSON.parse(data);
    
    res.json({
      exists: true,
      fileSize: stats.size,
      lastModified: stats.mtime,
      metadata: result.metadata
    });
  } catch (err) {
    res.json({
      exists: false
    });
  }
});

app.listen(process.env.PORT || 8080, '0.0.0.0', () => {
  console.log('Server running on port', process.env.PORT || 8080);

// app.listen(PORT, () => {
//   console.log(`Server listening on http://localhost:${PORT}`);
});
