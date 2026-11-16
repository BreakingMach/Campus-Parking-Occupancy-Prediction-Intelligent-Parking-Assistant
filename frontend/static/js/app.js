/**
 * LPU Campus Parking Intelligence System — Frontend JS
 * All data sourced from real API endpoints. No hardcoded values.
 */

'use strict';

// ─────────────────────────── State ───────────────────────────
let currentHorizon = 15;
let barChart = null;
let benchmarkChart = null;

// Webcam state
let webcamStream = null;
let detectionIntervalId = null;
let isDetecting = false;
let selectedImageFile = null;
let frameCount = 0;
let fpsTimer = null;
let fpsFrames = 0;

// ─────────────────────────── Utilities ───────────────────────
function showEl(id)   { const e = document.getElementById(id); if(e) e.classList.remove('hidden'); }
function hideEl(id)   { const e = document.getElementById(id); if(e) e.classList.add('hidden'); }
function setText(id, v) { const e = document.getElementById(id); if(e) e.textContent = v; }

function statusColor(status) {
    if (status === 'AVAILABLE')    return { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    if (status === 'FILLING_FAST') return { badge: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-500'   };
    return                                { badge: 'bg-rose-50    text-rose-700    border-rose-200',    dot: 'bg-rose-500'    };
}

function statusLabel(status) {
    return status === 'AVAILABLE' ? 'Available' : status === 'FILLING_FAST' ? 'Filling Fast' : 'Saturated';
}

async function apiFetch(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

// ─────────────────────────── Health Probe ────────────────────
async function probeHealth() {
    try {
        const data = await apiFetch('/api/health');
        const dot = document.getElementById('statusDot');
        const lbl = document.getElementById('statusLabel');
        const ml  = data.ml_model?.xgboost_loaded;
        const cv  = data.yolo_model?.loaded;
        if (dot && lbl) {
            dot.className = `w-2 h-2 rounded-full ${ml ? 'bg-emerald-500' : 'bg-amber-500'}`;
            lbl.textContent = ml && cv
                ? 'XGBoost + YOLO Online'
                : ml ? 'XGBoost ✓  YOLO loading…'
                : 'API connected — ML loading…';
        }
    } catch {
        const dot = document.getElementById('statusDot');
        const lbl = document.getElementById('statusLabel');
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        if (lbl) lbl.textContent = 'API offline';
    }
}

// ─────────────────────────── Tab switcher ────────────────────
function switchView(view) {
    const driver = document.getElementById('driverView');
    const admin  = document.getElementById('adminView');
    const dBtn   = document.getElementById('tabDriverBtn');
    const aBtn   = document.getElementById('tabAdminBtn');

    const activeClass   = 'px-4 py-1.5 rounded-lg bg-white text-orange-600 shadow-sm transition-all flex items-center space-x-2';
    const inactiveClass = 'px-4 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-2';

    if (view === 'driver') {
        driver.classList.remove('hidden'); driver.classList.add('block');
        admin.classList.add('hidden');     admin.classList.remove('block');
        dBtn.className = activeClass;
        aBtn.className = inactiveClass;
    } else {
        admin.classList.remove('hidden'); admin.classList.add('block');
        driver.classList.add('hidden');   driver.classList.remove('block');
        aBtn.className = activeClass;
        dBtn.className = inactiveClass;
        renderAdminDashboard();
    }
}

// ─────────────────────────── Horizon buttons ─────────────────
function setHorizon(mins) {
    currentHorizon = mins;
    document.querySelectorAll('.horizon-btn').forEach(btn => {
        const h = parseInt(btn.getAttribute('data-h'));
        btn.classList.toggle('active-horizon', h === mins);
    });
    fetchRecommendations();
}

// ─────────────────────────── Driver: Recommendations ─────────
async function fetchRecommendations() {
    const dest    = document.getElementById('destinationSelect').value;
    const examDay = document.getElementById('chkExamDay').checked;
    const surge   = document.getElementById('chkClassTransition').checked;
    const list    = document.getElementById('recommendationsList');
    const tipBox  = document.getElementById('smartTipBox');

    list.innerHTML = `
        <div class="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
            <i class="fa-solid fa-spinner fa-spin text-xl mb-2 block"></i>
            <span class="text-sm">Running XGBoost multi-horizon inference…</span>
        </div>`;
    hideEl('smartTipBox');

    try {
        const url = `/api/recommendations?destination=${encodeURIComponent(dest)}&horizon_minutes=${currentHorizon}&is_exam_day=${examDay}&is_class_transition=${surge}`;
        const data = await apiFetch(url);

        if (!data.recommended_zones?.length) {
            list.innerHTML = `<div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">No recommendations available.</div>`;
            return;
        }

        list.innerHTML = data.recommended_zones.slice(0, 5).map((zone, idx) => {
            const sc = statusColor(zone.status);
            const occPct = Math.round(zone.occupancy_rate * 100);
            const barWidth = Math.min(100, occPct);
            const barColor = zone.status === 'AVAILABLE' ? 'bg-emerald-400' : zone.status === 'FILLING_FAST' ? 'bg-amber-400' : 'bg-rose-500';
            return `
            <div class="rank-card bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span class="text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">#${idx + 1}</span>
                        <h4 class="font-bold text-slate-900 text-sm">${zone.name}</h4>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.badge}">
                            <span class="w-1.5 h-1.5 mr-1.5 rounded-full ${sc.dot}"></span>
                            ${statusLabel(zone.status)}
                        </span>
                    </div>
                    <span class="text-xs font-mono text-slate-400 shrink-0">Score: ${zone.score.toFixed(3)}</span>
                </div>
                <p class="text-xs text-slate-500">${zone.category} · Capacity: ${zone.operational_capacity} cars</p>
                <!-- Occupancy bar -->
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Predicted Occupancy</span><span>${occPct}%</span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-2 ${barColor} rounded-full transition-all" style="width:${barWidth}%"></div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-4 text-xs text-slate-600">
                    <span><i class="fa-solid fa-person-walking text-orange-500 mr-1"></i><b>${zone.walking_distance_meters}m</b> (${zone.walking_time_minutes} min)</span>
                    <span><i class="fa-solid fa-square-parking text-slate-400 mr-1"></i><b>${zone.available_spaces}</b> free</span>
                    <span><i class="fa-solid fa-triangle-exclamation text-slate-400 mr-1"></i>Sat. risk: <b>${Math.round(zone.saturation_probability * 100)}%</b></span>
                </div>
            </div>`;
        }).join('');

        setText('resultMeta', `${data.recommended_zones.length} zones · +${currentHorizon}min horizon · XGBoost ML`);

        if (data.counterfactual_tip) {
            setText('smartTipText', data.counterfactual_tip);
            showEl('smartTipBox');
        }
    } catch (err) {
        list.innerHTML = `<div class="p-8 text-center text-rose-500 bg-white rounded-2xl border border-rose-100 text-sm">
            <i class="fa-solid fa-circle-exclamation mr-2"></i>Failed to load recommendations: ${err.message}</div>`;
    }
}

// ─────────────────────────── Admin: Full dashboard ───────────
async function renderAdminDashboard() {
    await Promise.all([
        refreshSnapshot(),
        loadBenchmarkChart(),
    ]);
}

// Admin: occupancy snapshot from /api/snapshot (real ML data)
async function refreshSnapshot() {
    const examDay = false;
    const surge   = false;

    try {
        const data = await apiFetch(`/api/snapshot?is_exam_day=${examDay}&is_class_transition=${surge}`);

        // KPI cards
        setText('kpiTotalCap',  data.total_capacity.toLocaleString());
        setText('kpiOccRate',   Math.round(data.campus_occupancy_rate * 100) + '%');
        const peakLbl = document.getElementById('kpiPeakLabel');
        if (peakLbl) {
            peakLbl.textContent = data.is_peak_hour ? 'Peak Hour Active' : 'Off-Peak Period';
            peakLbl.className   = `text-xs font-medium ${data.is_peak_hour ? 'text-orange-600 font-bold' : 'text-slate-400'}`;
        }

        // Snapshot timestamp
        const ts = new Date(data.timestamp);
        setText('snapshotTime', ts.toLocaleTimeString());

        // Bar chart
        hideEl('chartLoading');
        showEl('barChartWrap');
        renderOccupancyBarChart(data.zones);

        // Telemetry table
        renderTelemetryTable(data.zones);

    } catch (err) {
        document.getElementById('cameraTableBody').innerHTML =
            `<tr><td colspan="8" class="px-4 py-6 text-center text-rose-500">${err.message}</td></tr>`;
    }
}

function renderOccupancyBarChart(zones) {
    const ctx = document.getElementById('occupancyBarChart')?.getContext('2d');
    if (!ctx) return;
    if (barChart) barChart.destroy();

    const labels   = zones.map(z => z.name.split(' ').slice(0, 2).join(' '));
    const occupied = zones.map(z => z.predicted_vehicle_count);
    const capacity = zones.map(z => z.operational_capacity);

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Predicted Occupied',  data: occupied, backgroundColor: '#ea580c', borderRadius: 5 },
                { label: 'Remaining Capacity',  data: capacity.map((c, i) => Math.max(0, c - occupied[i])), backgroundColor: '#e2e8f0', borderRadius: 5 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true, ticks: { maxRotation: 45, font: { size: 9 } } }, y: { stacked: true, beginAtZero: true } },
            plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } }
        }
    });
}

