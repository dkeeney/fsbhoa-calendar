let config = {};
let allEvents = [];
let draggedData = null; // Global Drag State

// --- DATE DETECTION LOGIC --- (the month to show at start if not today)
const urlParams = new URLSearchParams(window.location.search);
const urlDateStr = urlParams.get('viewDate');
window.currentViewDate = urlDateStr ? new Date(urlDateStr + 'T00:00:00') : new Date();
// Scrub the URL immediately so a manual "F5" refresh
// doesn't keep the user trapped in that month forever.
if (urlDateStr) {
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}
// --------------------------------

let currentView = 'month'; // 'month' or 'agenda'

let iconLibrary = {
    // State 1: Standard Blue Line
    "split-blue": `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
             <line x1="0" y1="100" x2="100" y2="0" stroke="#0288d1" stroke-width="1.5" />
           </svg>`,

    // State 2: Gray Line (for when both days are past)
    "split-gray": `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
             <line x1="0" y1="100" x2="100" y2="0" stroke="#cccccc" stroke-width="1.5" />
           </svg>`,

    // State 3: Blue Line with Grayed Triangle (Top Day is past, Bottom Day is future)
    "split-mixed": `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
              <polygon points="0,0 100,0 0,100" fill="rgba(0,0,0,0.05)" />
              <line x1="0" y1="100" x2="100" y2="0" stroke="#0288d1" stroke-width="1.5" />
            </svg>`
};

document.addEventListener('DOMContentLoaded', function() {
    const monthlyApp = document.getElementById('fsb-calendar-app');
    const agendaApp = document.getElementById('fsb-agenda-app');

    // 1. EXIT if nothing is found
    if (!monthlyApp && !agendaApp) return;

    // 2. DETERMINE VIEW & CAPABILITY
    if (monthlyApp && agendaApp) {
        // BOTH ARE HERE: Enable switching and auto-detect width
        window.isHybridPage = true;
        if (!window.hasManuallyToggled) {
            currentView = (window.innerWidth < 768) ? 'agenda' : 'month';
        }
    } else {
        // ONLY ONE IS HERE: Lock the view to what's available
        window.isHybridPage = false;
        currentView = monthlyApp ? 'month' : 'agenda';

        // Hide the view selector since they can't switch
        const selectors = document.querySelectorAll('#viewSelector, #viewSelectorAgenda');
        selectors.forEach(s => s.style.display = 'none');
    }
    grid = document.getElementById('calendar-grid');
    agendaContainer = document.getElementById('agenda-view');
    display = document.getElementById('currentMonthDisplay');

    const activeApp = monthlyApp || agendaApp;
    config = {
        jsonUrl: activeApp.dataset.jsonUrl,
        userEmail: activeApp.dataset.userEmail,
        isAdmin: activeApp.dataset.isAdmin === 'true'
    };

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



    const addBtn = document.getElementById('addNewEvent');
    if (addBtn) {
        addBtn.onclick = () => {
            // Just pass the current date string
            const dateStr = currentViewDate.toISOString().split('T')[0];
            openEditModal(dateStr);
        };
    }


    // Close buttons logic
    document.querySelectorAll('.close-modal, .modal-close').forEach(btn => {
        btn.onclick = function() {
            // This finds the closest parent container that is a modal and hides it
            const modal = this.closest('.fsb-modal, .fsb-full-modal');
            if (modal) {
                modal.classList.remove('is-visible');
                document.body.classList.remove('modal-open');
            }
        }
    });

    // Month Navigation with Guardrails
    // Select ALL previous and next buttons at once
    const prevBtns = document.querySelectorAll('#prevMonth');
    const nextBtns = document.querySelectorAll('#nextMonth');

    // Attach logic to every 'Prev' button found
    prevBtns.forEach(btn => {
        btn.onclick = () => {
            let testDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1).getTime();
            if (testDate >= window.fsbMinTime) {
                currentViewDate.setMonth(currentViewDate.getMonth() - 1);
                render();
            } else {
                console.log("Navigation blocked: Past limit reached.");
            }
        };
    });

    // Attach logic to every 'Next' button found
    nextBtns.forEach(btn => {
        btn.onclick = () => {
            let testDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1).getTime();
            if (testDate <= window.fsbMaxTime) {
                currentViewDate.setMonth(currentViewDate.getMonth() + 1);
                render();
            } else {
                console.log("Navigation blocked: Future limit reached.");
            }
        };
    });

    // -- footer toolbar -- 
    // 1. Today Button Logic
    const todayBtns = document.querySelectorAll('#jumpToday, #jumpTodayAgenda');
    todayBtns.forEach(btn => {
        btn.onclick = () => {
            currentViewDate = new Date();
            render();
        };
    });

    // 2. Fullscreen Logic
    const fsBtn = document.getElementById('toggleFullScreen');
    if (fsBtn) {
        fsBtn.onclick = () => {
            const app = document.getElementById('fsb-monthly-wrapper');
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

    // 3. view selector
    const viewToggles = document.querySelectorAll('#viewToggle');
    viewToggles.forEach(toggle => {
        toggle.onchange = (e) => {
            window.hasManuallyToggled = true;
            currentView = e.target.checked ? 'agenda' : 'month';
            document.querySelectorAll('#viewToggle').forEach(t => {
                t.checked = e.target.checked;
            });
            render();
        };
    });

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
                        size: 17in 11in; /* HOA Newsletter Tabloid Size */
                        margin: 0;
                    }
                    body {
                        margin: 0; padding: 0;
                        width: 17in; height: 11in;
                        overflow: hidden;
                        position: relative;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print-bg {
                        position: absolute;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        z-index: 1;
                    }
                    .calendar-grid {
                        display: grid !important;
                        grid-template-columns: repeat(7, 1fr) !important;
                        grid-template-rows: repeat(5, 1fr) !important;
                        position: absolute !important;
                        top: 14%; left: 0; width: 100%; height: 86%;
                        z-index: 2;
                        box-sizing: border-box;
                    }
                    .calendar-day {
                        position: relative !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: flex-start !important; /* Forces top-alignment for normal days */
                        overflow: hidden !important;
                        box-sizing: border-box;
                    }

                    /* --- The Spring for Split Cells --- */
                    .day-events-bottom {
                        margin-top: auto !important; /* Pushes the 31st to the bottom */
                    }
        
                    /* The SVG Split Line Fix for Print */
                    .split-line-container {
                        position: absolute !important;
                        top: 0; left: 0; width: 100%; height: 100%;
                        z-index: 0;
                    }
                    .split-line-container svg {
                        width: 100%; height: 100%;
                        display: block;
                    }
        
                    /* Cell Headers (Top & Bottom) */
                    .day-top, .day-bottom {
                        display: flex !important;
                        align-items: center !important;
                        height: 20px !important;
                        padding: 0 5px !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        position: relative;
                        z-index: 5;
                    }

                    .day-events-bottom .event-item {
                        text-align: right !important;
                    }
        
                    .day-number {
                        flex: 0 0 30px !important;
                        font-size: 12pt !important;
                        font-weight: 900 !important;
                    }
        
                    /* Top Day Positioning */
                    .day-top { justify-content: flex-start !important; }
                    .day-top .day-icons-corner { margin-left: auto !important; display: flex; gap: 2px; }
        
                    /* Bottom Day Positioning */
                    .day-bottom { justify-content: flex-end !important; }
                    .day-bottom .day-icons-corner { margin-right: auto !important; display: flex; gap: 2px; }
        
                    .corner-unit svg { height: 16px !important; width: auto !important; }
        
                    /* Event Bars */
                    .day-events, .day-events-bottom {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 1px !important;
                        padding: 0 2px !important;
                        position: relative;
                        z-index: 5;
                    }
        
                    .event-item {
                        font-size: 9pt !important;
                        line-height: 1.1 !important;
                        padding: 1px 4px !important;
                        white-space: normal !important; /* Allow wrapping on print */
                        display: block !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        border-radius: 3px !important;
                        color: #000 !important;
                        margin-bottom: 1px;
                    }
        
                    /* UI Hiding */
                    .add-event-plus, .edit-pencil, .edit-pencil-mini, .nav-arrow {
                        display: none !important;
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

    /* "Rotate Tablet" Listener */
    window.addEventListener('resize', () => {
        if (window.isHybridPage && !window.hasManuallyToggled) {
            const newView = (window.innerWidth < 768) ? 'agenda' : 'month';
            if (newView !== currentView) {
                currentView = newView;
                document.querySelectorAll('.viewToggle').forEach(t => t.checked = (currentView === 'agenda'));
                render();
            }
        }
    });


    /* --- Drag & Drop --- */

    document.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.event-item');
        if (!chip) return;

        draggedData = {
            id: chip.dataset.eventId,
            pivotId: chip.dataset.pivotId,
            moveId: chip.dataset.moveId,
            originalDate: chip.closest('.calendar-day').dataset.date || chip.closest('.split-cell').dataset.date
        };

        document.getElementById('calendar-grid').classList.add('is-dragging');
        e.dataTransfer.effectAllowed = "move";
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault(); // Required to allow drop
        const dayCell = e.target.closest('.calendar-day');
        const appHeader = e.target.closest('#fsb-calendar-app');
        const isShift = e.shiftKey;

        // Reset all targets
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        appHeader?.classList.remove('header-drop-active');

        // Handle Day Cell Hover
        if (dayCell && !dayCell.classList.contains('empty')) {
            dayCell.classList.add('drop-target');
            dayCell.setAttribute('data-drop-text', isShift ? "Reschedule Following" : "Reschedule Here");
        }
        // Handle Header Hover (Check if mouse is in the top 14%)
        else if (appHeader) {
            const rect = appHeader.getBoundingClientRect();
            if (e.clientY - rect.top < (rect.height * 0.14)) {
                appHeader.classList.add('header-drop-active');
                appHeader.setAttribute('data-drop-text', isShift ? "DROP TO END SERIES" : "DROP TO CANCEL INSTANCE");
            }
        }
    });

    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        const isShift = e.shiftKey;
        const grid = document.getElementById('calendar-grid');
        const appContainer = document.getElementById('fsb-calendar-app');

        // 1. Clean up UI immediately
        grid.classList.remove('is-dragging');
        appContainer.classList.remove('header-drop-active');

        if (!draggedData) return;

        // 2. Check if we are in the Header (The top 14%)
        const rect = appContainer.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const isInHeader = relativeY >= 0 && relativeY < (rect.height * 0.14);

        if (isInHeader) {
            const mode = isShift ? 'series_end' : 'instance_cancel';
            console.log(`FSBHOA: Header Drop [${mode}] for ID ${draggedData.id}`);

            // Pass all IDs to ensure PHP has what it needs
            await saveEventChanges(mode, draggedData.id, draggedData.originalDate, false);

            // Reset state and exit
            draggedData = null;
            return;
        }

        // 3. Fallback to Day Cell Reschedule
        const dayCell = e.target.closest('.calendar-day');
        if (dayCell && !dayCell.classList.contains('empty')) {
            const targetDate = dayCell.dataset.date;
            if (targetDate === draggedData.originalDate && !isShift) return;

            submitReschedule(draggedData.id, draggedData.originalDate, draggedData.pivotId, draggedData.moveId, targetDate, isShift);
        }

        draggedData = null;
    });


    document.addEventListener('dragend', () => {
        document.getElementById('calendar-grid').classList.remove('is-dragging');
        document.getElementById('fsb-calendar-app').classList.remove('header-drop-active');
    });



    loadData();

});

