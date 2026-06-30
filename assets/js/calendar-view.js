//   -- calendar-view.js  --
window.hoaplugin_config = window.hoaplugin_config || {};
// note: window.hoaplugin_data is injected by PHP and is not the same as window.hoaplugin_config.  
window.hoaplugin_allEvents = [];
window.hoaplugin_grid; 
window.hoaplugin_agendaContainer = null;
window.hoaplugin_display = null;
window.hoaplugin_currentView = 'month'; // 'month' or 'agenda'
window.hoaplugin_iconLibrary = {};

// --- DATE DETECTION LOGIC --- (the month to show at start if not today)
const urlParams = new URLSearchParams(window.location.search);
const urlDateStr = urlParams.get('viewDate');
window.hoaplugin_currentViewDate = urlDateStr ? new Date(urlDateStr + 'T00:00:00') : new Date();
// Scrub the URL immediately so a manual "F5" refresh
// doesn't keep the user trapped in that month forever.
if (urlDateStr) {
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}
// --------------------------------




document.addEventListener('DOMContentLoaded', function() {
    const monthlyApp = document.getElementById('hoa-calendar-app');
    const agendaApp = document.getElementById('hoa-agenda-app');

    // 1. EXIT if nothing is found
    if (!monthlyApp && !agendaApp) return;

    
    // --- ADDED GUARDRAIL ---
    // 2. EXIT if on the Backend Dashboard. 
    // This stops the 404 fetches, DOM errors, and prevents it from overwriting the PHP config.
    if (window.hoaplugin_config && window.hoaplugin_config.isDashboard) {
        return; 
    }
    // -----------------------
    window.hoaplugin_grid = document.getElementById('calendar-grid');
    window.hoaplugin_agendaContainer = document.getElementById('agenda-view');
    window.hoaplugin_display = document.getElementById('currentMonthDisplay');


    // 3. DETERMINE VIEW & CAPABILITY
    if (monthlyApp && agendaApp) {
        // BOTH ARE HERE: Enable switching and auto-detect width
        window.hoaplugin_isHybridPage = true;
        if (!window.hoaplugin_hasManuallyToggled) {
            window.hoaplugin_currentView = (window.innerWidth < 768) ? 'agenda' : 'month';
        }
    } else {
        // ONLY ONE IS HERE: Lock the view to what's available
        window.hoaplugin_isHybridPage = false;
        window.hoaplugin_currentView = monthlyApp ? 'month' : 'agenda';

        // Hide the view selector since they can't switch
        const selectors = document.querySelectorAll('#viewSelector, #viewSelectorAgenda');
        selectors.forEach(s => s.style.display = 'none');
    }

    const activeApp = monthlyApp || agendaApp;
    window.hoaplugin_config = {
        jsonUrl: activeApp.dataset.jsonUrl,
        userEmail: activeApp.dataset.userEmail,
        isAdmin: activeApp.dataset.isAdmin === 'true',
        printJsUrl: window.hoaplugin_data.print_js_url
    };

    // Calculate the min and max allowed dates
    const today = new Date();
    // We use parseInt to ensure "1" becomes 1, and window. prefix to make them globally accessible
    window.hoaplugin_fsbMinTime = new Date(
        today.getFullYear(),
        today.getMonth() - parseInt(window.hoaplugin_data.past_limit),
        1
    ).getTime();

    window.hoaplugin_fsbMaxTime = new Date(
        today.getFullYear(),
        today.getMonth() + parseInt(window.hoaplugin_data.future_limit),
        1
    ).getTime();




    // Close buttons logic
    document.querySelectorAll('.close-modal, .modal-close').forEach(btn => {
        btn.onclick = function() {
            // This finds the closest parent container that is a modal and hides it
            const modal = this.closest('.hoa-modal, .hoa-full-modal');
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
            let testDate = new Date(window.hoaplugin_currentViewDate.getFullYear(), window.hoaplugin_currentViewDate.getMonth() - 1, 1).getTime();
            if (testDate >= window.hoaplugin_fsbMinTime) {
                // STRIP FLAG BEFORE RE-RENDER
                document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
                window.hoaplugin_currentViewDate.setMonth(window.hoaplugin_currentViewDate.getMonth() - 1);
                render();
            } else {
                console.log("Navigation blocked: Past limit reached.");
            }
        };
    });

    // Attach logic to every 'Next' button found
    nextBtns.forEach(btn => {
        btn.onclick = () => {
            let testDate = new Date(window.hoaplugin_currentViewDate.getFullYear(), window.hoaplugin_currentViewDate.getMonth() + 1, 1).getTime();
            if (testDate <= window.hoaplugin_fsbMaxTime) {
                // STRIP FLAG BEFORE RE-RENDER
                document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
                window.hoaplugin_currentViewDate.setMonth(window.hoaplugin_currentViewDate.getMonth() + 1);
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
            // STRIP FLAG BEFORE RE-RENDER
            document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
            window.hoaplugin_currentViewDate = new Date();
            render();
        };
    });

    // 2. Fullscreen Logic
    const fsBtn = document.getElementById('toggleFullScreen');
    if (fsBtn) {
        fsBtn.onclick = () => {
            const app = document.getElementById('hoa-monthly-wrapper');
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
        // STRIP FLAG BEFORE RE-RENDER
        document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
        // Re-run render to snap the background and grid back into place
        render();
    });

    // 3. view selector
    const viewToggles = document.querySelectorAll('#viewToggle');
    viewToggles.forEach(toggle => {
        toggle.onchange = (e) => {
            window.hoaplugin_hasManuallyToggled = true;
            window.hoaplugin_currentView = e.target.checked ? 'agenda' : 'month';
            document.querySelectorAll('#viewToggle').forEach(t => {
                t.checked = e.target.checked;
            });
            // STRIP FLAG BEFORE RE-RENDER
            document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
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

    document.addEventListener('mouseover', (e) => {
        const half = e.target.closest('.split-half');
        if (half) {
            // Clear any lingering magnifications first
            document.querySelectorAll('.split-half').forEach(el => el.classList.remove('is-magnified'));
            // Magnify the specific one we are touching
            half.classList.add('is-magnified');
        }
    });

    document.addEventListener('mouseout', (e) => {
        const half = e.target.closest('.split-half');
        if (half && !e.relatedTarget?.closest('.split-half')) {
            half.classList.remove('is-magnified');
        }
    });



    /* "Rotate Tablet" Listener */
    window.addEventListener('resize', () => {
        if (window.hoaplugin_isHybridPage && !window.hoaplugin_hasManuallyToggled) {
            const newView = (window.innerWidth < 768) ? 'agenda' : 'month';
            if (newView !== window.hoaplugin_currentView) {
                window.hoaplugin_currentView = newView;
                document.querySelectorAll('.viewToggle').forEach(t => t.checked = (window.hoaplugin_currentView === 'agenda'));
                // STRIP FLAG BEFORE RE-RENDER
                document.getElementById('hoa-calendar-app')?.removeAttribute('data-render-complete');
                render();
            }
        }
    });





    // --- THE PIXEL-PERFECT HOVER ENGINE (MAGNIFIER) ---
    // This uses the actual coordinates of the split line to determine
    // which triangle the mouse is in, regardless of overlap.
    let activeShard = null;
    let lastTargetKey = null; // Stores "date-type" to prevent redundant re-draws

    document.addEventListener('mousemove', (e) => {
        if (window.hoaplugin_grid.classList.contains('magnifier-disabled') || window.hoaplugin_grid.classList.contains('is-dragging')) {
            // Clean up any stray shards before returning
            if (activeShard) {
                activeShard.remove();
                activeShard = null;
                lastTargetKey = null;
            }
            return;
        }

        // 1. ANCHOR CHECK: If we are hovering over an interactive element INSIDE an active shard,
        // we "freeze" the logic so the shard doesn't swap while the user is trying to click a pencil.
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        // Explicitly find the split-cell, IGNORING any active shards

        // --- ANCHOR EXCEPTION FOR MAGNIFY ---
        // Check if the mouse is currently over the magnified shard or its children
        const isOverShard = elements.some(el =>
            el.classList.contains('hoa-ghost-shard') ||
            el.closest('.hoa-ghost-shard')
        );

        // 2. DETECTION: Look for the underlying split-cell
        const hoveredCell = elements.find(el =>
            el.classList.contains('split-cell') &&
            !el.classList.contains('hoa-ghost-shard')
        );

        // 3. EXIT CONDITION: If no cell is hovered, kill the shard and reset state
        if (!hoveredCell && !isOverShard) {
            if (activeShard) {
                activeShard.remove();
                activeShard = null;
                lastTargetKey = null;
            }
            return;
        }
        // If we are over the shard, stop the math logic so the shard doesn't
        // flicker or swap while we are clicking the pencil.
        if (isOverShard && !hoveredCell) return;


        // 4. TRIANGLE MATH: Determine if mouse is in 'top' or 'bottom'
        const rect = hoveredCell.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // The diagonal math: x/w + y/h < 1 is the upper-left triangle
        const positionValue = (x / rect.width) + (y / rect.height);

        // Add a tiny "dead zone" buffer (0.02) to prevent flickering exactly on the line
        if (Math.abs(positionValue - 1) < 0.02) return;

        const newShardType = positionValue < 1 ? 'top' : 'bottom';
        const currentKey = `${hoveredCell.dataset.date}-${newShardType}`;

        // 5. DEBOUNCE: If the mouse is moving but stays within the same triangle, STOP here.
        if (currentKey === lastTargetKey) return;

        // 6. CLEANUP: Remove the previous shard before creating the new one
        if (activeShard) {
            activeShard.remove();
        }

        // 7. CREATE NEW SHARD
        lastTargetKey = currentKey;
        activeShard = document.createElement('div');
        activeShard.className = `hoa-ghost-shard shard-${newShardType}`;
        activeShard.dataset.type = newShardType;
        activeShard.dataset.cellDate = hoveredCell.dataset.date;

        // Grab content from the hidden source half inside the grid cell
        const sourceClass = newShardType === 'top' ? '.split-half-top' : '.split-half-bottom';
        const sourceContent = hoveredCell.querySelector(sourceClass);

        if (sourceContent) {
            activeShard.innerHTML = sourceContent.innerHTML;
            // Ensure the shard carries over any click handlers (like opening the modal)
            activeShard.onclick = sourceContent.onclick;
        }

        // 8. POSITIONING & POINTER LOGIC
        Object.assign(activeShard.style, {
            position: 'fixed',
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            zIndex: '10000',
            // Make the shard container "invisible" to the mouse so it doesn't
            // block the 'hoveredCell' detection on the grid below.
            pointerEvents: 'none'
        });

        const wrapper = document.getElementById('hoa-monthly-wrapper');
        if (wrapper) {
            wrapper.appendChild(activeShard);

            // 9. RE-ENABLE INTERACTION: Allow the user to click the actual items
            const interactives = activeShard.querySelectorAll('.event-item, .edit-pencil, .add-event-plus');
            interactives.forEach(el => {
                el.style.pointerEvents = 'auto';
            });
        }
    });



    loadData();

});


async function loadData() {
        try {
            const response = await fetch(window.hoaplugin_config.jsonUrl);
            const data = await response.json();
            window.hoaplugin_allEvents = data.events || [];
            window.hoaplugin_eventInstances = {};
            // build an index of events so events can be passed by reference to instance_id.
            window.hoaplugin_allEvents.forEach(ev => {
                window.hoaplugin_eventInstances[ev.instance_id] = ev;
            });
            window.hoaplugin_iconLibrary = { ...window.hoaplugin_iconLibrary, ...(data.icons || {}) };
            render();
        } catch (e) {
            console.error("HOAplugin Calendar Error:", e);
            window.hoaplugin_grid.innerHTML = '<div style="padding:20px; color:red;">Failed to load calendar data.</div>';
        }
}




function render() {
    const monthlyWrapper = document.getElementById('hoa-monthly-wrapper');
    const agendaWrapper = document.getElementById('hoa-agenda-wrapper');

    // 1. RESPONSIVE AUTO-SWITCH (Only if both exist and user hasn't touched the toggle)
    if (monthlyWrapper && agendaWrapper && !window.hoaplugin_hasManuallyToggled) {
        window.hoaplugin_currentView = (window.innerWidth < 768) ? 'agenda' : 'month';
        // Sync the checkbox visual
        document.querySelectorAll('.viewToggle').forEach(t => {
            t.checked = (window.hoaplugin_currentView === 'agenda');
        });
    }

    //console.log(`[TRACE] render() invoked. window.innerWidth: ${window.innerWidth}, currentView: ${currentView}`);


    // 2. DATE GLOBALS (Needed for Navigation & Guardrails)
    const year = window.hoaplugin_currentViewDate.getFullYear();
    const month = window.hoaplugin_currentViewDate.getMonth();
    window.hoaplugin_currentYear = year;
    window.hoaplugin_currentMonth = month;

    // 3. NAV GUARDRAILS (Keeps users within your past/future limits)
    updateNavGuardrails(year, month);
    
    // 4. THE TOGGLE & RENDER LOGIC
    if (window.hoaplugin_currentView === 'month' && monthlyWrapper) {
        // Show Monthly, Kill Agenda
        monthlyWrapper.style.display = 'flex';
        if (agendaWrapper) agendaWrapper.style.display = 'none';

        // Re-enable page scrolling
        document.body.classList.remove('hoa-agenda-mode');
        document.documentElement.classList.remove('hoa-agenda-mode');

        // Update Background & Grid (Passing the actual App div inside the wrapper)
        const monthlyApp = monthlyWrapper.querySelector('#hoa-calendar-app');
        updateBackground(monthlyApp, year, month);
        renderMonthGrid(monthlyApp);
    } 
    else if (window.hoaplugin_currentView === 'agenda' && agendaWrapper) {
        // Show Agenda, Kill Monthly
        agendaWrapper.style.display = 'flex';
        if (monthlyWrapper) monthlyWrapper.style.display = 'none';

        // Disable page scrolling, let the agenda scroll
        document.body.classList.add('hoa-agenda-mode');
        document.documentElement.classList.add('hoa-agenda-mode');


        const agendaApp = agendaWrapper.querySelector('#hoa-agenda-app');
        renderAgendaView(agendaApp);

    }

}


function updateNavGuardrails(year, month) {
    const isAtPrevLimit = (new Date(year, month - 1, 1).getTime()) < window.hoaplugin_fsbMinTime;
    const isAtNextLimit = (new Date(year, month + 1, 1).getTime()) > window.hoaplugin_fsbMaxTime;

    // Target the arrows based on active view
    let prev = document.getElementById(window.hoaplugin_currentView === 'month' ? 'prevMonth' : 'prevMonthAgenda');
    let next = document.getElementById(window.hoaplugin_currentView === 'month' ? 'nextMonth' : 'nextMonthAgenda');

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
    const year = window.hoaplugin_currentYear;
    const month = window.hoaplugin_currentMonth;
    const now = new Date();
    const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');

    const rawFirstDay = new Date(year, month, 1).getDay(); // 0-6 (Sun-Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = parseInt(window.hoaplugin_data.start_day) || 0; // 0=Sun, 1=Mon

    // 1. DETERMINE THE CALENDAR STATE
    let mode = 'standard';
    if (startOffset === 0) { // SUNDAY START
        if (rawFirstDay === 5 && daysInMonth === 31) mode = 'bottom_left_single'; // Fri 31 -> 24/31
        else if (rawFirstDay === 6 && daysInMonth === 30) mode = 'bottom_left_single'; // Sat 30 -> 23/30
        else if (rawFirstDay === 6 && daysInMonth === 31) mode = 'top_right_single'; // Sat 31 -> 1/8
    } else { // MONDAY START
        if (rawFirstDay === 6 && daysInMonth === 31) mode = 'top_right_double'; // Sat 31 -> 1/8 & 2/9
        else if (rawFirstDay === 0 && daysInMonth === 30) mode = 'top_right_single'; // Sun 30 -> 1/8
        else if (rawFirstDay === 0 && daysInMonth === 31) mode = 'top_right_single'; // Sun 31 -> 1/8
    }

    // 2. BUILD THE BLUEPRINT (35 cells)
    let cells = new Array(35).fill(null);
    let offset = (rawFirstDay - startOffset + 7) % 7;

    if (mode === 'bottom_left_single') {
        let topDay = (daysInMonth === 31) ? 24 : 23;
        cells[28] = { type: 'split', top: topDay, bot: daysInMonth };
        for (let d = 1; d <= daysInMonth; d++) {
            if (d === topDay || d === daysInMonth) continue;
            cells[offset + d - 1] = { type: 'normal', day: d };
        }
    }
    else if (mode === 'top_right_single') {
        cells[6] = { type: 'split', top: 1, bot: 8 };
        let d = 2;
        for (let i = 0; i < 35; i++) {
            if (i === 6) continue;
            if (d === 8) d++;
            if (d <= daysInMonth) {
                cells[i] = { type: 'normal', day: d };
                d++;
            }
        }
    }
    else if (mode === 'top_right_double') {
        cells[5] = { type: 'split', top: 1, bot: 8 };
        cells[6] = { type: 'split', top: 2, bot: 9 };
        let d = 3;
        for (let i = 0; i < 35; i++) {
            if (i === 5 || i === 6) continue;
            if (d === 8 || d === 9) d++;
            if (d <= daysInMonth) {
                cells[i] = { type: 'normal', day: d };
                d++;
            }
        }
    }
    else { // STANDARD
        for (let d = 1; d <= daysInMonth; d++) {
            cells[offset + d - 1] = { type: 'normal', day: d };
        }
    }

    // 3. RENDER THE BLUEPRINT
    const appEl = document.getElementById('hoa-calendar-app');
    if (appEl) {
        appEl.setAttribute('data-view-year', year);
        appEl.setAttribute('data-view-month', month + 1);
        if (mode !== 'standard') appEl.setAttribute('data-has-split-cell', 'true');
        else appEl.removeAttribute('data-has-split-cell');
    }

    const canCreate = window.hoaplugin_config.isAdmin || (window.hoaplugin_data.delegated_categories && window.hoaplugin_data.delegated_categories.length > 0);
    grid.innerHTML = '';

    for (let i = 0; i < 35; i++) {
        const cellData = cells[i];

        if (!cellData) {
            grid.innerHTML += '<div class="calendar-day empty"></div>';
            continue;
        }

        if (cellData.type === 'split') {
            monthlyApp.setAttribute('data-split-cell-index', i);
            grid.innerHTML += renderSplitCell(year, month, cellData.top, cellData.bot, todayStr);
            continue;
        }

        // Standard Normal Day
        const d = cellData.day;
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isPast = dateStr < todayStr;
        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
        const dayEvents = window.hoaplugin_allEvents.filter(e => e.date === dateStr);
        const bars = dayEvents.filter(e => !window.hoaplugin_iconLibrary[e.category_id]);
        const icons = dayEvents.filter(e => window.hoaplugin_iconLibrary[e.category_id]);

        grid.innerHTML += `
            <div class="calendar-day day-content ${isPast ? 'past-day' : ''} ${isToday ? 'today' : ''}"
                    data-date="${dateStr}"
                    onclick="openDayModal('${dateStr}')">
                <div class="day-top">
                    <div class="day-number">${d}</div>
                    <div class="day-icons-corner">${renderIcons(icons, dateStr)}</div>
                    ${canCreate ? `<div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateStr}')">+</div>` : ''}
                    
                </div>
                <div class="day-events">${renderEvents(bars)}</div>
            </div>`;
    }

    monthlyApp.setAttribute('data-render-complete', 'true');
}




function renderSplitCell(year, month, topDay, botDay, todayStr) {
    const dateA = `${year}-${String(month+1).padStart(2,'0')}-${String(topDay).padStart(2,'0')}`;
    const dateB = `${year}-${String(month+1).padStart(2,'0')}-${String(botDay).padStart(2,'0')}`;
    
    const isPastA = dateA < todayStr;
    const isPastB = dateB < todayStr;

    const todayDateStr = new Date().toDateString();
    const isTodayA = todayDateStr === new Date(year, month, topDay).toDateString();
    const isTodayB = todayDateStr === new Date(year, month, botDay).toDateString();
    
    // The diaginal line for the split cells.
    const activeSVG = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="split-diagonal">
    <line x1="100" y1="0" x2="0" y2="100" stroke="#aaa" stroke-width="1" />
</svg>`;
    let stateClasses = [];
    if (isPastA && isPastB) stateClasses.push('both-past');
    else if (isPastA) stateClasses.push('top-past');
    
    if (isTodayA) stateClasses.push('top-today');
    if (isTodayB) stateClasses.push('bottom-today');

    const splitStateClass = stateClasses.join(' ');

    const evtsA = window.hoaplugin_allEvents.filter(e => e.date === dateA);
    const evtsB = window.hoaplugin_allEvents.filter(e => e.date === dateB);
    const canCreate = window.hoaplugin_config.isAdmin || (window.hoaplugin_data.delegated_categories && window.hoaplugin_data.delegated_categories.length > 0);

    return `
    <div class="calendar-day split-cell ${splitStateClass}"
            data-date="${dateA}"
            data-date-top="${dateA}"
            data-date-bottom="${dateB}">
        <div class="split-line-container">${activeSVG}</div>

        <div class="split-half day-content split-half-top ${isPastA ? 'past-day' : ''}"
             data-date="${dateA}"
             onclick="event.stopPropagation(); openDayModal('${dateA}')">

            <div class="events-layer layer-bg" aria-hidden="true">
                <div class="day-top" style="visibility: hidden;"></div>
                <div class="day-events">
                    ${renderEvents(evtsA.filter(e => !window.hoaplugin_iconLibrary[e.category_id]))}
                </div>
            </div>
            <div class="events-layer layer-text">
                <div class="day-top" style="visibility: hidden;"></div>
                <div class="day-events">
                    ${renderEvents(evtsA.filter(e => !window.hoaplugin_iconLibrary[e.category_id]))}
                </div>
            </div>

            <div class="day-top">
                <div class="day-number">${topDay}</div>
                <div class="day-icons-corner">${renderIcons(evtsA.filter(e => window.hoaplugin_iconLibrary[e.category_id]), dateA)}</div>
                ${canCreate ? `<div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateA}')">+</div>` : ''}
            </div>
        </div>

        <div class="split-half day-content split-half-bottom ${isPastB ? 'past-day' : ''}"
             data-date="${dateB}"
             onclick="event.stopPropagation(); openDayModal('${dateB}')">

            <div class="events-layer layer-bg" aria-hidden="true">
                <div class="day-events-bottom">
                    ${renderEvents(evtsB.filter(e => !window.hoaplugin_iconLibrary[e.category_id]))}
                </div>
                <div class="day-bottom" style="visibility: hidden;"></div>
            </div>

            <div class="events-layer layer-text">
                <div class="day-events-bottom">
                    ${renderEvents(evtsB.filter(e => !window.hoaplugin_iconLibrary[e.category_id]))}
                </div>
                <div class="day-bottom" style="visibility: hidden;"></div>
            </div>
            <div class="day-bottom">
                ${canCreate ? `<div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateB}')">+</div>` : ''}
                <div class="day-icons-corner">${renderIcons(evtsB.filter(e => window.hoaplugin_iconLibrary[e.category_id]), dateB)}</div>
                <div class="day-number">${botDay}</div>
            </div>
        </div>
    </div>`;
}


// Helper to keep the icon HTML clean
function renderIcons(icons, dateStr) {
    return icons.map(e => {
        //  Only show the pencil if they have permission AND we aren't in the agenda
        const isCatDelegate = window.hoaplugin_data.delegated_categories && window.hoaplugin_data.delegated_categories.includes(parseInt(e.category_id));
        const canEdit =
            window.handleAddEventFromModal &&
            ((window.hoaplugin_config.isAdmin || isCatDelegate || (e.owner_email && window.hoaplugin_config.userEmail && e.owner_email.toLowerCase() === window.hoaplugin_config.userEmail.toLowerCase()))
            && window.hoaplugin_currentView !== 'agenda');
        let svgContent = window.hoaplugin_iconLibrary[e.category_id] || '';

        if (svgContent) {
            // We only need the color here; we've moved the click and height logic to the parent
            const colorAttr = `fill="${e.cat_color}" style="color:${e.cat_color};"`;
            svgContent = svgContent.replace('<svg', `<svg ${colorAttr}`);
        }

        return `
            <div class="corner-unit event-item"
                 title="${e.flyer_url ? 'Click to open flyer' : 'Click for details'}"
                 draggable="${(canEdit && window.hoaplugin_data.is_pro) ? 'true' : 'false'}"
                 data-event-id="${e.id}"
                 data-pivot-id="${e.pivot_id || e.id}"
                 data-move-id="${e.move_id || ''}"
                 data-event-date="${e.date}"
                 data-event-start-time="${e.start_time}"
                 data-is-single="${!!e.single}"
                 onclick="activateEventDetailClick(event, ${e.instance_id})"
                 style="display:inline-flex; align-items:center; position:relative; background:transparent !important;">

                ${svgContent}

                ${canEdit ? `
                    <span class="edit-pencil-mini"
                          style="pointer-events: auto;"
                          onclick="event.stopPropagation(); window.handleEditClick(${e.id}, '${dateStr}', '${e.start_time}', ${e.pivot_id || 'null'}, ${e.move_id || 'null'})">
                        ✎
                    </span>` : ''}
            </div>`;
    }).join('');
}

//` Render the Agenda View
function renderAgendaView(agendaApp) {
    if (!agendaApp) return;
    // 1. Target the NEW container, not the grid
    const agendaContainer = agendaApp.querySelector('#agenda-view');
    if (!agendaContainer) return;

    const contentArea = agendaApp.querySelector('#agenda-content-area');


    // Set the listeners for the month nav arrows.
    const prevAgendaBtn = document.getElementById('prevMonthAgenda');
    const nextAgendaBtn = document.getElementById('nextMonthAgenda');

    if (prevAgendaBtn) {
        prevAgendaBtn.onclick = () => {
            window.hoaplugin_currentViewDate.setMonth(window.hoaplugin_currentViewDate.getMonth() - 1);
            render();
        };
    }

    if (nextAgendaBtn) {
        nextAgendaBtn.onclick = () => {
            window.hoaplugin_currentViewDate.setMonth(window.hoaplugin_currentViewDate.getMonth() + 1);
            render();
        };
    }

    // 2. Calculate the Month Name
    const todayStr = new Date().toISOString().split('T')[0];
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(window.hoaplugin_currentViewDate);

    // 3. Setup the skeleton inside the agenda container
    const sticky = agendaApp.querySelector('#agenda-sticky-header');
    console.log('sticky =', sticky, 'monthName =', monthName, ' currentViewDate=', window.hoaplugin_currentViewDate);
    sticky.textContent = monthName;

    // 4. Filter and Sort Events (Same logic as yours, which is solid)
    const targetMonth = window.hoaplugin_currentViewDate.getMonth();
    const targetYear = window.hoaplugin_currentViewDate.getFullYear();

    const monthEvents = window.hoaplugin_allEvents.filter(e => {
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
        const webcal = getWebcalBtn(e.pivot_id || e.id)

        // DAY HEADER BLOCK
        if (e.date !== lastDate) {
            const dayIcons = monthEvents.filter(iconEvt =>
                iconEvt.date === e.date && window.hoaplugin_iconLibrary[iconEvt.category_id]
            );

            html += `
                <div class="agenda-day-header ${isToday ? 'agenda-today-header' : ''}"
                     data-agenda-date="${e.date}">
                    <span>${dateHeader}</span>

                    <div class="agenda-header-icons">
                        ${renderIcons(dayIcons, e.date)}
                    </div>
                </div>
            `;

            lastDate = e.date; // Update this ONLY ONCE at the end of the header block
        }

        // EVENT ROW BLOCK (Only for non-icon events)
        if (!window.hoaplugin_iconLibrary[e.category_id]) {
            html += `
                <div class="agenda-row ${isToday ? 'agenda-today-row' : ''}"
                      onclick="activateEventDetailClick(event, ${e.instance_id})">
                    ${renderFlyerThumb(e)}
                    <div class="agenda-info">
                        <div class="agenda-main-line">
                            ${e.title}
                        </div>
                        <div class="agenda-time">⏰ ${e.start_fmt} - ${e.end_fmt}</div>
                        <div class="agenda-location">
                            📍 ${e.location || 'Lodge'}  &nbsp; ${webcal}
                        </div>
                    </div>
                    <div class="agenda-chevron-icon">❯</div>
                </div>`;
        }

    });

    contentArea.innerHTML = html;



    // 5. Jump to Date logic
    // We want to scroll to the first date being viewed or today
    const scrollTarget = (monthEvents.length > 0) ? monthEvents[0].date : todayStr;

    setTimeout(() => {
        const targetEl = contentArea.querySelector(`[data-agenda-date="${scrollTarget}"]`);
        if (targetEl && currentView === 'agenda') {
            // Calculate position relative to the document
            const headerHeight = 150; // Site Header + Agenda Header
            const elementPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight;

            document.getElementById('agenda-view').scrollTo({
                top: targetEl.offsetTop - 60,
                behavior: 'smooth'
            });
        }
    }, 300);
}


function renderFlyerThumb(eventObj) {
    const url = eventObj.flyer_url ? eventObj.flyer_url.trim() : "";

    // No flyer → return placeholder
    if (!url) {
        return `
            <div class="agenda-thumb-placeholder" style="width:50px; margin-right:15px;"></div>
        `;
    }

    let thumbSrc = "";
    // Safely encoded inline SVGs so we never have to worry about broken image paths
    const fallbackPdfIcon = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d32f2f'%3E%3Cpath d='M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z'/%3E%3C/svg%3E";
    const fallbackGenericIcon = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230288d1'%3E%3Cpath d='M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'/%3E%3C/svg%3E";

    // CASE 1 — Image flyer
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
        thumbSrc = url;
    }

    // CASE 2 — PDF flyer
    else if (/\.pdf$/i.test(url)) {
        thumbSrc = fallbackPdfIcon;
    }

    // CASE 3 — Website URL  
    else if (/^https?:\/\//i.test(url)) {
        thumbSrc = fallbackGenericIcon;
    }

    // CASE 4 — Unknown type → fallback icon
    else {
        thumbSrc = fallbackGenericIcon;
    }

    // Return safe, non-navigating HTML
    return `
        <div class="thumb"
             onclick="activateEventDetailClick(event, ${eventObj.instance_id})">
            <img src="${thumbSrc}">
        </div>
    `;
}

function activateEventDetailClick(e, instanceId) {
    e.preventDefault();
    e.stopPropagation();

    const data = window.hoaplugin_eventInstances[instanceId];
    if (!data) {
        console.error("Event instance not found:", instanceId);
        return;
    }

    // If the event has a flyer, open it
    if (data.flyer_url && data.flyer_url.trim() !== '') {
        window.open(data.flyer_url, '_blank');
        return;
    }

    // Otherwise open the detail modal
    showEventDetail(data);
}




function openDayModal(dateStr) {
    const modal = document.getElementById('hoa-day-modal');
    const content = document.getElementById('hoa-modal-content');

    // Find the events for this date from our global array
    const events = window.hoaplugin_allEvents.filter(e => e.date === dateStr);

    const dateObj = new Date(dateStr + 'T00:00:00');
    const title = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const dayIcons = events;
    const canCreate = window.hoaplugin_config.isAdmin || (window.hoaplugin_data.delegated_categories && window.hoaplugin_data.delegated_categories.length > 0);

    // heading
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-right:30px;">

            <div style="display:flex; align-items:center; gap:15px;">
                <h3 style="margin:0;">Events for ${title}</h3>
    
                <div class="day-modal-header-icons" style="display:flex; gap:8px;">
                    ${renderIcons(dayIcons, dateStr)}
                </div>
            </div>

            ${canCreate ? `
                <span title="Add New Event"
                      style="color:#0056b3; cursor:pointer; font-size:2rem; font-weight:900; line-height:1; margin-right:10px;"
                      onclick="handleAddEventFromModal('${dateStr}')">+</span>
            ` : ''}
        </div>
        <hr>`;

    if (events.length === 0) {
        html += '<p>No events scheduled for this day.</p>';
    } else {
        html += '<ul class="modal-event-list" style="padding:0; list-style:none;">';
        events.forEach(e => {
            // who can edit?  The admin or the delegate.
            const canEdit = window.hoaplugin_config.isAdmin || 
                (e.owner_email && e.owner_email.toLowerCase() === window.hoaplugin_config.userEmail.toLowerCase());
            const webcal = getWebcalBtn(e.id);

            html += `
                <li class="modal-event-card"
                    style="border-bottom:1px solid #eee; padding:12px 0; display:flex; justify-content:space-between; align-items:center;"
                    onclick="activateEventDetailClick(event, ${e.instance_id})">
            
                    <div style="flex:1; display:flex; align-items:center; gap:15px;">
                        ${renderFlyerThumb(e)}

                        <div>
                            <div style="font-weight:bold; font-size:1.1rem;">
                                ${e.title}
                            </div>

                            <div style="color:#666; font-size:0.9rem;">
                                📍 ${e.location || 'Lodge'} | ⏰ ${e.start_fmt} - ${e.end_fmt}
                            </div>
                               <p style="margin:5px 0;"><strong> ${webcal}</strong></p>
                        </div>
                    </div>

                    <div class="modal-icon-actions"
                         style="display:flex; gap:20px; font-size:1.5rem; align-items:center;">

                        <!-- Info icon -->
                        <span title="View Details"
                              style="color:#0288d1; cursor:pointer;"
                              onclick="event.stopPropagation(); activateEventDetailClick(event, ${e.instance_id})">
                            ⓘ
                        </span>

                        <!-- Edit icon -->
                        ${canEdit ? `
                            <span title="Edit Event"
                                  style="color:#f57c00; cursor:pointer;"
                                  onclick="event.stopPropagation(); window.handleEditClick(${e.id}, '${dateStr}', '${e.start_time}', ${e.pivot_id}, ${e.move_id || 'null'})">
                                ✎
                            </span>
                        ` : ''}
                    </div>
                </li>
            `;

        });

        html += '</ul>';
    }

    content.innerHTML = html;
    modal.classList.add('is-visible');
}


/**
 * Helper to turn a list of events into HTML chips for the grid
 */
function renderEvents(events) {
    if (!events || events.length === 0) return '';

    return events.map(e => {
        // --- THE GATEKEEPER ---
        // If it's a resident event and we don't have a user email, don't render anything
        if (e.visibility && e.visibility === 'resident' && !window.hoaplugin_config.userEmail) {
            return '';
        }
        const isCatDelegate = window.hoaplugin_data.delegated_categories && window.hoaplugin_data.delegated_categories.includes(parseInt(e.category_id));
        const canEdit = window.hoaplugin_config.isAdmin || isCatDelegate || (e.owner_email && window.hoaplugin_config.userEmail && e.owner_email.toLowerCase() === window.hoaplugin_config.userEmail.toLowerCase());

        // Smart Time Logic (e.g., "9a" or "9:30p")
        let timeStr = e.start_fmt || '';
        if (timeStr && window.hoaplugin_data.time_format !== '24hr') {
            timeStr = timeStr.toLowerCase().replace(':00', '').replace(' ', '');
        }

        let combinedTitle = '';
        const pos = window.hoaplugin_data.time_position;

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

        return `
            <div class="event-item"
                 draggable="${(canEdit && window.hoaplugin_data.is_pro) ? 'true' : 'false'}"
                 data-event-id="${e.id}"
                 data-pivot-id="${e.pivot_id || e.id}"
                 data-move-id="${moveId || ''}"
                 data-event-date="${e.date}"
                 data-event-start-time="${e.start_time}"
                 data-is-single="${!!e.single}"
                 style="background-color: ${e.cat_color}; --event-bg: ${e.cat_color || '#ddd'};"
                 title="${e.flyer_url ? 'Click to open flyer' : 'Click for details'}"
                 onclick="activateEventDetailClick(event, ${e.instance_id})">
                <span class="event-title-text" style="flex:1; overflow:hidden; text-overflow:ellipsis;">
                    ${combinedTitle}
                </span>
                ${canEdit ? `
                    <span class="edit-pencil" onclick="event.stopPropagation(); window.handleEditClick(${e.id}, '${e.date}', '${e.start_time}', ${e.pivot_id || e.id}, ${moveId || 'null'})">✎</span>` : ''}
            </div>
        `;
    }).join('');
}



// Note that this function is shared between the monthly and the agenda apps so
// be sure to access Modal and content by class rather than id.
function showEventDetail(ev) {
    // 1. Identify which "Room" we are standing in
    const activeAppId = (window.hoaplugin_currentView === 'month') ? 'hoa-calendar-app' : 'hoa-agenda-app';
    const activeApp = document.getElementById(activeAppId);

    // 2. Find the modal and content area INSIDE that active app
    const activeModal = activeApp.querySelector('.hoa-detail-modal');
    const activeContent = activeApp.querySelector('.modal-content-area');

    if (!activeModal || !activeContent) {
        console.error("Could not find the Detail Modal in the active view.");
        return;
    }

    // Close the Day Modal (if it is open) to clear the screen
    const dayModal = document.getElementById('hoa-day-modal');
    if (dayModal) {
        dayModal.classList.remove('is-visible');
    }

    // Prepare the Flyer Thumbnail HTML for the Modal
    let flyerHtml = "";
    let thumbSrc = "";

    if (ev.flyer_url && ev.flyer_url.trim() !== "") {
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/i.test(ev.flyer_url);
        if (isImage) {
            thumbSrc = ev.flyer_url;
        } else {
            thumbSrc = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230288d1'%3E%3Cpath d='M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'/%3E%3C/svg%3E";
        }
          

        // 2. Build the "Flyer:" row
        flyerHtml = `
            <p style="margin:8px 0; display:flex; align-items:center; gap:10px;">
                <strong>📄 Flyer:</strong> 
                <span onclick="window.open('${ev.flyer_url}', '_blank')" 
                      style="display:inline-flex; align-items:center; cursor:pointer; background:#e3f2fd; padding:4px 8px; border-radius:4px; border:1px solid #0288d1; transition: background 0.2s;">
                    <img src="${thumbSrc}" style="width:24px; height:24px; object-fit:cover; border-radius:2px; margin-right:8px; border:1px solid #ccc;">
                    <span style="font-size:0.85rem; color:#0288d1; font-weight:bold;">View Flyer (PDF/Image)</span>
                </span>
            </p>
        `;
    }


    // 1. Format the Date for the header
    const dateObj = new Date(ev.date + 'T00:00:00');
    const fullDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    // 2. Conditional Price Logic
    // Only show if it's ticketed AND has a cost value
    const isTicketed = (ev.is_ticketed === true || ev.is_ticketed === 1);
    const showPrice = isTicketed && ev.cost && ev.cost.toLowerCase() !== 'free';
    const costHtml = showPrice ? `<p><strong>💰 Cost:</strong> ${ev.cost}</p>` : '';

    // 3. Ticket button logic
    const ticketHtml = (isTicketed) ?
        `<div style="margin: 20px 0;"><p>Ticketed Event.  Get tickets at front desk.</p> ${costHtml} </div>`: '';

    const webcal = getWebcalBtn(ev.pivot_id || ev.id);

    activeContent.innerHTML = `
        <div class="template-content" style="text-align:left; color:#333;">
            <h1 style="color:#000; font-size:1.8rem; margin-bottom:5px; border-bottom:2px solid ${ev.cat_color || '#ccc'}; padding-bottom:10px;">
                ${ev.title}
            </h1>

            <div class="event-meta" style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <p style="margin:5px 0;"><strong>📅 Date:</strong> ${fullDate}</p>
                <p style="margin:5px 0;"><strong>📍 Where:</strong> ${ev.location || 'Lodge'}</p>
                <p style="margin:5px 0;"><strong>⏰ When:</strong> ${ev.start_fmt} - ${ev.end_fmt}</p>
                <p style="margin:5px 0;"><strong> ${webcal}</strong></p>
                ${flyerHtml}
            </div>

            ${ticketHtml}

            <div class="event-description" style="line-height:1.6; font-size:1.1rem;">
                ${ev.description || '<em>No description provided.</em>'}
            </div>

            ${ev.setup_notes ? `
                <div class="setup-notes" style="margin-top:25px; padding-top:15px; border-top:1px dashed #ccc; font-style:italic; color:#666;">
                    <strong>Setup Notes:</strong><br>
                    ${ev.setup_notes}
                </div>
            ` : ''}
        </div>
    `;
    // Lock the background scrolling before showing.
    document.body.classList.add('modal-open');
    activeModal.classList.add('is-visible');
}

function closeDetailModal() {
    // Select all potential modals and hide them
    const modals = document.querySelectorAll('.hoa-full-modal, .hoa-detail-modal, .hoa-modal');
    modals.forEach(m => m.classList.remove('is-visible'));

    // Unlock background scrolling.
    document.body.classList.remove('modal-open');
}



function updateBackground(appContainer, year, month) {
    if (!appContainer) return;

    // Standardize the filename: cal-2026-03.png
    const monthPad = String(month + 1).padStart(2, '0');
    const fileName = `cal-${year}-${monthPad}.png`;
    const bgUrl = `${window.hoaplugin_data.bg_base_url}${fileName}?v=${window.hoaplugin_data.version}`;

    // The dynamic fallback endpoint
    const fallbackUrl = `${window.hoaplugin_data.ajax_url}?action=hoa_generate_fallback_bg&year=${year}&month=${month + 1}`;

    // Create a temporary image object to test if the Canva file exists
    const imgTest = new Image();

    imgTest.onload = function() {
        // Image exists! Use the Canva background
        window.hoaplugin_currentBackgroundUrl = bgUrl;
        applyBackgroundStyles(appContainer, bgUrl);
    };

    imgTest.onerror = function() {
        // Image missing (404)! Fallback to the generated SVG
        console.warn(`[HOAPLUGIN Calendar] Background image missing for ${year}-${monthPad}. Using SVG fallback.`);
        window.hoaplugin_currentBackgroundUrl = fallbackUrl;
        applyBackgroundStyles(appContainer, fallbackUrl);
    };

    // Trigger the load attempt
    imgTest.src = bgUrl;
}

// Helper function to keep things DRY
function applyBackgroundStyles(container, url) {
    container.style.backgroundImage = `url('${url}')`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'no-repeat';
}










/**
 * BRIDGING FUNCTIONS
 */
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


/**
 * Generates an icon with webcal:// URL for subscribing to an event
 */
function getWebcalBtn(eventId) {
    // Swap http/https for webcal protocol
    const baseUrl = window.hoaplugin_data.ajax_url.replace(/^https?:\/\//i, 'webcal://');
    const exportUrl = `${baseUrl}?action=hoa_export_event&event_id=${eventId}`;

    // ADDED onclick="event.stopPropagation()" so it doesn't trigger the row click!
    const exportBtn = `<a href="${exportUrl}" class="hoa-export-btn" title="Subscribe to Calendar" onclick="event.stopPropagation()">📅 Add to your Calendar</a>`;

    return exportBtn;
}