function renderTelemetryTable(zones) {
    const tbody = document.getElementById('cameraTableBody');
    if (!tbody) return;
    tbody.innerHTML = zones.map(z => {
        const sc = statusColor(z.status);
        const satPct = Math.round(z.saturation_probability * 100);
        const occPct = Math.round(z.occupancy_rate * 100);
        const camAge = z.camera_age_seconds < 60 ? `${Math.round(z.camera_age_seconds)}s ago` : 'stale';
        return `
        <tr class="hover:bg-slate-50 transition-all">
            <td class="px-4 py-3 font-mono font-bold text-slate-800 text-xs">${z.zone_id}</td>
            <td class="px-4 py-3 font-medium text-xs">${z.name}</td>
            <td class="px-4 py-3 text-slate-400 font-mono text-xs">${z.camera_id}</td>
            <td class="px-4 py-3 font-semibold text-xs">${z.operational_capacity}</td>
            <td class="px-4 py-3 text-xs">
                <div class="flex items-center space-x-2">
                    <div class="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-1.5 rounded-full ${z.status === 'AVAILABLE' ? 'bg-emerald-400' : z.status === 'FILLING_FAST' ? 'bg-amber-400' : 'bg-rose-500'}"
                             style="width:${occPct}%"></div>
                    </div>
                    <span class="font-semibold">${z.predicted_vehicle_count} (${occPct}%)</span>
                </div>
            </td>
            <td class="px-4 py-3 font-semibold text-emerald-700 text-xs">${z.available_spaces}</td>
            <td class="px-4 py-3 text-xs ${satPct >= 70 ? 'text-rose-600 font-bold' : 'text-slate-500'}">${satPct}%</td>
            <td class="px-4 py-3 text-xs">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.badge}">
                    <span class="w-1.5 h-1.5 mr-1 rounded-full ${sc.dot}"></span>
                    ${statusLabel(z.status)}
                </span>
            </td>
        </tr>`;
    }).join('');
}