async function loadData() {
        try {
            const response = await fetch(config.jsonUrl);
            const data = await response.json();
            allEvents = data.events || [];
            iconLibrary = { ...iconLibrary, ...(data.icons || {}) };
            render();
        } catch (e) {
            console.error("FSBHOA Calendar Error:", e);
            grid.innerHTML = '<div style="padding:20px; color:red;">Failed to load calendar data.</div>';
        }
}




function render() {
    const monthlyWrapper = document.getElementById('fsb-monthly-wrapper');
    const agendaWrapper = document.getElementById('fsb-agenda-wrapper');

    // 1. RESPONSIVE AUTO-SWITCH (Only if both exist and user hasn't touched the toggle)
    if (monthlyWrapper && agendaWrapper && !window.hasManuallyToggled) {
        currentView = (window.innerWidth < 768) ? 'agenda' : 'month';
        // Sync the checkbox visual
        document.querySelectorAll('.viewToggle').forEach(t => {
            t.checked = (currentView === 'agenda');
        });
    }

    // 2. DATE GLOBALS (Needed for Navigation & Guardrails)
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    window.currentYear = year;
    window.currentMonth = month;

    // 3. THE TOGGLE & RENDER LOGIC
    if (currentView === 'month' && monthlyWrapper) {
        // Show Monthly, Kill Agenda
        monthlyWrapper.style.display = 'flex';
        if (agendaWrapper) agendaWrapper.style.display = 'none';

        // Update Background & Grid (Passing the actual App div inside the wrapper)
        const monthlyApp = monthlyWrapper.querySelector('#fsb-calendar-app');
        updateBackground(monthlyApp, year, month);
        renderMonthGrid(monthlyApp);
    } 
    else if (currentView === 'agenda' && agendaWrapper) {
        // Show Agenda, Kill Monthly
        agendaWrapper.style.display = 'flex';
        if (monthlyWrapper) monthlyWrapper.style.display = 'none';

        const agendaApp = agendaWrapper.querySelector('#fsb-agenda-app');
        renderAgendaView(agendaApp);
    }

    // 4. NAV GUARDRAILS (Keeps users within your past/future limits)
    updateNavGuardrails(year, month);
}


