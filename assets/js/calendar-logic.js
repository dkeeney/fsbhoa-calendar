let config = {};
let allEvents = [];
let currentViewDate = new Date();
let grid, display;
let currentView = 'month'; // 'month' or 'agenda'
let iconLibrary = {};

document.addEventListener('DOMContentLoaded', function() {
    const app = document.getElementById('fsb-calendar-app');
    if (!app) return;

    // Calculate the min and max allowed dates
    const today = new Date();
    // We use parseInt to ensure "1" becomes 1, and window. prefix to make them globally accessible
    window.fsbMinTime = new Date(
        today.getFullYear(),
        today.getMonth() - parseInt(fsb_config.past_limit),
        1
    ).getTime();

    window.fsbMaxTime = new Date(
        today.getFullYear(),
        today.getMonth() + parseInt(fsb_config.future_limit),
        1
    ).getTime();

    grid = document.getElementById('calendar-grid');
    display = document.getElementById('currentMonthDisplay');

    config = {
        jsonUrl: app.dataset.jsonUrl,
        userEmail: app.dataset.userEmail,
        isAdmin: app.dataset.isAdmin === 'true'
    };

    const addBtn = document.getElementById('addNewEvent');
    if (addBtn) {
        addBtn.onclick = () => {
            // Just pass the current date string
            const dateStr = currentViewDate.toISOString().split('T')[0];
            openEditModal(dateStr);
        };
    }

    // Close buttons logic
    document.querySelectorAll('.close-modal').forEach(span => {
        span.onclick = function() {
            this.closest('.fsb-modal').style.display = 'none';
        }
    });

    // Month Navigation with Guardrails
    document.getElementById('prevMonth').onclick = () => {
        let testDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1).getTime();

        if (testDate >= window.fsbMinTime) {
            currentViewDate.setMonth(currentViewDate.getMonth() - 1);
            render();
        } else {
            console.log("Navigation blocked: Past limit reached.");
        }
    };

    document.getElementById('nextMonth').onclick = () => {
        let testDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1).getTime();

        if (testDate <= window.fsbMaxTime) {
            currentViewDate.setMonth(currentViewDate.getMonth() + 1);
            render();
        } else {
            console.log("Navigation blocked: Future limit reached.");
        }
    };

    // -- footer toolbar -- 
    // 1. Today Button Logic
    const todayBtn = document.getElementById('jumpToday');
    if (todayBtn) {
        todayBtn.onclick = () => {
            currentViewDate = new Date(); // Reset to now
            render();
        };
    }

    // 2. Fullscreen Logic
    const fsBtn = document.getElementById('toggleFullScreen');
    if (fsBtn) {
        fsBtn.onclick = () => {
            const app = document.getElementById('fsb-fullscreen-wrapper');
            if (!document.fullscreenElement) {
                app.requestFullscreen().catch(err => {
                    alert(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        };
    }
    document.addEventListener('fullscreenchange', () => {
        // Re-run render to snap the background and grid back into place
        render();
    });

    // Check screen width: if mobile, default to Agenda
    if (window.innerWidth < 768) {
        currentView = 'agenda';
        const selector = document.getElementById('viewSelector');
        if (selector) selector.value = 'agenda';
    }

    // 3. view selector
    const viewSelector = document.getElementById('viewSelector');
    if (viewSelector) {
        viewSelector.addEventListener('change', (e) => {
            currentView = e.target.value;
            renderCalendar(); // Re-draw based on new view
        });
    }
    // 4. magnifier
    const magnifierToggle = document.getElementById('toggle-magnifier');
    if (magnifierToggle) {
        magnifierToggle.addEventListener('change', function(e) {
            const grid = document.getElementById('calendar-grid');
            if (e.target.checked) {
                grid.classList.remove('magnifier-disabled');
            } else {
                grid.classList.add('magnifier-disabled');
            }
        });
    }


    const printBtn = document.getElementById('printCal');
    printBtn.onclick = () => {
        const year = currentViewDate.getFullYear();
        const monthPad = String(currentViewDate.getMonth() + 1).padStart(2, '0');
        const bgUrl = `${fsb_config.bg_base_url}cal-${year}-${monthPad}.png?v=${fsb_config.version}`;
        const gridHtml = document.getElementById('calendar-grid').innerHTML;

        const printWin = window.open('', '', 'width=1100,height=850');
        printWin.document.write(`
            <html>
            <head>
                <title>FSBHOA Calendar</title>
                <style>
                    @page {
                        size: 17in 11in; /* Explicitly set the HOA Newsletter size */
                        margin: 0;
                    }
                    body {
                        margin: 0; padding: 0;
                        width: 17in; height: 11in;
                        overflow: hidden;
                        position: relative;
                        /* FORCING COLORS AND IMAGES */
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    .print-bg {
                        position: absolute;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        z-index: 1;
                        /* Double insurance for the image */
                        -webkit-print-color-adjust: exact !important;
                    }
                    .calendar-grid {
                        display: grid;
                        grid-template-columns: repeat(7, 1fr);
                        grid-template-rows: repeat(5, 1fr);
                        position: absolute;
                        /* Lock this to your Canva boxes */
                        top: 14%; left: 0; width: 100%; height: 86%;
                        z-index: 2; /* Sits on top of the image */
                    }
                    .calendar-day { border: 0.5px solid rgba(0,0,0,0.1); }
                    /* Hide UI elements on paper */
                    .add-event-plus, .edit-pencil, .edit-pencil-mini, .nav-arrow, .calendar-footer-toolbar { 
                        display: none !important; 
                    }
                    .day-top {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        height: 18px !important; /* Tight lock for print */
                        padding: 0 4px !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }

                    .day-icons-corner {
                        display: flex !important;
                        flex-direction: row !important; /* Force side-by-side */
                        gap: 2px !important;
                        align-items: center !important;
                        white-space: nowrap !important; /* Prevent wrapping at all costs */
                    }

                    .corner-unit svg {
                        height: 16px !important; /* Slightly smaller for print precision */
                        width: auto !important;
                    }

                    .day-events {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 1px !important;
                    }

                    .event-item {
                        font-size: 9pt !important; 
                        line-height: 1.1 !important;
                        padding: 1px 2px !important;
                        margin-bottom: 1px !important;
                        white-space: normal !important; /* WRAPPING */
                        display: block !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .calendar-grid {
                        display: grid !important;
                        /* This forces the columns to stay exactly 1/7th wide regardless of text length */
                        grid-template-columns: repeat(7, 14.28%) !important; 
                        grid-template-rows: repeat(5, 1fr) !important;
                    }
                </style>
            </head>
            <body>
                <img src="${bgUrl}" class="print-bg">
                <div class="calendar-grid">${gridHtml}</div>
                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); window.close(); }, 700);
                    };
                </script>
            </body>
            </html>
        `);
        printWin.document.close();
    };


    loadData();
});

async function loadData() {
        try {
            const response = await fetch(config.jsonUrl);
            const data = await response.json();
            allEvents = data.events || [];
            iconLibrary = data.icons || {};
            render();
        } catch (e) {
            console.error("FSBHOA Calendar Error:", e);
            grid.innerHTML = '<div style="padding:20px; color:red;">Failed to load calendar data.</div>';
        }
}




function render() {
    grid = document.getElementById('calendar-grid');
    display = document.getElementById('currentMonthDisplay');

    if (!grid) {
        console.error("FSB Error: Calendar grid element missing from HTML.");
        return;
    }

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    window.currentYear = year;
    window.currentMonth = month;

    const prevMonthTime = new Date(year, month - 1, 1).getTime();
    const nextMonthTime = new Date(year, month + 1, 1).getTime();

    const isAtPrevLimit = prevMonthTime < window.fsbMinTime;
    const isAtNextLimit = nextMonthTime > window.fsbMaxTime;

    document.getElementById('prevMonth').style.opacity = isAtPrevLimit ? "0.3" : "1";
    document.getElementById('prevMonth').style.pointerEvents = isAtPrevLimit ? "none" : "auto";
    
    document.getElementById('nextMonth').style.opacity = isAtNextLimit ? "0.3" : "1";
    document.getElementById('nextMonth').style.pointerEvents = isAtNextLimit ? "none" : "auto";


    // Update text if element exists
    if (display) {
        display.innerText = new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric'
        }).format(currentViewDate);
    }

    // Try to update background
    try {
        updateBackground(year, month);
    } catch (e) {
        console.warn("Background update failed, check fsb_config paths.");
    }

    renderCalendar();
}