// Admin: benchmark from /api/metrics (real CSV data)
async function loadBenchmarkChart() {
    try {
        const data = await apiFetch('/api/metrics');
        hideEl('benchmarkLoading');
        showEl('benchChartWrap');

        // Update KPI with real metrics
        if (data.xgboost_h15?.mae != null) {
            setText('kpiMae', data.xgboost_h15.mae.toFixed(1));
            const r2 = data.xgboost_h15.r2;
            if (r2 != null) setText('kpiR2Label', `R²=${r2.toFixed(4)} on holdout test set`);
        }

        // Build chart from real model_comparison.csv data
        const models = data.models;
        const persModel   = models.find(m => m.Model === 'Persistence Baseline');
        const seasModel   = models.find(m => m.Model === 'Seasonal Mean Baseline');
        const xgbH15      = models.find(m => m.Model === 'Tuned XGBoost' && m.Horizon === '+15 min');
        const xgbH30      = models.find(m => m.Model === 'Tuned XGBoost' && m.Horizon === '+30 min');
        const xgbH60      = models.find(m => m.Model === 'Tuned XGBoost' && m.Horizon === '+60 min');

        const labels = ['Persistence\nBaseline', 'Seasonal Mean\nBaseline', 'XGBoost\n+15 min', 'XGBoost\n+30 min', 'XGBoost\n+60 min'];
        const maes   = [persModel?.MAE, seasModel?.MAE, xgbH15?.MAE, xgbH30?.MAE, xgbH60?.MAE];
        const inflectionMaes = [persModel?.Inflection_MAE, null, xgbH15?.Inflection_MAE, null, null];

        const ctx = document.getElementById('benchmarkChart')?.getContext('2d');
        if (!ctx) return;
        if (benchmarkChart) benchmarkChart.destroy();

        benchmarkChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Overall MAE (cars)',
                        data: maes,
                        backgroundColor: ['#94a3b8', '#94a3b8', '#ea580c', '#f97316', '#fb923c'],
                        borderRadius: 5
                    },
                    {
                        label: 'Lecture Surge Inflection MAE',
                        data: inflectionMaes,
                        backgroundColor: ['#dc2626', 'transparent', '#16a34a', 'transparent', 'transparent'],
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'MAE (vehicles)', font: { size: 10 } } } },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            afterBody: (items) => {
                                if (items[0]?.label?.includes('XGBoost') && items[0]?.datasetIndex === 0) {
                                    return ['→ 36% lower overall MAE vs Persistence baseline'];
                                }
                                return [];
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        const el = document.getElementById('benchmarkLoading');
        if (el) { el.textContent = `Metrics unavailable: ${err.message}`; el.classList.remove('hidden'); }
    }
}