function updateNavGuardrails(year, month) {
    const isAtPrevLimit = (new Date(year, month - 1, 1).getTime()) < window.fsbMinTime;
    const isAtNextLimit = (new Date(year, month + 1, 1).getTime()) > window.fsbMaxTime;

    // Target the arrows based on active view
    let prev = document.getElementById(currentView === 'month' ? 'prevMonth' : 'prevMonthAgenda');
    let next = document.getElementById(currentView === 'month' ? 'nextMonth' : 'nextMonthAgenda');

    if (prev) {
        prev.style.opacity = isAtPrevLimit ? "0.3" : "1";
        prev.style.pointerEvents = isAtPrevLimit ? "none" : "auto";
    }
    if (next) {
        next.style.opacity = isAtNextLimit ? "0.3" : "1";
        next.style.pointerEvents = isAtNextLimit ? "none" : "auto";
    }
}


function renderMonthGrid(monthlyApp) {
    const grid = monthlyApp.querySelector('#calendar-grid');
    if (!grid) return;
    const year = window.currentYear;
    const month = window.currentMonth;
    const now = new Date();
    const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');
    //const todayStr = "2026-05-26"; // Pretend today is May 26th
    //const todayStr = "2026-08-04"; // Pretend today is August 4th


    //console.log("Today: ", todayStr);

    let firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const isSatStart31 = (firstDay === 6 && daysInMonth === 31);

    grid.innerHTML = '';

    for (let i = 0; i < 35; i++) {
        let dayNum;

        // --- AUGUST 2026 (SATURDAY START 31 DAYS) ---
        if (isSatStart31) {
            if (i < 6) {
                // Sunday (0) to Friday (5) are Aug 2 to Aug 7
                dayNum = i + 2;
            } else if (i === 6) {
                // Saturday (6) is the 1 / 8 Split
                grid.innerHTML += renderSplitCell(year, month, 1, 8, todayStr);
                continue;
            } else {
                // From Index 7 (Sunday) onwards, we are at Aug 9, 10, etc.
                // i=7 + 2 = 9. Perfect.
                dayNum = i + 2;
            }
        } else {
            // --- STANDARD MONTHS ---
            dayNum = i - firstDay + 1;

            // Handle standard Sunday splits (30-day Sat starts or 31-day Fri starts)
            const isSatStart30 = (firstDay === 6 && daysInMonth === 30);
            const isFriStart31 = (firstDay === 5 && daysInMonth === 31);

            if (i === 28 && ((isSatStart30 && dayNum === 23) || (isFriStart31 && dayNum === 24))) {
                grid.innerHTML += renderSplitCell(year, month, dayNum, dayNum + 7, todayStr);
                continue;
            }
        }

        // --- RENDER DAY ---
        if (dayNum > 0 && dayNum <= daysInMonth) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
            const isPast = dateStr < todayStr;
            const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString();
            const dayEvents = allEvents.filter(e => e.date === dateStr);
            const bars = dayEvents.filter(e => !iconLibrary[e.category_id]);
            const icons = dayEvents.filter(e => iconLibrary[e.category_id]);

            grid.innerHTML += `
                <div class="calendar-day ${isPast ? 'past-day' : ''} ${isToday ? 'today' : ''}" 
                        data-date="${dateStr}"
                        onclick="openDayModal('${dateStr}')">
                    <div class="day-top">
                        <div class="day-number">${dayNum}</div>
                        <div class="day-icons-corner">${renderIcons(icons, dateStr)}</div>
                        <div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateStr}')">+</div>
                    </div>
                    <div class="day-events">${renderEvents(bars)}</div>
                </div>`;
        } else {
            grid.innerHTML += '<div class="calendar-day empty"></div>';
        }
    }
}



function renderSplitCell(year, month, topDay, botDay, todayStr) {
    const dateA = `${year}-${String(month+1).padStart(2,'0')}-${String(topDay).padStart(2,'0')}`;
    const dateB = `${year}-${String(month+1).padStart(2,'0')}-${String(botDay).padStart(2,'0')}`;
    
    const isPastA = dateA < todayStr;
    const isPastB = dateB < todayStr;
    
    let activeSVG = iconLibrary["split-blue"]; // Default
    let splitStateClass = '';

    if (isPastA && isPastB) {
        activeSVG = iconLibrary["split-gray"];
        splitStateClass = 'both-past';
    } else if (isPastA) {
        activeSVG = iconLibrary["split-mixed"]; // The blue line + gray triangle
        splitStateClass = 'top-past';
    }

    const evtsA = allEvents.filter(e => e.date === dateA);
    const evtsB = allEvents.filter(e => e.date === dateB);

    return `
        <div class="calendar-day split-cell ${splitStateClass}" 
                data-date="${dateA}" data-date-top="${dateA}" data-date-bottom="${dateB}"
                onclick="openDayModal('${dateA}')">
            <div class="split-line-container">
                ${activeSVG}
            </div>

            <div class="day-top ${isPastA ? 'past-day' : ''}">
                <div class="day-number">${topDay}</div>
                <div class="day-icons-corner">${renderIcons(evtsA.filter(e => iconLibrary[e.category_id]), dateA)}</div>
                <div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateA}')">+</div>
            </div>
            <div class="day-events ${isPastA ? 'past-day' : ''}">
                ${renderEvents(evtsA.filter(e => !iconLibrary[e.category_id]))}
            </div>

            <div class="day-events-bottom ${isPastB ? 'past-day' : ''}">
                ${renderEvents(evtsB.filter(e => !iconLibrary[e.category_id]))}
            </div>
            <div class="day-bottom ${isPastB ? 'past-day' : ''}">
                <div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateB}')">+</div>
                <div class="day-icons-corner">${renderIcons(evtsB.filter(e => iconLibrary[e.category_id]), dateB)}</div>
                <div class="day-number">${botDay}</div>
            </div>
        </div>`;
}


// Helper to keep the icon HTML clean
function renderIcons(icons, dateStr) {
    return icons.map(e => {
        const canEdit = config.isAdmin || (e.owner_email && e.owner_email === config.userEmail);
        return `
            <div class="corner-unit" title="${e.title}" style="position:relative; display:inline-flex; align-items:center;">
                <svg viewBox="0 0 24 24" fill="${e.cat_color}" style="height:18px; width:auto; cursor:pointer;"
                     onclick="event.stopPropagation(); showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})">
                    <path d="${iconLibrary[e.category_id]}"></path>
                </svg>
                ${canEdit ? `<span class="edit-pencil-mini" onclick="event.stopPropagation(); handleEditClick(${e.id}, '${dateStr}', '${e.prvot_id}', '${e.move_id}')">✎</span>` : ''}
            </div>`;
    }).join('');
}


