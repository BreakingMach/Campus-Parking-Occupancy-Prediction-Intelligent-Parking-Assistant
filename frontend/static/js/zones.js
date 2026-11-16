'use strict';

async function loadZones() {
    try {
        const res = await fetch('/api/zones');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const zones = await res.json();
        renderZones(zones);
    } catch (err) {
        const grid = document.getElementById('zonesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="p-6 text-center text-rose-600 bg-rose-50 rounded-2xl border border-rose-200 col-span-full">
                    <p class="font-bold">Failed to load campus grounds</p>
                    <p class="text-xs text-rose-500 mt-1">${err.message}</p>
                </div>`;
        }
    }
}

function renderZones(zones) {
    const grid = document.getElementById('zonesGrid');
    if (!grid) return;

    if (zones.length === 0) {
        grid.innerHTML = '<div class="p-6 text-center text-slate-400 col-span-full">No grounds metadata found.</div>';
        return;
    }

    grid.innerHTML = zones.map(z => {
        const landmarks = (z.nearby_landmarks || []).slice(0, 4);
        const buffer = z.theoretical_capacity - z.operational_capacity;

        return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-orange-300 transition-all space-y-4">
            <div class="flex justify-between items-start">
                <div>
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-100 text-orange-800">${z.category}</span>
                    <h4 class="font-bold text-slate-900 text-base mt-1.5">${z.name}</h4>
                    <span class="text-xs font-mono text-slate-400">${z.zone_id}</span>
                </div>
                <span class="font-mono text-xs px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600 font-bold border border-slate-200">${z.camera_id || 'CAM-01'}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span class="text-slate-400 text-[10px] uppercase font-bold block">Operational Cap.</span>
                    <span class="text-slate-900 font-black text-lg">${z.operational_capacity} <span class="text-[10px] font-normal text-slate-400">Cars</span></span>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span class="text-slate-400 text-[10px] uppercase font-bold block">Physical Cap.</span>
                    <span class="text-slate-600 font-bold text-lg">${z.theoretical_capacity} <span class="text-[10px] font-normal text-slate-400">(-${buffer})</span></span>
                </div>
            </div>

            <div>
                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Adjacent Landmarks &amp; Hubs</span>
                <div class="flex flex-wrap gap-1.5">
                    ${landmarks.map(l => `<span class="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">${l}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', loadZones);