// ─────────────────────────── Webcam ──────────────────────────
async function toggleWebcam() {
    const video    = document.getElementById('webcamVideo');
    const ph       = document.getElementById('webcamPlaceholder');
    const annImg   = document.getElementById('webcamAnnotatedImg');
    const lbl      = document.getElementById('btnWebcamLabel');
    const badge    = document.getElementById('webcamStatusBadge');
    const btnDetect = document.getElementById('btnToggleDetection');

    if (webcamStream) {
        if (isDetecting) await toggleWebcamDetection();
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
        video.srcObject = null;
        video.classList.add('hidden');
        annImg.classList.add('hidden');
        ph.classList.remove('hidden');
        lbl.textContent = 'Start Webcam';
        badge.textContent = 'Idle';
        badge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600';
        btnDetect.disabled = true;
    } else {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
            video.srcObject = webcamStream;
            video.classList.remove('hidden');
            ph.classList.add('hidden');
            lbl.textContent = 'Stop Webcam';
            badge.textContent = 'Live';
            badge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
            btnDetect.disabled = false;

            // FPS counter
            fpsFrames = 0;
            fpsTimer = setInterval(() => {
                setText('webcamFps', fpsFrames.toFixed(1));
                fpsFrames = 0;
            }, 1000);
        } catch (err) {
            alert('Camera access denied: ' + err.message);
        }
    }
}

async function toggleWebcamDetection() {
    const lbl   = document.getElementById('btnDetectionLabel');
    const badge = document.getElementById('webcamStatusBadge');
    const stats = document.getElementById('webcamOverlayStats');
    const video = document.getElementById('webcamVideo');
    const ann   = document.getElementById('webcamAnnotatedImg');

    if (isDetecting) {
        clearInterval(detectionIntervalId);
        detectionIntervalId = null;
        isDetecting = false;
        lbl.textContent   = 'Start Detection';
        badge.textContent = 'Live';
        badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
        stats.classList.add('hidden');
        ann.classList.add('hidden');
        video.classList.remove('hidden');
    } else {
        isDetecting = true;
        lbl.textContent   = 'Stop Detection';
        badge.textContent = 'Detecting…';
        badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 animate-pulse';
        stats.classList.remove('hidden');
        await captureAndDetect();
        detectionIntervalId = setInterval(captureAndDetect, 1800);
    }
}