function renderAgendaView(agendaApp) {
    if (!agendaApp) return;
    // 1. Target the NEW container, not the grid
    const agendaContainer = agendaApp.querySelector('#agenda-view');
    if (!agendaContainer) return;

    // 2. Calculate the Month Name
    const todayStr = new Date().toISOString().split('T')[0];
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentViewDate);

    // 3. Setup the skeleton inside the agenda container
    agendaContainer.innerHTML = `
        <div id="agenda-sticky-header">${monthName}</div>
        <div id="agenda-content-area"></div>
    `;

    const contentArea = document.getElementById('agenda-content-area');

    // 4. Filter and Sort Events (Same logic as yours, which is solid)
    const targetMonth = currentViewDate.getMonth();
    const targetYear = currentViewDate.getFullYear();

    const monthEvents = allEvents.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    if (monthEvents.length === 0) {
        contentArea.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">No events scheduled for this month.</div>';
        return;
    }

    monthEvents.sort((a, b) => a.date.localeCompare(b.date));

    let html = '';
    let lastDate = '';

    monthEvents.forEach(e => {
        const dateObj = new Date(e.date + 'T00:00:00');
        const dateHeader = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        const isToday = (e.date === todayStr);

        // DAY HEADER BLOCK
        if (e.date !== lastDate) {
            const dayIcons = monthEvents.filter(iconEvt =>
                iconEvt.date === e.date && iconLibrary[iconEvt.category_id]
            );

            html += `
                <div class="agenda-day-header ${isToday ? 'agenda-today-header' : ''}" data-agenda-date="${e.date}">
                    <span>${dateHeader}</span>
                    <div class="agenda-header-icons">
                        ${dayIcons.map(iconEvt => `
                            <div title="${iconEvt.title}">
                                <svg viewBox="0 0 24 24" fill="${iconEvt.cat_color}" style="height:18px; width:18px;">
                                    <path d="${iconLibrary[iconEvt.category_id]}"></path>
                                </svg>
                            </div>
                        `).join('')}
                    </div>
                </div>`;

            lastDate = e.date; // Update this ONLY ONCE at the end of the header block
        }

        // EVENT ROW BLOCK (Only for non-icon events)
        if (!iconLibrary[e.category_id]) {
            let thumbSrc = (e.flyer_url && /\.(jpg|jpeg|png|gif|svg|webp)/i.test(e.flyer_url))
                ? e.flyer_url
                : `https://www.google.com/s2/favicons?domain=${e.flyer_url ? new URL(e.flyer_url).hostname : 'fsbhoa.com'}&sz=128`;

            const flyerAction = e.flyer_url
                ? `onclick="event.stopPropagation(); window.open('${e.flyer_url}', '_blank');"`
                : '';

            html += `
                <div class="agenda-row ${isToday ? 'agenda-today-row' : ''}"
                    onclick="showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})">
                    ${e.flyer_url
                        ? `<div class="agenda-thumb" title="Click to open flyer" ${flyerAction}>
                               <img src="${thumbSrc}">
                           </div>`
                        : '<div class="agenda-thumb-placeholder" style="width:50px; margin-right:15px;"></div>'
                    }
                    <div class="agenda-info">
                        <div class="agenda-main-line">${e.title}</div>
                        <div class="agenda-time">⏰ ${e.start_fmt} - ${e.end_fmt}</div>
                        <div class="agenda-location">📍 ${e.location || 'Lodge'}</div>
                    </div>
                    <div class="agenda-chevron-icon">❯</div>
                </div>`;
        }
    });

    contentArea.innerHTML = html;

    // 5. Jump to Date logic
    const scrollTarget = targetDate || todayStr;

    setTimeout(() => {
        const targetEl = contentArea.querySelector(`[data-agenda-date="${scrollTarget}"]`);
        if (targetEl && currentView === 'agenda') {
            // Calculate position relative to the document
            const headerHeight = 150; // Site Header + Agenda Header
            const elementPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, 300);
}




function openEditModal(selectedDate, eventId = null, pivot_id = null, move_id = null, fetchedData = null) {
    const modal = document.getElementById('fsb-edit-modal');
    const container = document.getElementById('edit-form-container');

    // Use fetchedData if we are editing, otherwise empty object for new events
    const eventData = fetchedData || { 
        // Explicitly set the defaults for new events
        is_ticketed: false, 
        rrule: '', 
        title: '',
        visibility: 'public',
    };

    const hasDelegate = !!(eventData.owner_email && eventData.owner_email.trim() !== '');
    const delegateSection = `
        <div class="form-group" style="margin-top:15px; padding:10px; background:#f0f4f8; border-radius:4px; border:1px solid #d1d9e0;">
            <label style="display:flex; align-items:center; cursor:pointer; margin-bottom:0;">
                <input type="checkbox" id="toggle-delegate" ${hasDelegate ? 'checked' : ''}
                       style="margin-right:10px;" onchange="toggleDelegateField()">
                <strong>Delegate Event Management</strong>
            </label>

            <div id="delegate-input-container" style="display: ${hasDelegate ? 'block' : 'none'}; margin-top:10px;">
                <label style="font-size:0.8rem; color:#444;">Delegate's Email Address</label>
                <input type="email" name="owner_email" id="owner_email_input"
                       value="${eventData.owner_email || ''}"
                       placeholder="resident@email.com" style="width:100%;">
                <p style="font-size:10px; color:#666; margin-top:4px;">
                    *This person can edit this event's details and flyer.
                </p>
            </div>
        </div>
    `;


    // Format the display dates for the header
    const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const rescheduled = (move_id && move_id !== "" && move_id !== "null") ? "that was rescheduled." : "";

    // If it's a repeating event, find the base date (original start date)
    const baseDateInfo = (eventData.rrule && eventData.base_date)
        ? `<div style="color: #d32f2f; font-size: 0.85rem; margin-top: 4px;">
             <strong>This is an instance of Series starting at:</strong> ${eventData.base_date} ${rescheduled}
           </div>`
        : '';

    const isRecurring = !!eventData.rrule;
    const headerColor = isRecurring ? '#f57c00' : '#0288d1';
    const typeLabel = isRecurring ? "📅 Recurring Series" : "📍 One-Time Event";

    container.innerHTML = `
        <form id="fsb-edit-form">
            <div style="background: #fdfdfd; border-left: 5px solid ${headerColor}; padding: 10px 15px; margin-bottom: 15px; border: 1px solid #eee; border-left-width: 5px; border-radius: 4px;">
                <div style="font-size: 0.7rem; text-transform: uppercase; color: ${headerColor}; font-weight: 800; margin-bottom: 2px;">
                    ${typeLabel}
                </div>
                <h3 style="margin: 0; font-size: 1.2rem;">${eventId ? 'Update Event' : 'Create New Event'}</h3>
                <div style="font-size: 0.9rem; font-weight: 600; margin-top: 4px;">Date: ${displayDate}</div>
                ${baseDateInfo}
            </div>

            <input type="hidden" name="event_id" value="${eventId || ''}">
            <input type="hidden" name="pivot_id" value="${pivot_id || ''}">
            <input type="hidden" name="move_id" value="${move_id || ''}">
            <input type="hidden" name="date" value="${selectedDate}">
            <input type="hidden" id="edit_mode" name="edit_mode" value="single">

            <div class="form-group">
                <label>Event Title</label>
                <input type="text" name="title" value="${eventData.title || ''}" required>
            </div>

            <div class="form-group">
                <label>Description</label>
                <textarea name="content" rows="1" style="width:100%; resize:vertical; font-family:inherit; padding:8px; border:1px solid #ddd; border-radius:4px;">${eventData.content || ''}</textarea>
            </div>

            <div class="form-group">
                <label>Setup Notes (Internal/Admin)</label>
                <textarea name="setup_notes" rows="1" style="width:100%; resize:vertical; font-family:inherit; padding:8px; border:1px solid #ddd; border-radius:4px; background: #fffde7;">${eventData.setup_notes || ''}</textarea>
                <p style="font-size:10px; color:#666; margin:0;">*Visible to admins and residents in details view.</p>
            </div>

            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <label style="margin-bottom: 0;">Flyer URL (Canva/Media Lib)</label>
                    <a href="#" id="upload-flyer-link" 
                       style="font-size: 0.75rem; color: #0288d1; text-decoration: none; font-weight: 600;"
                       onclick="openFlyerMediaLibrary(event)">
                       [Browse Media]
                    </a>
                </div>
                <input type="text" name="flyer_url" id="flyer_url_input"
                       style="width: 100%; margin-top: 4px;"
                       value="${eventData.flyer_url || ''}"
                       oninput="updateFlyerHint()">
                <p id="flyer-hint" style="font-size:10px; margin-top:4px; color:#666; transition: all 0.3s;">
                    ${eventData.flyer_url ? '⚠️ <strong>Note:</strong> Having a flyer URL overrides the Detail Modal.' : 'Enter a URL to link directly to a PDF/Image flyer.'}
                </p>
            </div>

            <div class="time-row" style="display:flex; gap:10px;">
                <div style="flex:1">
                    <label>Start Time</label>
                    <input type="time" name="start_time" value="${eventData.start_time || '09:00'}">
                </div>
                <div style="flex:1">
                    <label>End Time</label>
                    <input type="time" name="end_time" value="${eventData.end_time || '10:00'}">
                </div>
            </div>

            <div class="time-row" style="display:flex; gap:10px;">
                <div style="flex:1">
                    <label>Location (Room)</label>
                    <select name="location_id" style="width:100%;">
                        <option value="">-- Select --</option>
                        ${fsb_config.locations.map(loc =>
                            `<option value="${loc.id}" ${eventData.location_id == loc.id ? 'selected' : ''}>${loc.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="flex:1">
                    <label>Category</label>
                    <select name="category_id" style="width:100%;">
                        ${fsb_config.categories.map(cat =>
                            `<option value="${cat.id}" ${eventData.category_id == cat.id ? 'selected' : ''}>${cat.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-top:15px; padding:10px; background:#e3f2fd; border-radius:4px;">
                <strong>Privacy & Visibility:</strong><br>
                <label style="margin-right:10px;">
                    <input type="radio" name="visibility" value="public"
                        ${(!eventData.visibility || eventData.visibility === 'public') ? 'checked' : ''}>
                    Public (Everyone)
                </label>
                <label>
                    <input type="radio" name="visibility" value="resident"  ${(eventData.visibility === 'resident') ? 'checked' : ''}>
                    Residents Only
                </label>
                <p style="font-size:10px; color:#666; margin:4px 0 0 0;">*Residents only events require a WordPress login to view.</p>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" name="is_ticketed" id="is_ticketed_check" value="true"
                           ${eventData.is_ticketed == true ? 'checked' : ''}
                           onchange="document.getElementById('cost_container').style.display = this.checked ? 'block' : 'none'">
                    Requires Tickets / Registration
                </label>
            </div>

            <div class="form-group" id="cost_container" style="display: ${eventData.is_ticketed == true ? 'block' : 'none'};">
                <label>Cost</label>
                <input type="text" name="cost" value="${eventData.cost || ''}" placeholder="$0.00">
            </div>

            <hr>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="is_repeating"
                           ${(eventData.rrule && eventData.rrule !== '') ? 'checked' : ''}
                           onchange="toggleRRPanel()">
                    This is a Repeating Event.
                </label>
                <div id="rr-warning" style="display:none; color: #d32f2f; font-size: 0.8rem; font-weight: bold; margin-top: 5px;">
                    ⚠️ Unchecking this will delete the entire future series!
                </div>
            </div>

            <div id="rr-builder-panel"
                style="display: ${(eventData.rrule && eventData.rrule !== '') ? 'block' : 'none'};
                    background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:5px;">
                <div class="rr-row checkbox-group-horizontal">
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
                <div class="rr-row checkbox-group-horizontal" style="margin-top:10px;">
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

            ${delegateSection}

            <div id="reschedule-panel" style="display:none; margin-top:15px; padding:15px; border:1px dashed #ed6c02; background:#fff8e1; border-radius:4px;">
                <strong>Reschedule Event:</strong><br>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <div style="flex: 2;">
                        <label style="font-size: 0.8rem;">New Date:</label><br>
                        <input type="date" id="reschedule_date_input" name="move_to_date" value="${selectedDate}" style="width:100%; padding:5px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem;">New Start Time:</label><br>
                        <input type="time" id="reschedule_time_input" name="move_to_start_time" value="${eventData.start_time || '09:00'}" style="width:100%; padding:5px;">
                    </div>
                </div>

                <div style="margin-top:15px; font-size: 0.9rem;">
                    <strong>Apply to:</strong><br>
                    <label style="display:block; cursor:pointer; margin-top:5px;">
                        <input type="radio" name="reschedule_scope" value="instance" checked> 
                        Only this instance (${selectedDate})
                    </label>
                    ${eventData.rrule ? `
                    <label style="display:block; cursor:pointer; margin-top:5px;">
                        <input type="radio" name="reschedule_scope" value="remaining"> 
                        This and all future instances
                    </label>` : ''}
                </div>
            </div>

            <div class="form-actions" style="margin-top:25px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="fsb-save-btn" onclick="saveEventChanges()" style="background:#0288d1; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer;">Save</button>

                ${eventId ? `
                    <button type="button" onclick="handleCancelBtn(${JSON.stringify(eventData).replace(/"/g, '&quot;')}, '${selectedDate}')" style="background:#ef5350; color:#fff; padding:10px; border:none; border-radius:4px; cursor:pointer;">Cancel Event</button>
                    <button type="button" onclick="handleRescheduleBtn()" style="background:#ffa726; color:#fff; padding:10px; border:none; border-radius:4px; cursor:pointer;">Reschedule</button>
                ` : ''}
            </div>
        </form>
    `;


    // populate the Days and weeks checkboxes.
    if (eventData.rrule) {
        const rrule = eventData.rrule;
        const dayMatch = rrule.match(/BYDAY=([^;]+)/);
        if (dayMatch) {
            const days = dayMatch[1].split(',');
            document.querySelectorAll('.rr-day').forEach(cb => {
                if (days.includes(cb.value)) cb.checked = true;
            });
        }
        const weekMatch = rrule.match(/BYSETPOS=([^;]+)/);
        if (weekMatch) {
            const weeks = weekMatch[1].split(',');
            document.querySelectorAll('.rr-week').forEach(cb => {
                if (weeks.includes(cb.value)) cb.checked = true;
            });
        }
        const monthDayMatch = rrule.match(/BYMONTHDAY=([^;]+)/);
        if (monthDayMatch) {
            document.getElementById('rr-bymonthday').value = monthDayMatch[1];
        }
    }
    modal.classList.add('is-visible');
    document.body.classList.add('modal-open');  // keeps background from scrolling while editing.
}

function toggleRRPanel() {
    const panel = document.getElementById('rr-builder-panel');
    const isChecked = document.getElementById('is_repeating').checked;
    const headerLabel = document.querySelector('#fsb-edit-form [style*="text-transform: uppercase"]');
    const headerBorder = document.querySelector('#fsb-edit-form [style*="border-left: 5px solid"]');
    const warningDiv = document.getElementById('rr-warning');

    // 1. Handle the Builder Panel visibility
    panel.style.display = isChecked ? 'block' : 'none';

    // 2. Handle the "Unchecking" Warning (The "If Exists" check)
    if (!isChecked) {
        // Find the hidden event_id input to see if this is an existing record
        const eventIdInput = document.querySelector('input[name="event_id"]');
        const isExistingEvent = eventIdInput && eventIdInput.value !== '';

        if (isExistingEvent) {
            const proceed = confirm("⚠️ WARNING: Unchecking this will convert this series into a single one-time event. All future occurrences and custom cancels will be DELETED on Save. Proceed?");

            if (!proceed) {
                // User got scared! Flip the checkbox back to checked
                document.getElementById('is_repeating').checked = true;
                panel.style.display = 'block'; // Keep panel open
                return; // Exit the function here
            }
        }

        // If it's a NEW event or they clicked "OK" to the warning:
        document.getElementById('rrule_input').value = '';
        if (warningDiv) warningDiv.style.display = 'none';

        // Reset Header to Blue
        if (headerLabel) headerLabel.innerText = "📍 One-Time Event";
        if (headerLabel) headerLabel.style.color = "#0288d1";
        if (headerBorder) headerBorder.style.borderLeftColor = "#0288d1";

    } else {
        // 3. Handle "Checking" it (Turning a one-shot into a series)
        if (headerLabel) headerLabel.innerText = "📅 Recurring Series";
        if (headerLabel) headerLabel.style.color = "#f57c00";
        if (headerBorder) headerBorder.style.borderLeftColor = "#f57c00";

        // Show the warning text only if editing an existing event
        const eventIdInput = document.querySelector('input[name="event_id"]');
        if (warningDiv && eventIdInput && eventIdInput.value !== '') {
            warningDiv.style.display = 'block';
        }
    }
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

function toggleDelegateField() {
    const isChecked = document.getElementById('toggle-delegate').checked;
    const container = document.getElementById('delegate-input-container');
    const input = document.getElementById('owner_email_input');

    container.style.display = isChecked ? 'block' : 'none';

    // If they uncheck it, clear the value so it's removed on save
    if (!isChecked) {
        input.value = '';
    }
}

async function handleRescheduleBtn() {
    const form = document.getElementById('fsb-edit-form');
    const eventId = form.querySelector('input[name="event_id"]').value;
    const pivotId = form.querySelector('input[name="pivot_id"]').value;
    const moveId = form.querySelector('input[name="move_id"]').value;
    const eventDate = form.querySelector('input[name="date"]').value;

    console.log(`RESCHEDULE TRIGGER: Harvested Pivot: ${pivotId}, Move: ${moveId}`);

    // 1. Save current changes first to ensure data integrity
    const saved = await saveEventChanges('soft_save', null, null, true); // Added 'silent' flag

    if (saved) {
        // 2. Close the Edit Modal and save only the meda data.
        document.getElementById('fsb-edit-modal').classList.remove('is-visible');

        // 3. Fetch fresh data for the reschedule (to ensure we have the latest)
        const response = await fetch(`${fsb_config.ajax_url}?action=fsb_get_event_details&event_id=${eventId}&nonce=${fsb_config.nonce}`);
        const result = await response.json();

        if (result.success) {
            openRescheduleDialog(result.data, eventDate, pivotId, moveId);
        }
    }
}

function openRescheduleDialog(eventData, clickedDate, pivotId = null, moveId = null) {
    const modal = document.getElementById('fsb-reschedule-modal'); // You'll need to add this ID to your PHP/HTML
    const container = document.getElementById('reschedule-form-container');

    console.log(`Reschedule Dialog OPEN: Receiving Pivot: ${pivotId}, Move: ${moveId}`);

    container.innerHTML = `
        <div style="padding: 15px;">
            <h3 style="margin-top:0;">Reschedule single instance: ${eventData.title}</h3>
            <p style="font-size: 0.9rem; color: #666;">Original: ${clickedDate} @ ${eventData.start_fmt}</p>

            <div class="form-group">
                <label>New Date</label>
                <input type="date" id="res_date" value="${clickedDate}" style="width:100%;">
            </div>

            <div class="form-group" style="margin-top:10px;">
                <label>New Start Time</label>
                <input type="time" id="res_time" value="${eventData.start_time}" style="width:100%;">
            </div>

            <p style="font-size: 0.75rem; color: #ed6c02; margin-top:15px; font-style:italic;">
                * This move only affects this specific event. To change the whole series, modify recurring rules.
            </p>

            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="button" class="fsb-save-btn" onclick="submitReschedule(${eventData.id}, '${clickedDate}', ${pivotId || 'null'}, ${moveId || 'null'})">Confirm Move</button>
            </div>
        </div>
    `;
    modal.classList.add('is-visible');
}

async function submitReschedule(id, origDate, pivotId, moveId, newDate, isShift = false) {
    // Determine the new time.
    // For a drag-drop, we usually keep the original start time.
    const event = allEvents.find(e => e.id == id && e.date == origDate);
    const startTime = event ? event.start_time : "09:00";

    const formData = new FormData();
    formData.append('action', 'fsb_save_calendar_event');
    formData.append('nonce', fsb_config.nonce);
    formData.append('edit_mode', 'instance_move');
    formData.append('event_id', id);
    if (pivotId && pivotId !== "null") formData.append('pivot_id', pivotId);
    if (moveId && moveId !== "null") formData.append('move_id', moveId);

    formData.append('date', origDate);
    formData.append('move_to_date', newDate);
    formData.append('move_to_start_time', startTime);

    // Requirement #2: Shift-drag sets scope to 'remaining' (Pivot)
    formData.append('reschedule_scope', isShift ? 'remaining' : 'instance');

    const response = await fetch(fsb_config.ajax_url, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result.success) {
        // Refresh to show the new "Bake"
        loadData();
    } else {
        alert("Error moving event: " + result.data);
    }
}

function handleCancelBtn(eventData, dateStr) {
    const modal = document.getElementById('fsb-manage-modal');
    const container = document.getElementById('manage-form-container');
    const isRecurring = !!eventData.rrule;

    // UI Branding based on status
    const headerColor = isRecurring ? '#f57c00' : '#d32f2f';
    const isCurrentlyCancelled = eventData.status === 'cancelled';
    const hasEndDate = (eventData.rrule && eventData.rrule.includes('UNTIL='));

    let buttonsHtml = '';

    if (!isRecurring) {
        // --- SINGLE EVENT OPTIONS ---
        buttonsHtml = `
            <button class="manage-btn danger" onclick="confirmAction('master_delete', ${eventData.id})">Delete Event Forever</button>
        `;
    } else {
        // --- RECURRING SERIES OPTIONS ---
        buttonsHtml += `<button class="manage-btn warning" onclick="confirmAction('instance_cancel', ${eventData.id}, '${dateStr}')">Cancel ONLY this instance</button>`;

        buttonsHtml += `<button class="manage-btn success" onclick="confirmAction('instance_restore', ${eventData.id}, '${dateStr}')">Restore or Undelete Next Cancelled Instance</button>`;

        buttonsHtml += `<button class="manage-btn warning" onclick="confirmAction('series_end', ${eventData.id}, '${dateStr}', ${eventData.pivot_id})">End series starting today</button>`;

        if (hasEndDate) {
            // 1. Extract the raw string (e.g., "20260414T235959")
            const rawUntil = eventData.rrule.match(/UNTIL=([^;]+)/)?.[1];
            let readableUntil = "Fixed Count";

            if (rawUntil) {
                // 2. Parse YYYY-MM-DD
                const y = rawUntil.substring(0, 4);
                const m = rawUntil.substring(4, 6);
                const d = rawUntil.substring(6, 8);

                // 3. Create a date object (using local time to match the input)
                const dateObj = new Date(`${y}-${m}-${d}T00:00:00`);
                readableUntil = dateObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
            buttonsHtml += `
                <div style="margin-top:10px; padding:10px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:4px;">
                    <p style="margin:0 0 8px 0; font-size:0.8rem; color:#2e7d32;"><strong>Series currently ends:</strong> ${readableUntil}</p>
                    <button class="manage-btn success" style="width:100%;" onclick="confirmAction('series_resume', ${eventData.id}, '${dateStr}', ${eventData.pivot_id})">
                        Resume Series & Restore All Future
                    </button>
                </div>
            `;
        }
        
        buttonsHtml += `<hr><button class="manage-btn danger" onclick="confirmAction('master_delete', ${eventData.id})">DELETE ENTIRE SERIES & HISTORY</button>`;
    }

    container.innerHTML = `
        <div style="border-left: 5px solid ${headerColor}; padding-left: 15px;">
            <h3 style="margin:0;">Manage Instance</h3>
            <p style="margin:5px 0; font-weight:bold;">${eventData.title}</p>
            <p style="font-size:0.85rem; color:#666;">Date: ${dateStr}</p>
        </div>
        <div class="manage-actions-list" style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
            ${buttonsHtml}
        </div>
    `;

    document.getElementById('fsb-edit-modal').classList.remove('is-visible');
    modal.classList.add('is-visible');
}

// Global Helper for Confirmation
async function confirmAction(mode, id, date = null, pivotId = null) {
    const messages = {
        'instance_cancel': 'Are you sure you want to cancel this specific session?',
        'instance_restore': 'Restore this session to the calendar?',
        'series_end': 'This will cut off the series. No sessions will appear after this date. Proceed?',
        'master_delete': 'CRITICAL: This deletes the entire history and future of this event. Continue?'
    };

    if (confirm(messages[mode] || 'Proceed with this action?')) {
        await saveEventChanges(mode, id, date, false);
        // saveEventChanges already handles the redirect/refresh
    }
}



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
            // who can edit?  The admin or the delegate.
            const canEdit = config.isAdmin || 
                (e.owner_email && e.owner_email.toLowerCase() === config.userEmail.toLowerCase());

            // 1. Debugging: See what URL we are working with
            console.log("Processing event:", e.title, "Flyer URL:", e.website_url);

            let thumbnailSrc = "";
            const activeFlyerUrl = e.flyer_url;

            if (activeFlyerUrl && activeFlyerUrl.trim() !== "") {
                const isImage = /\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/i.test(activeFlyerUrl);
                if (isImage) {
                    // Use the image directly from your media library
                    thumbnailSrc = activeFlyerUrl;
                } else {
                    // It's a webpage (Canva, etc.), so get the favicon
                    try {
                        const urlObj = new URL(activeFlyerUrl);
                        thumbnailSrc = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
                    } catch(err) {
                        thumbnailSrc = `https://www.google.com/s2/favicons?domain=fsbhoa.com&sz=128`;
                    }
                }
            }

            // 2. Build the Thumbnail HTML
            const flyerThumbnail = activeFlyerUrl
                ? `<div class="flyer-thumb-container" title="Click to open flyer" onclick="window.open('${activeFlyerUrl}', '_blank')">
                    <img src="${thumbnailSrc}"
                         alt="Flyer"
                         referrerpolicy="no-referrer"
                         style="width:100%; height:100%; object-fit:cover; display:block;">
                   </div>`
                : `<div class="flyer-thumb-placeholder" style="width:45px; height:45px; flex-shrink:0;"></div>`;

            html += `
                <li class="modal-event-card" style="border-bottom:1px solid #eee; padding:12px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1; display:flex; align-items:center; gap:15px;">
                        ${flyerThumbnail}
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem;">${e.title}</div>
                            <div style="color:#666; font-size:0.9rem;">📍 ${e.location || 'Lodge'} | ⏰ ${e.start_fmt} - ${e.end_fmt}</div>
                        </div>
                    </div>
        
                    <div class="modal-icon-actions" style="display:flex; gap:20px; font-size:1.5rem; align-items:center;">
                        <span title="View Details" style="color:#0288d1; cursor:pointer;" onclick="showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})">ⓘ</span>
                        ${canEdit ? `<span title="Edit Event" style="color:#f57c00; cursor:pointer;" onclick="handleEditClick(${e.id}, '${dateStr}', '${e.pivot_id}', '${e.move_id}')">✎</span>` : ''}
                    </div>
                </li>`;
        });

        html += '</ul>';
    }

    content.innerHTML = html;
    modal.classList.add('is-visible');
}

