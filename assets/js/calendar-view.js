//   -- calendar-view.js  --
window.config = {};
// note: fsb_config is injected by PHP and is not the same as window.config.  
window.allEvents = [];
window.grid; 
window.agendaContainer = null;
window.display = null;
window.currentView = 'month'; // 'month' or 'agenda'
window.iconLibrary = {};

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




document.addEventListener('DOMContentLoaded', function() {
    const monthlyApp = document.getElementById('fsb-calendar-app');
    const agendaApp = document.getElementById('fsb-agenda-app');

    grid = document.getElementById('calendar-grid');
    agendaContainer = document.getElementById('agenda-view');
    display = document.getElementById('currentMonthDisplay');

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

    const activeApp = monthlyApp || agendaApp;
    config = {
        jsonUrl: activeApp.dataset.jsonUrl,
        userEmail: activeApp.dataset.userEmail,
        isAdmin: activeApp.dataset.isAdmin === 'true',
        printJsUrl: fsb_config.print_js_url
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


    const printBtn = document.getElementById('printCal');
    printBtn.onclick = function() {
        // Check if the script is already loaded
        if (typeof openPrintPreview === 'function') {
            runPrint();
        } else {
            // Only load the print logic when clicked.
            // Inject the script tag dynamically
            const script = document.createElement('script');
            script.src = fsb_config.print_js_url + '?v=' + fsb_config.version;
            script.onload = () => runPrint();
            document.head.appendChild(script);
        }
        function runPrint() {
            openPrintPreview(
                window.currentYear,
                window.currentMonth,
                allEvents,
                window.currentBackgroundUrl
            );
        }
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





    // --- THE PIXEL-PERFECT HOVER ENGINE (MAGNIFIER) ---
    // This uses the actual coordinates of the split line to determine
    // which triangle the mouse is in, regardless of overlap.
    let activeShard = null;
    let lastTargetKey = null; // Stores "date-type" to prevent redundant re-draws

    document.addEventListener('mousemove', (e) => {
        if (grid.classList.contains('magnifier-disabled') || grid.classList.contains('is-dragging')) {
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
            el.classList.contains('fsb-ghost-shard') ||
            el.closest('.fsb-ghost-shard')
        );

        // 2. DETECTION: Look for the underlying split-cell
        const hoveredCell = elements.find(el =>
            el.classList.contains('split-cell') &&
            !el.classList.contains('fsb-ghost-shard')
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
        activeShard.className = `fsb-ghost-shard shard-${newShardType}`;
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

        const wrapper = document.getElementById('fsb-monthly-wrapper');
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
            const response = await fetch(config.jsonUrl);
            const data = await response.json();
            allEvents = data.events || [];
            window.eventInstances = {};
            // build an index of events so events can be passed by reference to instance_id.
            allEvents.forEach(ev => {
                eventInstances[ev.instance_id] = ev;
            });
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

        // Re-enable page scrolling
        document.body.classList.remove('fsb-agenda-mode');
        document.documentElement.classList.remove('fsb-agenda-mode');

        // Update Background & Grid (Passing the actual App div inside the wrapper)
        const monthlyApp = monthlyWrapper.querySelector('#fsb-calendar-app');
        updateBackground(monthlyApp, year, month);
        renderMonthGrid(monthlyApp);
    } 
    else if (currentView === 'agenda' && agendaWrapper) {
        // Show Agenda, Kill Monthly
        agendaWrapper.style.display = 'flex';
        if (monthlyWrapper) monthlyWrapper.style.display = 'none';

        // Disable page scrolling, let the agenda scroll
        document.body.classList.add('fsb-agenda-mode');
        document.documentElement.classList.add('fsb-agenda-mode');


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
    
    // The diaginal line for the split cells.
    const activeSVG = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="split-diagonal">
    <line x1="100" y1="0" x2="0" y2="100" stroke="#aaa" stroke-width="1" />
</svg>`;
    let splitStateClass = '';

    if (isPastA && isPastB) {
        splitStateClass = 'both-past';
    } else if (isPastA) {
        splitStateClass = 'top-past';
    }

    const evtsA = allEvents.filter(e => e.date === dateA);
    const evtsB = allEvents.filter(e => e.date === dateB);

    return `
    <div class="calendar-day split-cell ${splitStateClass}"
            data-date="${dateA}" data-date-top="${dateA}" data-date-bottom="${dateB}">

        <div class="split-line-container">${activeSVG}</div>

        <div class="split-half split-half-top ${isPastA ? 'past-day' : ''}"
             onclick="event.stopPropagation(); openDayModal('${dateA}')">

            <div class="events-layer layer-bg" aria-hidden="true">
                <div class="day-top" style="visibility: hidden;"></div>
                <div class="day-events">
                    ${renderEvents(evtsA.filter(e => !iconLibrary[e.category_id]))}
                </div>
            </div>
            <div class="events-layer layer-text">
                <div class="day-top" style="visibility: hidden;"></div>
                <div class="day-events">
                    ${renderEvents(evtsA.filter(e => !iconLibrary[e.category_id]))}
                </div>
            </div>

            <div class="day-top">
                <div class="day-number">${topDay}</div>
                <div class="day-icons-corner">${renderIcons(evtsA.filter(e => iconLibrary[e.category_id]), dateA)}</div>
                <div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateA}')">+</div>
            </div>
        </div>

        <div class="split-half split-half-bottom ${isPastB ? 'past-day' : ''}"
             onclick="event.stopPropagation(); openDayModal('${dateB}')">

            <div class="events-layer layer-bg" aria-hidden="true">
                <div class="day-events-bottom">
                    ${renderEvents(evtsB.filter(e => !iconLibrary[e.category_id]))}
                </div>
                <div class="day-bottom" style="visibility: hidden;"></div>
            </div>

            <div class="events-layer layer-text">
                <div class="day-events-bottom">
                    ${renderEvents(evtsB.filter(e => !iconLibrary[e.category_id]))}
                </div>
                <div class="day-bottom" style="visibility: hidden;"></div>
            </div>
            <div class="day-bottom">
                <div class="add-event-plus" onclick="event.stopPropagation(); openAddModal('${dateB}')">+</div>
                <div class="day-icons-corner">${renderIcons(evtsB.filter(e => iconLibrary[e.category_id]), dateB)}</div>
                <div class="day-number">${botDay}</div>
            </div>
        </div>
    </div>`;
}


// Helper to keep the icon HTML clean
function renderIcons(icons, dateStr) {
    return icons.map(e => {
        //  Only show the pencil if they have permission AND we aren't in the agenda
        const canEdit = 
            window.handleAddEventFromModal &&
            ((config.isAdmin || (e.owner_email && e.owner_email === config.userEmail))
            && currentView !== 'agenda');
        let svgContent = iconLibrary[e.category_id] || '';

        if (svgContent) {
            // We only need the color here; we've moved the click and height logic to the parent
            const colorAttr = `fill="${e.cat_color}" style="color:${e.cat_color};"`;
            svgContent = svgContent.replace('<svg', `<svg ${colorAttr}`);
        }

        return `
            <div class="corner-unit event-item"
                 title="${e.flyer_url ? 'Click to open flyer' : 'Click for details'}"
                 draggable="${canEdit ? 'true' : 'false'}"
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
            currentViewDate.setMonth(currentViewDate.getMonth() - 1);
            render();
        };
    }

    if (nextAgendaBtn) {
        nextAgendaBtn.onclick = () => {
            currentViewDate.setMonth(currentViewDate.getMonth() + 1);
            render();
        };
    }

    // 2. Calculate the Month Name
    const todayStr = new Date().toISOString().split('T')[0];
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentViewDate);

    // 3. Setup the skeleton inside the agenda container
    const sticky = agendaApp.querySelector('#agenda-sticky-header');
    console.log('sticky =', sticky, 'monthName =', monthName, ' currentViewDate=', currentViewDate);
    sticky.textContent = monthName;

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
        if (!iconLibrary[e.category_id]) {
            html += `
                <div class="agenda-row ${isToday ? 'agenda-today-row' : ''}"
                      onclick="activateEventDetailClick(event, ${e.instance_id})">
                    ${renderFlyerThumb(e)}
                    <div class="agenda-info">
                        <div class="agenda-main-line">
                            ${e.title}
                        </div>
                        <div class="agenda-time">⏰ ${e.start_fmt} - ${e.end_fmt}</div>
                        <div class="agenda-location">📍 ${e.location || 'Lodge'}</div>
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

    // CASE 1 — Image flyer
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
        thumbSrc = url;
    }

    // CASE 2 — PDF flyer
    else if (/\.pdf$/i.test(url)) {
        thumbSrc = fsb_config.pdf_icon || "/wp-content/plugins/fsbhoa-calendar/assets/img/pdf-icon.png";
    }

    // CASE 3 — Website URL → use favicon
    else if (/^https?:\/\//i.test(url)) {
        try {
            const urlObj = new URL(url);
            thumbSrc = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
        } catch (err) {
            // fallback favicon
            thumbSrc = `https://www.google.com/s2/favicons?domain=fsbhoa.com&sz=128`;
        }
    }

    // CASE 4 — Unknown type → fallback icon
    else {
        thumbSrc = fsb_config.flyer_fallback || "/wp-content/plugins/fsbhoa-calendar/assets/img/flyer-icon.png";
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

    const data = eventInstances[instanceId];
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
    const modal = document.getElementById('fsb-day-modal');
    const content = document.getElementById('fsb-modal-content');

    // Find the events for this date from our global array
    const events = allEvents.filter(e => e.date === dateStr);

    const dateObj = new Date(dateStr + 'T00:00:00');
    const title = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const dayIcons = events;

    // heading
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-right:30px;">

            <div style="display:flex; align-items:center; gap:15px;">
                <h3 style="margin:0;">Events for ${title}</h3>
    
                <div class="day-modal-header-icons" style="display:flex; gap:8px;">
                    ${renderIcons(dayIcons, dateStr)}
                </div>
            </div>

            ${config.isAdmin ? `
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
            const canEdit = config.isAdmin || 
                (e.owner_email && e.owner_email.toLowerCase() === config.userEmail.toLowerCase());

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

        return `
            <div class="event-item"
                 draggable="${canEdit ? 'true' : 'false'}"
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
    const activeAppId = (currentView === 'month') ? 'fsb-calendar-app' : 'fsb-agenda-app';
    const activeApp = document.getElementById(activeAppId);

    // 2. Find the modal and content area INSIDE that active app
    const activeModal = activeApp.querySelector('.fsb-detail-modal');
    const activeContent = activeApp.querySelector('.modal-content-area');

    if (!activeModal || !activeContent) {
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

    if (ev.flyer_url && ev.flyer_url.trim() !== "") {
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/i.test(ev.flyer_url);
        if (isImage) {
            thumbSrc = ev.flyer_url;
        } else {
            try {
                const urlObj = new URL(ev.flyer_url);
                thumbSrc = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
            } catch(err) {
                thumbSrc = `https://www.google.com/s2/favicons?domain=fsbhoa.com&sz=128`;
            }
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

    activeContent.innerHTML = `
        <div class="template-content" style="text-align:left; color:#333;">
            <h1 style="color:#000; font-size:1.8rem; margin-bottom:5px; border-bottom:2px solid ${ev.cat_color || '#ccc'}; padding-bottom:10px;">
                ${ev.title}
            </h1>

            <div class="event-meta" style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <p style="margin:5px 0;"><strong>📅 Date:</strong> ${fullDate}</p>
                <p style="margin:5px 0;"><strong>📍 Where:</strong> ${ev.location || 'Lodge'}</p>
                <p style="margin:5px 0;"><strong>⏰ When:</strong> ${ev.start_fmt} - ${ev.end_fmt}</p>
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
    const modals = document.querySelectorAll('.fsb-full-modal, .fsb-detail-modal, .fsb-modal');
    modals.forEach(m => m.classList.remove('is-visible'));

    // Unlock background scrolling.
    document.body.classList.remove('modal-open');
}



function updateBackground(appContainer, year, month) {
    if (!appContainer) return;

    // Standardize the filename: cal-2026-03.png
    const monthPad = String(month + 1).padStart(2, '0');
    const fileName = `cal-${year}-${monthPad}.png`;
    const bgUrl = `${fsb_config.bg_base_url}${fileName}?v=${fsb_config.version}`;

    // Apply the background
    window.currentBackgroundUrl = bgUrl;  // for print functions
    appContainer.style.backgroundImage = `url('${bgUrl}')`;
    appContainer.style.backgroundSize = 'cover';
    appContainer.style.backgroundPosition = 'no-repeat';
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