function renderCalendar() {
    const app = document.getElementById('fsb-calendar-app');
    const wrapper = document.getElementById('fsb-fullscreen-wrapper');
    const grid = document.getElementById('calendar-grid');
    const arrows = document.querySelectorAll('.nav-arrow');

    // 1. CLEAR THE CANVAS
    grid.innerHTML = '';
    window.scrollTo(0, 0); // Always snap to top on view change

    if (currentView === 'month') {
        // --- RESTORE GRID MODE ---
        grid.classList.remove('no-bg');

        // Restore the 17:11 logic
        app.style.height = '85vh';
        app.style.aspectRatio = '17 / 11';
        app.style.display = 'flex';
        app.style.flexDirection = 'column';
        app.style.justifyContent = 'flex-end';

        // Restore centered Stage
        if (wrapper) {
            wrapper.style.alignItems = 'center';
            wrapper.style.paddingTop = '0';
        }

        // Show Nav Arrows
        arrows.forEach(a => {
            a.style.display = 'flex';
            a.style.position = 'absolute'; // Switch back from 'fixed'
        });

        updateBackground(window.currentYear, window.currentMonth);
        renderMonthGrid();

    } else {
        // --- ACTIVATE AGENDA MODE ---
        grid.classList.add('no-bg');

        // Kill the 17:11 logic so it can scroll
        app.style.height = 'auto';
        app.style.aspectRatio = 'auto';
        app.style.backgroundImage = 'none';

        // Align Stage to top
        if (wrapper) {
            wrapper.style.alignItems = 'flex-start';
            wrapper.style.paddingTop = '20px';
        }

        // Hide or Fix Nav Arrows
        arrows.forEach(a => {
            // If you want them gone in Agenda:
            a.style.display = 'none';
            // OR if you want them fixed:
            // a.style.position = 'fixed';
        });

        renderAgendaView();
    }
}