// Helper to bridge the Modal to the Edit Form
async function handleEditClick(id, dateStr, pivot_id, move_id = null) {
    //console.log("Pencil clicked. Closing Day Modal and fetching ID:", id," (Move: ", move_id, " Pivot: ", pivot_id," )");
    const dayModal = document.getElementById('fsb-day-modal');
    if (dayModal) {
        dayModal.classList.remove('is-visible');
    }

    try {
        const response = await fetch(`${fsb_config.ajax_url}?action=fsb_get_event_details&event_id=${id}&nonce=${fsb_config.nonce}`);
        const result = await response.json();

        if (result.success) {
            // 2. Pass the freshly fetched data to the modal builder
            openEditModal(dateStr, id, pivot_id, move_id, result.data);
        } else {
            alert("Could not load event details: " + result.data);
        }
    } catch (e) {
        console.error("Fetch failed", e);
    }
}

function openFlyerMediaLibrary(e) {
    if (e) e.preventDefault();
    
    // Ensure wp.media is available
    if (typeof wp === 'undefined' || !wp.media) {
        alert("WordPress Media Library not loaded.");
        return;
    }

    const frame = wp.media({
        title: 'Select Flyer (Image or PDF)',
        multiple: false,
        library: { type: ['image', 'application/pdf'] }
    });

    frame.on('select', function() {
        const attachment = frame.state().get('selection').first().toJSON();
        const input = document.getElementById('flyer_url_input');
        if (input) {
            input.value = attachment.url;
            updateFlyerHint(); // Refresh the red warning text
        }
    });

    frame.open();
}