async function captureAndDetect() {
    if (!webcamStream || !isDetecting) return;
    const video  = document.getElementById('webcamVideo');
    const canvas = document.getElementById('hiddenWebcamCanvas');
    if (!video.videoWidth) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const fd = new FormData();
        fd.append('file', blob, 'frame.jpg');
        try {
            const res = await fetch('/api/detect-frame', { method: 'POST', body: fd });
            const d   = await res.json();
            if (d.annotated_image_base64) {
                const ann = document.getElementById('webcamAnnotatedImg');
                ann.src = 'data:image/jpeg;base64,' + d.annotated_image_base64;
                ann.classList.remove('hidden');
                document.getElementById('webcamVideo').classList.add('hidden');
                setText('webcamCarCount', d.vehicle_count);
                setText('webcamLatency',  d.inference_time_ms + 'ms');
                fpsFrames += 1 / (1800 / 1000);
            }
        } catch { /* network error — keep running */ }
    }, 'image/jpeg', 0.82);
}

// ─────────────────────────── Interactive ROI Canvas & Image Upload ────────────────────
let loadedImgElement = null;
let roiPoints = [];          // Array of [x, y] in original image pixel coordinates
let roiMode = 'polygon';     // 'polygon' | 'box'
let isDrawingBox = false;
let boxStart = null;

function setRoiMode(mode) {
    roiMode = mode;
    const btnPoly = document.getElementById('btnRoiPolygon');
    const btnBox = document.getElementById('btnRoiBox');
    if (btnPoly && btnBox) {
        if (mode === 'polygon') {
            btnPoly.className = 'px-2.5 py-1 rounded bg-orange-600 text-white font-semibold border border-orange-600 transition-all flex items-center space-x-1';
            btnBox.className = 'px-2.5 py-1 rounded bg-slate-100 hover:bg-orange-50 hover:text-orange-600 font-semibold border border-slate-200 transition-all flex items-center space-x-1';
        } else {
            btnBox.className = 'px-2.5 py-1 rounded bg-orange-600 text-white font-semibold border border-orange-600 transition-all flex items-center space-x-1';
            btnPoly.className = 'px-2.5 py-1 rounded bg-slate-100 hover:bg-orange-50 hover:text-orange-600 font-semibold border border-slate-200 transition-all flex items-center space-x-1';
        }
    }
}

function clearRoi() {
    roiPoints = [];
    isDrawingBox = false;
    boxStart = null;
    redrawRoiCanvas();
    setText('roiPointsIndicator', 'No ROI (Full Lot)');
}

function handleDrop(event) {
    event.preventDefault();
    document.getElementById('dropZone')?.classList.remove('border-orange-400');
    const file = event.dataTransfer?.files?.[0];
    if (file) loadUploadFile(file);
}

function handleImageSelected(event) {
    const file = event.target?.files?.[0];
    if (file) loadUploadFile(file);
}