function renderMonthGrid() {
    // This is essentially your previous render() logic,
    // but moved here so renderCalendar() can call it.
    const year = window.currentYear;
    const month = window.currentMonth;
    const todayStr = new Date().toISOString().split('T')[0];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding for start of month
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="calendar-day empty"></div>';
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = allEvents.filter(e => e.date === dateStr);
        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
        const isPast = dateStr < todayStr;
        const isEmpty = false; // Inside this loop, d is always 1-31, so it's NOT empty

        // Separate: Bars go in the middle, Icons go in the upper corner
        const barEvents = dayEvents.filter(e => !iconLibrary[e.category_id]);
        const utilityEvents = dayEvents.filter(e => iconLibrary[e.category_id]);

        // Build the Corner Icon HTML with Edit Support
        const cornerHtml = utilityEvents.map(e => {
            const canEdit = config.isAdmin || (e.owner_email === config.userEmail);
            return `
                <div class="corner-unit" title="${e.title}" style="position:relative; display:inline-flex; align-items:center; margin-left:2px;">
                    <svg viewBox="0 0 24 24" fill="${e.cat_color}" style="height:20px; width:auto; cursor:pointer;"
                         onclick="event.stopPropagation(); showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})">
                        <path d="${iconLibrary[e.category_id]}"></path>
                    </svg>
                    ${canEdit ? `
                        <span class="edit-pencil-mini"
                              style="cursor:pointer; font-size:10px; margin-left:-6px; margin-top:-10px; background:white; border:1px solid #ccc; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; box-shadow:1px 1px 2px rgba(0,0,0,0.2); z-index:5;"
                              onclick="event.stopPropagation(); handleEditClick(${e.id}, '${e.date}')">✎</span>
                    ` : ''}
                </div>
            `;
        }).join('');


        // Build the Event bars for the day
        grid.innerHTML += `
            <div class="calendar-day ${isPast ? 'past-day' : ''} ${isToday ? 'today' : ''}"
                 onclick="openDayModal('${dateStr}')">

                <div class="day-top">
                    <span class="day-number">${d}</span>

                    <div class="day-icons-corner">
                        ${cornerHtml}
                        ${(config.isAdmin && !isPast) ?
                            `<span class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateStr}')">+</span>`
                            : ''}
                    </div>
                </div>

                <div class="day-events">
                    ${renderEvents(barEvents)}
                </div>
            </div>
        `;
    }
}

function renderAgendaView() {
    const appContainer = document.getElementById('fsb-calendar-app');
    const grid = document.getElementById('calendar-grid');
    // 1. Force the containers to "Release" their fixed height
    if (appContainer) {
        appContainer.style.height = 'auto';
        appContainer.style.aspectRatio = 'auto';
        appContainer.style.overflow = 'visible';
    }

    const monthEvents = allEvents.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d.getMonth() === window.currentMonth && d.getFullYear() === window.currentYear;
    });


    if (monthEvents.length === 0) {
        grid.innerHTML = '<div class="no-events" style="padding:40px; text-align:center;">No events this month.</div>';
        return;
    }

    monthEvents.sort((a, b) => a.date.localeCompare(b.date));

    let html = '<div class="agenda-container">';
    let lastDate = '';

    monthEvents.forEach(event => {
        const dateObj = new Date(event.date + 'T00:00:00');
        const dateHeader = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        if (event.date !== lastDate) {
            html += `<div class="agenda-day-header">${dateHeader}</div>`;
            lastDate = event.date;
        }

        // Handle Time Preference Logic
        const timeStr = event.start_time ? event.start_time.toLowerCase().replace(':00', '').replace(' ', '') : '';
        let titleLine = '';

        if (fsb_config.time_position === 'prepend') {
            titleLine = `<span class="agenda-time">${timeStr}</span> ${event.title}`;
        } else {
            titleLine = `${event.title} <span class="agenda-time">${timeStr}</span>`;
        }

        html += `
            <div class="agenda-row" onclick="showEventDetail(${event.id})">
                <div class="agenda-main-line">${titleLine}</div>
                <div class="agenda-sub-line">📍 ${event.location || 'Lodge'}</div>
            </div>
        `;
    });

    html += '</div>';
    grid.innerHTML = html;
}




function openEditModal(selectedDate, eventId = null, fetchedData = null) {
    const modal = document.getElementById('fsb-edit-modal');
    const container = document.getElementById('edit-form-container');

    // Use fetchedData if we are editing, otherwise empty object for new events
    const eventData = fetchedData || { is_ticketed: false, rrule: ''};

    container.innerHTML = `
        <form id="fsb-edit-form">
            <h3>${eventId ? 'Edit Event' : 'New Event'}</h3>
            <input type="hidden" name="event_id" value="${eventId || ''}">
            <input type="hidden" name="date" value="${selectedDate}">
            <input type="hidden" id="edit_mode" name="edit_mode" value="single">

            <div class="form-group">
                <label>Event Title</label>
                <input type="text" name="title" value="${eventData.title || ''}" required>
            </div>

            <div class="time-row" style="display:flex; gap:10px;">
                <div style="flex:1">
                    <label>Start Time</label>
                    <input type="time" name="start_time" value="${eventData.start_time_raw || '09:00'}">
                </div>
                <div style="flex:1">
                    <label>End Time</label>
                    <input type="time" name="end_time" value="${eventData.end_time_raw || '10:00'}">
                </div>
            </div>

            <div class="form-group">
                <label>Location (Room)</label>
                <select name="location_id">
                    <option value="">-- Select Room --</option>
                    ${fsb_config.locations.map(loc =>
                        `<option value="${loc.id}" ${eventData.location_id == loc.id ? 'selected' : ''}>${loc.name}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Category</label>
                <select name="category_id">
                    ${fsb_config.categories.map(cat =>
                        `<option value="${cat.id}" ${eventData.category_id == cat.id ? 'selected' : ''}>${cat.name}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="form-group" style="margin-top:15px; padding:10px; background:#e3f2fd; border-radius:4px;">
                <strong>Privacy & Visibility:</strong><br>
                <label style="margin-right:10px;">
                    <input type="radio" name="visibility" value="public"
                        ${(!eventData.visibility || eventData.visibility === 'public') ? 'checked' : ''}>
                    Public (Everyone)
                </label>
                <label>
                    <input type="radio" name="visibility" value="resident" ${eventData.visibility === 'resident' ? 'checked' : ''}> 
                    Residents Only
                </label>
                <p style="font-size:10px; color:#666; margin:4px 0 0 0;">*Residents only events require a WordPress login to view.</p>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" name="is_ticketed" id="is_ticketed_check" value="true"
                           ${eventData.is_ticketed === true ? 'checked' : ''}
                           onchange="document.getElementById('cost_container').style.display = this.checked ? 'block' : 'none'">
                    Requires Tickets / Registration
                </label>
            </div>

            <div class="form-group" id="cost_container" style="display: ${eventData.is_ticketed === true ? 'block' : 'none'};">
                <label>Cost</label>
                <input type="text" name="cost" value="${eventData.cost || ''}" placeholder="$0.00">
            </div>

            <div class="form-group">
                <label>Flyer URL (Canva/Media Lib)</label>
                <input type="text" name="flyer_url" value="${eventData.flyer_url || ''}">
            </div>

            <hr>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="is_repeating" 
                           ${(eventData.rrule && eventData.rrule !== '') ? 'checked' : ''} 
                           onchange="toggleRRPanel()"> 
                    This is a Repeating Event
                </label>
            </div>

            <div id="rr-builder-panel" 
                style="display: ${(eventData.rrule && eventData.rrule !== '') ? 'block' : 'none'}; 
                    background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;">
                <div class="rr-row">
                    <strong>Days of Week:</strong><br>
                    ${['MO','TU','WE','TH','FR','SA','SU'].map(d =>
                        `<label style="margin-right:5px;"><input type="checkbox" class="rr-check rr-day" value="${d}" onchange="buildRRule()"> ${d}</label>`
                    ).join('')}
                </div>
                <div class="rr-row" style="margin-bottom:10px; font-size:13px;">
                    <strong>Frequency:</strong> Every
                    <input type="number" id="rr-interval" value="${eventData.rrule?.match(/INTERVAL=(\d+)/)?.[1] || '1'}"
                           min="1" max="52" style="width:45px; padding:2px;"
                           oninput="buildRRule()"> week(s) / month(s)
                </div>
                <div class="rr-row" style="margin-top:10px;">
                    <strong>Which Weeks?</strong><br>
                    ${['1','2','3','4','-1'].map(w =>
                        `<label style="margin-right:10px;"><input type="checkbox" class="rr-check rr-week" value="${w}" onchange="buildRRule()"> ${w=='-1'?'Last':w}</label>`
                    ).join('')}
                </div>
                <div class="rr-row" style="margin-top:10px;">
                    <strong>Specific Day of Month:</strong><br>
                    <select id="rr-bymonthday" class="rr-check" onchange="buildRRule()" style="margin-top:5px; padding:4px;">
                        <option value="">not selected</option>
                        ${Array.from({length: 31}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                        <option value="-1">Last Day</option>
                    </select>
                    <p style="font-size:10px; color:#666; margin:2px 0;">(Overrides "Which Weeks" if set)</p>
                </div>
                <div class="rr-row" style="margin-top:15px;">
                    <label>Manual RRULE (Overrides Builder):</label>
                    <input type="text" name="rrule" id="rrule_input" value="${eventData.rrule || ''}" style="width:100%; font-family:monospace; font-size:11px;">
                </div>
            </div>

            <div id="reschedule-panel" style="display:none; margin-top:15px; padding:15px; border:1px dashed #ed6c02; background:#fff8e1;">
                <strong>Reschedule:</strong> Move this specific instance to:<br>
                <input type="date" name="move_to_date" value="${selectedDate}" style="margin-top:5px;">
            </div>

            <div class="form-actions" style="margin-top:25px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="fsb-save-btn" onclick="saveEventChanges()" style="background:#0288d1; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer;">Save & Bake Calendar</button>

                ${eventId ? `
                    <button type="button" onclick="handleCancelBtn(${JSON.stringify(eventData).replace(/"/g, '&quot;')}, '${selectedDate}')" style="background:#ef5350; color:#fff; padding:10px; border:none; border-radius:4px; cursor:pointer;">Cancel Event</button>
                    <button type="button" onclick="handleRescheduleBtn()" style="background:#ffa726; color:#fff; padding:10px; border:none; border-radius:4px; cursor:pointer;">Reschedule</button>
                ` : ''}
            </div>
        </form>
    `;

    modal.style.display = 'block';

    // populate the Days and weeks checkboxes.
    if (eventData.rrule) {
        const rrule = eventData.rrule;

        // Parse Days (MO, TU, etc)
        const dayMatch = rrule.match(/BYDAY=([^;]+)/);
        if (dayMatch) {
            const days = dayMatch[1].split(',');
            document.querySelectorAll('.rr-day').forEach(cb => {
                if (days.includes(cb.value)) cb.checked = true;
            });
        }

        // Parse Weeks (BYSETPOS=1,2, etc)
        const weekMatch = rrule.match(/BYSETPOS=([^;]+)/);
        if (weekMatch) {
            const weeks = weekMatch[1].split(',');
            document.querySelectorAll('.rr-week').forEach(cb => {
                if (weeks.includes(cb.value)) cb.checked = true;
            });
        }

        // Parse Month Day (BYMONTHDAY=15, -1, etc)
        const monthDayMatch = rrule.match(/BYMONTHDAY=([^;]+)/);
        if (monthDayMatch) {
            document.getElementById('rr-bymonthday').value = monthDayMatch[1];
        }
    }
}



function updateRRulePreview() {
    const days = Array.from(document.querySelectorAll('.rr-day:checked')).map(cb => cb.value);
    const positions = Array.from(document.querySelectorAll('.rr-setpos:checked')).map(cb => cb.value);

    if (days.length === 0) return;

    let rrule = "FREQ=MONTHLY;";

    // If no specific week is picked, it's every week (Weekly)
    if (positions.length === 0) {
        rrule = `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
    } else {
        // Build the "2nd Monday" style: BYDAY=2MO, -1TH, etc.
        // Or using BYSETPOS for "1st and 3rd Monday"
        rrule += `BYDAY=${days.join(',')};BYSETPOS=${positions.join(',')}`;
    }

    document.getElementById('final_rrule').value = rrule;
}

function toggleRRPanel() {
    const panel = document.getElementById('rr-builder-panel');
    const isChecked = document.getElementById('is_repeating').checked;
    panel.style.display = isChecked ? 'block' : 'none';
    if (!isChecked) document.getElementById('rrule_input').value = '';
}

function buildRRule() {
    const days = Array.from(document.querySelectorAll('.rr-day:checked')).map(c => c.value);
    const weeks = Array.from(document.querySelectorAll('.rr-week:checked')).map(c => c.value);
    const monthDay = document.getElementById('rr-bymonthday').value;
    const intervalInput = document.getElementById('rr-interval');
    const interval = (intervalInput && intervalInput.value > 1) ? intervalInput.value : null;

    let rule = "FREQ=";

    if (monthDay !== "") {
        rule += `MONTHLY;BYMONTHDAY=${monthDay}`;
    } else if (days.length > 0) {
        if (weeks.length === 0) {
            rule += `WEEKLY;BYDAY=${days.join(',')}`;
        } else {
            rule += `MONTHLY;BYDAY=${days.join(',')};BYSETPOS=${weeks.join(',')}`;
        }
    }

    // Append Interval only if it's greater than 1
    if (rule !== "FREQ=" && interval) {
        rule += `;INTERVAL=${interval}`;
    }

    if (rule !== "FREQ=") {
        document.getElementById('rrule_input').value = rule;
    }
}


function handleRescheduleBtn() {
    const panel = document.getElementById('reschedule-panel');
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    document.getElementById('edit_mode').value = isHidden ? 'instance_move' : 'single';
}

function handleCancelBtn(event, dateStr) {
    if (!event) return;

    console.log("Checking RRule for Cancel:", event.rrule);

    // TIER 1: One-Shot Event (Simple Delete)
    if (!event.rrule) {
        if (confirm("Delete this one-time event?")) {
            saveEventChanges('master_cancel', event.id);
        }
        return;
    }

    // TIER 2: Series - Instance vs. Series
    if (confirm(`Cancel ONLY the session on ${dateStr}?`)) {
        // Option A: Punch a hole (Instance Cancel)
        saveEventChanges('instance_cancel', event.id, dateStr);
    } else if (confirm("Cancel all FUTURE sessions (End the series here)?")) {
        // Option B: End the series (Set UNTIL in RRule)
        saveEventChanges('series_end', event.id, dateStr);
    } else if (confirm("DELETE the entire series and all its history?")) {
        // Option C: Total Nuke
        saveEventChanges('master_delete', event.id);
    }
};



function openDayModal(dateStr) {
    const modal = document.getElementById('fsb-day-modal');
    const content = document.getElementById('fsb-modal-content');

    // Find the events for this date from our global array
    const events = allEvents.filter(e => e.date === dateStr);

    const dateObj = new Date(dateStr + 'T00:00:00');
    const title = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let html = `<h3>Events for ${title}</h3><hr>`;

    if (events.length === 0) {
        html += '<p>No events scheduled for this day.</p>';
    } else {
        html += '<ul class="modal-event-list" style="padding:0; list-style:none;">';
        events.forEach(e => {
            const canEdit = config.isAdmin || (e.owner_email === config.userEmail);
            html += `
                <li class="modal-event-card" style="border-bottom:1px solid #eee; padding:10px 0;">
                    <div style="font-weight:bold; font-size:1.1rem;">${e.title}</div>
                    <div style="color:#666; margin:5px 0;">📍 ${e.location || 'No location set'}</div>
                    <div class="modal-actions" style="margin-top:10px;">
                        ${e.flyer_url ? `<button onclick="window.open('${e.flyer_url}')">View Flyer</button>` : ''}
                        ${canEdit ? `<button class="edit-btn" onclick="handleEditClick(${e.id})">Edit Event</button>` : ''}
                    </div>
                </li>`;
        });
        html += '</ul>';
    }

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Helper to bridge the Modal to the Edit Form
async function handleEditClick(id, dateStr) {
    // 1. Visual feedback: maybe change the pencil color or cursor
    console.log("Fetching full details for event:", id);

    try {
        const response = await fetch(`${fsb_config.ajax_url}?action=fsb_get_event_details&event_id=${id}&nonce=${fsb_config.nonce}`);
        const result = await response.json();

        if (result.success) {
            // 2. Pass the freshly fetched data to the modal builder
            openEditModal(dateStr, id, result.data);
        } else {
            alert("Could not load event details: " + result.data);
        }
    } catch (e) {
        console.error("Fetch failed", e);
    }
}


async function saveEventChanges(overrideMode = null, overrideId = null, overrideDate = null) {
    const form = document.getElementById('fsb-edit-form');
    const formData = new FormData(form);

    // If we passed in a specific mode (like 'master_delete'), use it.
    // Otherwise, it defaults to what's in the hidden 'edit_mode' input.
    if (overrideMode) {
        formData.set('edit_mode', overrideMode);
    }
    if (overrideId) {
        formData.set('event_id', overrideId);
    }
    if (overrideDate) {
        formData.set('date', overrideDate);
    }

    // Add the WP Nonce for security
    formData.append('action', 'fsb_save_calendar_event');
    formData.append('nonce', fsb_config.nonce);

    // Visual feedback
    const saveBtn = form.querySelector('button');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = 'Saving & Baking...';
    saveBtn.disabled = true;

    try {
        const response = await fetch(fsb_config.ajax_url, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            alert('Event Saved!');
            location.reload(); // Simplest way to show the new JSON
        } else {
            alert('Error: ' + result.data);
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        }
    } catch (e) {
        console.error('Save failed', e);
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Helper to turn a list of events into HTML chips for the grid
 */
function renderEvents(events) {
    if (!events || events.length === 0) return '';

    return events.map(e => {
        // --- THE GATEKEEPER ---
        // If it's a resident event and we don't have a user email, don't render anything
        if (e.visibility === 'resident' && !config.userEmail) {
            return '';
        }
        const canEdit = config.isAdmin || (e.owner_email === config.userEmail);

        // Smart Time Logic (e.g., "9a" or "9:30p")
        let timeStr = '';
        if (e.start_time) {
            timeStr = e.start_time.toLowerCase().replace(':00', '').replace(' ', '');
        }

        let combinedTitle = '';
        const pos = fsb_config.time_position;

        if (pos === 'prepend') {
            combinedTitle = `<span style="font-weight:900;">${timeStr}</span> ${e.title}`;
        } else if (pos === 'append') {
            combinedTitle = `${e.title} <span style="font-weight:900;">${timeStr}</span>`;
        } else {
            combinedTitle = e.title;
        }
        // --- 2. PREPARE THE ACTION ---
        // If there's a flyer, we open it. Otherwise, we show the details.
        const clickAction = e.flyer_url
            ? `window.open('${e.flyer_url}', '_blank')`
            : `showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})`;

        return `
            <div class="event-item"
                 style="background-color: ${e.cat_color}; cursor: pointer;"
                 title="${e.flyer_url ? 'Click to open flyer' : 'Click for details'}"
                 onclick="event.stopPropagation(); ${clickAction}">
                ${combinedTitle}
                ${canEdit ? `<span class="edit-pencil" onclick="event.stopPropagation(); handleEditClick(${e.id}, '${e.date}')">✎</span>` : ''}
            </div>
        `;
    }).join('');
}

function showEventDetail(event) {
    const modal = document.getElementById('fsb-detail-modal');
    const content = document.getElementById('modal-content-area');

    // 1. Format the Date for the header
    const dateObj = new Date(event.date + 'T00:00:00');
    const fullDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    // 2. Conditional Price Logic
    // Only show if it's ticketed AND has a cost value
    const isTicketed = (event.is_ticketed === true || event.is_ticketed === 1);
    const showPrice = isTicketed && event.cost && event.cost.toLowerCase() !== 'free';
    const costHtml = showPrice ? `<p><strong>💰 Cost:</strong> ${event.cost}</p>` : '';

    // 3. Ticket button logic
    const ticketHtml = (isTicketed) ?
        `<div style="margin: 20px 0;"><p>Ticketed Event.  Get tickets at front desk.</p> ${costHtml} </div>`: '';

    content.innerHTML = `
        <div class="template-content" style="text-align:left; color:#333;">
            <h1 style="color:#000; font-size:1.8rem; margin-bottom:5px; border-bottom:2px solid ${event.cat_color || '#ccc'}; padding-bottom:10px;">
                ${event.title}
            </h1>

            <div class="event-meta" style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <p style="margin:5px 0;"><strong>📅 Date:</strong> ${fullDate}</p>
                <p style="margin:5px 0;"><strong>📍 Where:</strong> ${event.location || 'Lodge'}</p>
                <p style="margin:5px 0;"><strong>⏰ When:</strong> ${event.start_time} - ${event.end_time}</p>
                ${costHtml}
            </div>

            ${ticketHtml}

            <div class="event-description" style="line-height:1.6; font-size:1.1rem;">
                ${event.description || '<em>No description provided.</em>'}
            </div>

            ${event.setup_notes ? `
                <div class="setup-notes" style="margin-top:25px; padding-top:15px; border-top:1px dashed #ccc; font-style:italic; color:#666;">
                    <strong>Setup Notes:</strong><br>
                    ${event.setup_notes}
                </div>
            ` : ''}
        </div>
    `;
    modal.style.display = 'block';
}

// Add the missing close function
function closeDetailModal() {
    document.getElementById('fsb-detail-modal').style.display = 'none';
}



function updateBackground(year, month) {
    const appContainer = document.getElementById('fsb-calendar-app');
    if (!appContainer) return;

    // Standardize the filename: cal-2026-03.png
    const monthPad = String(month + 1).padStart(2, '0');
    const fileName = `cal-${year}-${monthPad}.png`;
    const bgUrl = `${fsb_config.bg_base_url}${fileName}?v=${fsb_config.version}`;

    // Apply the background
    appContainer.style.backgroundImage = `url('${bgUrl}')`;
    appContainer.style.backgroundSize = 'cover';
    appContainer.style.backgroundPosition = 'no-repeat';
}


/**
 * BRIDGING FUNCTIONS
 */

// This fixes the error you saw in the console
function openAddModal(dateStr) {
    console.log("Admin clicked [+] for date:", dateStr);
    // We reuse the existing openEditModal logic, 
    // passing null for the ID to trigger a "New Event" form
    openEditModal(dateStr, null, null);
}

// Ensure handleEditClick is available globally if needed by other modules
window.handleEditClick = handleEditClick;
window.openAddModal = openAddModal;