async function saveEventChanges(overrideMode = null, overrideId = null, overrideDate = null, silent = false) {
    const form = document.getElementById('fsb-edit-form');
    // If the form exists, use it; otherwise, start with an empty FormData object
    const formData = form ? new FormData(form) : new FormData();

    // Now set our overrides (this works whether the form existed or not)
    if (overrideMode) formData.set('edit_mode', overrideMode);
    if (overrideId)   formData.set('event_id', overrideId);
    if (overrideDate) formData.set('date', overrideDate);

    // Ensure we have the basic WP requirements
    formData.append('action', 'fsb_save_calendar_event');
    formData.append('nonce', fsb_config.nonce);

    // If we're dragging, we might need the pivot_id too
    if (typeof draggedData !== 'undefined' && draggedData && draggedData.pivotId) {
        formData.set('pivot_id', draggedData.pivotId);
    }

    try {
        const response = await fetch(fsb_config.ajax_url, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            if (silent) return true;
            loadData(); // Refresh the grid
            return true;
        } else {
            console.error('Save failed:', result.data);
            if (!silent) alert('Error: ' + result.data);
        }
    } catch (e) {
        console.error('AJAX Error:', e);
    }
    return false;
}

/**
 * Helper to turn a list of events into HTML chips for the grid
 */