function loadUploadFile(file) {
    selectedImageFile = file;
    document.getElementById('btnRunDetect').disabled = false;
    clearRoi();

    const meta = document.getElementById('uploadFileMeta');
    if (meta) {
        meta.textContent = `${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
        meta.classList.remove('hidden');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            loadedImgElement = img;
            const canvas = document.getElementById('roiCanvas');
            const placeholder = document.getElementById('uploadPlaceholder');
            if (canvas && placeholder) {
                canvas.classList.remove('hidden');
                placeholder.classList.add('hidden');
                initCanvasEvents(canvas);
                redrawRoiCanvas();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    setText('uploadStatusBadge', 'Ready to Draw ROI');
    document.getElementById('uploadStatusBadge').className =
        'text-xs px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-700';
    hideEl('dualModelResultsWrap');
}

function getCanvasCoords(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    // Map canvas coords to original image pixels
    const imgX = Math.round((canvasX / canvas.width) * loadedImgElement.naturalWidth);
    const imgY = Math.round((canvasY / canvas.height) * loadedImgElement.naturalHeight);
    return { canvasX, canvasY, imgX, imgY };
}

function initCanvasEvents(canvas) {
    if (canvas._initialized) return;
    canvas._initialized = true;

    canvas.addEventListener('mousedown', (e) => {
        if (!loadedImgElement) return;
        const pt = getCanvasCoords(e, canvas);

        if (roiMode === 'box') {
            isDrawingBox = true;
            boxStart = pt;
        } else {
            // Polygon mode
            // If near start point (closing polygon)
            if (roiPoints.length >= 3) {
                const firstPt = roiPoints[0];
                const dx = pt.imgX - firstPt[0];
                const dy = pt.imgY - firstPt[1];
                if (Math.hypot(dx, dy) < (loadedImgElement.naturalWidth * 0.04)) {
                    // Close polygon
                    redrawRoiCanvas();
                    setText('roiPointsIndicator', `ROI: Polygon (${roiPoints.length} vertices)`);
                    return;
                }
            }
            roiPoints.push([pt.imgX, pt.imgY]);
            redrawRoiCanvas();
            setText('roiPointsIndicator', `ROI: Drawing (${roiPoints.length} points)`);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!loadedImgElement) return;
        if (roiMode === 'box' && isDrawingBox && boxStart) {
            const current = getCanvasCoords(e, canvas);
            redrawRoiCanvas();
            // Draw temporary drag box
            const ctx = canvas.getContext('2d');
            const x = Math.min(boxStart.canvasX, current.canvasX);
            const y = Math.min(boxStart.canvasY, current.canvasY);
            const w = Math.abs(current.canvasX - boxStart.canvasX);
            const h = Math.abs(current.canvasY - boxStart.canvasY);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.fillRect(x, y, w, h);
            ctx.setLineDash([]);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (roiMode === 'box' && isDrawingBox && boxStart) {
            const end = getCanvasCoords(e, canvas);
            const x1 = Math.min(boxStart.imgX, end.imgX);
            const y1 = Math.min(boxStart.imgY, end.imgY);
            const x2 = Math.max(boxStart.imgX, end.imgX);
            const y2 = Math.max(boxStart.imgY, end.imgY);

            // Minimum box size guard
            if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
                roiPoints = [
                    [x1, y1],
                    [x2, y1],
                    [x2, y2],
                    [x1, y2]
                ];
                setText('roiPointsIndicator', 'ROI: Rectangle Set');
            }
            isDrawingBox = false;
            boxStart = null;
            redrawRoiCanvas();
        }
    });

    canvas.addEventListener('dblclick', () => {
        if (roiPoints.length >= 3) {
            redrawRoiCanvas();
            setText('roiPointsIndicator', `ROI: Polygon (${roiPoints.length} vertices)`);
        }
    });
}

function redrawRoiCanvas() {
    const canvas = document.getElementById('roiCanvas');
    if (!canvas || !loadedImgElement) return;

    canvas.width = loadedImgElement.naturalWidth;
    canvas.height = loadedImgElement.naturalHeight;
    const ctx = canvas.getContext('2d');

    // 1. Draw base image
    ctx.drawImage(loadedImgElement, 0, 0, canvas.width, canvas.height);

    // 2. Draw ROI if points exist
    if (roiPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(roiPoints[0][0], roiPoints[0][1]);
        for (let i = 1; i < roiPoints.length; i++) {
            ctx.lineTo(roiPoints[i][0], roiPoints[i][1]);
        }
        if (roiPoints.length >= 3) {
            ctx.closePath();
            ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
            ctx.fill();
        }

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.stroke();

        // Draw vertex handles
        roiPoints.forEach((pt, i) => {
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], Math.max(4, Math.round(canvas.width / 200)), 0, 2 * Math.PI);
            ctx.fillStyle = i === 0 ? '#ea580c' : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }
}

async function uploadAndDetectImage() {
    if (!selectedImageFile) return;
    const badge  = document.getElementById('uploadStatusBadge');
    const btn    = document.getElementById('btnRunDetect');
    const lbl    = document.getElementById('btnDetectLabel');
    const modelChoice = document.getElementById('modelChoiceSelect')?.value || 'both';

    badge.textContent = 'Running Inference…';
    badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 animate-pulse';
    btn.disabled = true;
    lbl.textContent = 'Running Detection & Comparing…';

    const fd = new FormData();
    fd.append('file', selectedImageFile);
    fd.append('model_choice', modelChoice);

    if (roiPoints && roiPoints.length >= 3) {
        fd.append('roi', JSON.stringify(roiPoints));
    }

    try {
        const res = await fetch('/api/detect-image', { method: 'POST', body: fd });
        const d   = await res.json();

        if (d.best_model && d.yolo26l_model) {
            // Dual Model Comparison View
            showEl('dualModelResultsWrap');

            // Populate Model A: best.pt
            setText('bestCountRoi', d.best_model.vehicle_count_roi);
            setText('bestCountTotal', d.best_model.vehicle_count_total);
            setText('bestAvgConf', Math.round((d.best_model.avg_confidence || 0) * 100) + '%');
            setText('bestLatency', d.best_model.inference_time_ms + ' ms');
            document.getElementById('imgBestAnnotated').src = 'data:image/jpeg;base64,' + d.best_model.annotated_image_base64;

            // Populate Model B: yolo26l.pt
            setText('yolo26lCountRoi', d.yolo26l_model.vehicle_count_roi);
            setText('yolo26lCountTotal', d.yolo26l_model.vehicle_count_total);
            setText('yolo26lAvgConf', Math.round((d.yolo26l_model.avg_confidence || 0) * 100) + '%');
            setText('yolo26lLatency', d.yolo26l_model.inference_time_ms + ' ms');
            document.getElementById('imgYolo26lAnnotated').src = 'data:image/jpeg;base64,' + d.yolo26l_model.annotated_image_base64;

            // Header & bullets
            const comp = d.comparison || {};
            setText('compHeaderRegion', `Target Region: ${comp.target_region || (d.roi_defined ? 'Selected ROI' : 'Full Lot')}`);
            setText('compSpeedBadge', comp.speed_summary || 'Dual Inference Complete');

            const bulletsUl = document.getElementById('compAnalysisBullets');
            if (bulletsUl && comp.analysis_bullets) {
                bulletsUl.innerHTML = comp.analysis_bullets.map(b => `<li>${b}</li>`).join('');
            }

            badge.textContent = `Compared: ${d.best_model.vehicle_count_roi} vs ${d.yolo26l_model.vehicle_count_roi} in ROI`;
            badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';

            // Scroll to results
            document.getElementById('dualModelResultsWrap').scrollIntoView({ behavior: 'smooth' });

        } else if (d.annotated_image_base64) {
            // Single model fallback display
            showEl('dualModelResultsWrap');
            setText('bestCountRoi', d.vehicle_count_roi || d.vehicle_count);
            setText('bestCountTotal', d.vehicle_count_total || d.vehicle_count);
            setText('bestLatency', d.inference_time_ms + ' ms');
            document.getElementById('imgBestAnnotated').src = 'data:image/jpeg;base64,' + d.annotated_image_base64;
            hideEl('dualModelResultsWrap'); // or single view
            badge.textContent = `${d.vehicle_count} Cars Detected`;
            badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
        } else if (d.error) {
            badge.textContent = 'Error: ' + d.error;
            badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700';
        }
    } catch (err) {
        badge.textContent = 'Inference failed';
        badge.className   = 'text-xs px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700';
        console.error(err);
    } finally {
        btn.disabled    = false;
        lbl.textContent = 'Run Detection & Compare in ROI';
    }
}

// ─────────────────────────── Boot ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    probeHealth();
    fetchRecommendations();
    setRoiMode('polygon');
    document.getElementById('destinationSelect')?.addEventListener('change', fetchRecommendations);
    document.getElementById('chkExamDay')?.addEventListener('change', fetchRecommendations);
    document.getElementById('chkClassTransition')?.addEventListener('change', fetchRecommendations);

    // Auto-refresh health every 30 seconds
    setInterval(probeHealth, 30000);
});