function renderEvents(events) {
    if (!events || events.length === 0) return '';

    return events.map(e => {
        // --- THE GATEKEEPER ---
        // If it's a resident event and we don't have a user email, don't render anything
        if (e.visibility && e.visibility === 'resident' && !config.userEmail) {
            return '';
        }
        const canEdit = config.isAdmin || (e.owner_email && e.owner_email === config.userEmail);

        // Smart Time Logic (e.g., "9a" or "9:30p")
        let timeStr = '';
        if (e.start_fmt) {
            timeStr = e.start_fmt.toLowerCase().replace(':00', '').replace(' ', '');
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
        // If there is a move_id...
        const moveId = e.move_id || null;

        // If there's a flyer, we open it. Otherwise, we show the details.
        const clickAction = e.flyer_url
            ? `window.open('${e.flyer_url}', '_blank')`
            : `showEventDetail(${JSON.stringify(e).replace(/"/g, '&quot;')})`;

        return `
            <div class="event-item"
                 draggable="${canEdit ? 'true' : 'false'}"
                 data-event-id="${e.id}"
                 data-pivot-id="${e.pivot_id || e.id}"
                 data-move-id="${moveId || ''}"
                 style="background-color: ${e.cat_color};"
                 title="${e.flyer_url ? 'Click to open flyer' : 'Click for details'}"
                 onclick="event.stopPropagation(); ${clickAction}">
                <span class="event-title-text" style="flex:1; overflow:hidden; text-overflow:ellipsis;">${combinedTitle}</span>
                ${canEdit ? `<span class="edit-pencil" onclick="event.stopPropagation(); handleEditClick(${e.id}, '${e.date}', '${e.pivot_id}', '${moveId}')">✎</span>` : ''}
            </div>
        `;
    }).join('');
}

function showEventDetail(event) {
    // 1. Identify which "Room" we are standing in
    const activeAppId = (currentView === 'month') ? 'fsb-calendar-app' : 'fsb-agenda-app';
    const activeApp = document.getElementById(activeAppId);

    // 2. Find the modal and content area INSIDE that active app
    const activeModal = activeApp.querySelector('#fsb-detail-modal');
    const activeContent = activeApp.querySelector('#modal-content-area');

    // Emergency Fallback: if scoped search fails, try global
    const modal = activeModal || document.getElementById('fsb-detail-modal');
    const content = activeContent || document.getElementById('modal-content-area');

    if (!modal || !content) {
        console.error("Could not find the Detail Modal in the active view.");
        return;
    }

    // Close the Day Modal (if it is open) to clear the screen
    const dayModal = document.getElementById('fsb-day-modal');
    if (dayModal) {
        dayModal.classList.remove('is-visible');
    }

    // Prepare the Flyer Thumbnail HTML for the Modal
    let flyerHtml = "";
    let thumbSrc = "";

    if (event.flyer_url && event.flyer_url.trim() !== "") {
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/i.test(event.flyer_url);
        if (isImage) {
            thumbSrc = event.flyer_url;
        } else {
            try {
                const urlObj = new URL(event.flyer_url);
                thumbSrc = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
            } catch(err) {
                thumbSrc = `https://www.google.com/s2/favicons?domain=fsbhoa.com&sz=128`;
            }
        }

        // 2. Build the "Flyer:" row
        flyerHtml = `
            <p style="margin:8px 0; display:flex; align-items:center; gap:10px;">
                <strong>📄 Flyer:</strong> 
                <span onclick="window.open('${event.flyer_url}', '_blank')" 
                      style="display:inline-flex; align-items:center; cursor:pointer; background:#e3f2fd; padding:4px 8px; border-radius:4px; border:1px solid #0288d1; transition: background 0.2s;">
                    <img src="${thumbSrc}" style="width:24px; height:24px; object-fit:cover; border-radius:2px; margin-right:8px; border:1px solid #ccc;">
                    <span style="font-size:0.85rem; color:#0288d1; font-weight:bold;">View Flyer (PDF/Image)</span>
                </span>
            </p>
        `;
    }


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
                <p style="margin:5px 0;"><strong>⏰ When:</strong> ${event.start_fmt} - ${event.end_fmt}</p>
                ${flyerHtml}
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
    modal.classList.add('is-visible');
}

function closeDetailModal() {
    // Select all potential modals and hide them
    const modals = document.querySelectorAll('.fsb-full-modal');
    modals.forEach(m => m.classList.remove('is-visible'));
    document.body.classList.remove('modal-open');
}



function updateBackground(appContainer, year, month) {
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

function openAddModal(dateStr) {
    console.log("Admin clicked [+] for date:", dateStr);
    // We reuse the existing openEditModal logic, 
    // passing null for the ID to trigger a "New Event" form
    openEditModal(dateStr);
}

function updateFlyerHint() {
    const input = document.getElementById('flyer_url_input');
    const hint = document.getElementById('flyer-hint');

    if (input.value.trim() !== '') {
        hint.innerHTML = '🚀 <strong>Redirect Active:</strong> Clicking this event on the calendar will open the flyer instead of the details box.';
        hint.style.color = '#d32f2f'; // Red warning color
    } else {
        hint.innerHTML = 'Enter a URL to link directly to a PDF/Image flyer.';
        hint.style.color = '#666';
    }
}

// Ensure handleEditClick is available globally if needed by other modules
window.handleEditClick = handleEditClick;
window.openAddModal = openAddModal;


