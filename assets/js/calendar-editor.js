//   -- calendar-editor.js --
window.draggedData = null; // Global Drag State



document.addEventListener('DOMContentLoaded', function() {

    const addBtn = document.getElementById('addNewEvent');
    if (addBtn) {
        addBtn.onclick = () => {
            // Just pass the current date string
            const dateStr = currentViewDate.toISOString().split('T')[0];
            openEditModal(dateStr);
        };
    }

    /* --- Drag & Drop --- */

    document.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.event-item');
        if (!chip) return;


        // Assign the data once
        draggedData = {
            id: chip.dataset.eventId,
            pivotId: chip.dataset.pivotId,
            moveId: chip.dataset.moveId,
            originalDate: chip.dataset.eventDate,
            originalStartTime: chip.dataset.eventStartTime,
            isSingle: chip.dataset.isSingle === 'true'
        };

        // Update the UI state
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
        // --- MOVE CLEANUP TO THE TOP ---
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        const grid = document.getElementById('calendar-grid');
        const appContainer = document.getElementById('fsb-calendar-app');
        grid.classList.remove('is-dragging');
        appContainer.classList.remove('header-drop-active');
        // -------------------------------
        console.log("DROP DETECTED"); // Check if the drop is even firing
        
        const isShift = e.shiftKey;

        // 1. Clean up UI immediately
        grid.classList.remove('is-dragging');
        appContainer.classList.remove('header-drop-active');

        if (!draggedData) {
            console.log("DROP ABORTED: No draggedData");
            return;
        }

        // 2. Check if we are in the Header (The top 14%)
        const rect = appContainer.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const isInHeader = relativeY >= 0 && relativeY < (rect.height * 0.14);

        if (isInHeader) {
            const ev = allEvents.find(e => e.id == draggedData.id && e.date == draggedData.originalDate);
            const isRecurring = ev && ev.rrule && ev.rrule.trim() !== '';

            let mode;
            if (draggedData.isSingle) {
                // It's a one-time event: Kill the root record
                mode = 'master_delete';
            } else {
                // It's a series: Determine if we are ending it or just poking a hole
                mode = isShift ? 'series_end' : 'instance_cancel';
            }
            console.log(`FSBHOA: Header Drop [${mode}] for ID ${draggedData.id}`);

            // Pass all IDs to ensure PHP has what it needs
            const msg = draggedData.isSingle
                ? "Delete this one-time event forever?"
                : (isShift ? "End this series forever starting today?" : "Cancel ONLY this instance?");

            if (confirm(msg)) {
                await saveEventChanges(mode, draggedData.id, draggedData.originalDate, false);
            }

            // Reset state and exit
            draggedData = null;
            return;
        }

        // 3. Day Cell Reschedule
        const cell = e.target.closest('.calendar-day');
        if (cell && !cell.classList.contains('empty')) {
            console.log("DROPPED ON CELL:", cell.dataset.date);

            let targetDate = cell.dataset.date;
            if (cell.classList.contains('split-cell')) {
                const cellRect = cell.getBoundingClientRect();
                const mouseX = e.clientX - cellRect.left;
                const mouseY = e.clientY - cellRect.top;

                // In a square/rect split by a \ line:
                // If (relativeX / width) + (relativeY / height) > 1, we are in the bottom-right.
                const isBottom = (mouseX / cellRect.width) + (mouseY / cellRect.height) > 1;

                targetDate = isBottom ? cell.dataset.dateBottom : cell.dataset.dateTop;
                console.log(`FSBHOA: Split Cell Drop Detected. Target: ${isBottom ? 'Bottom' : 'Top'} (${targetDate})`);
            }

            if (targetDate !== draggedData.originalDate || e.shiftKey) {
                console.log("CALLING SUBMIT RESCHEDULE for:", targetDate);
                submitReschedule(draggedData.id, draggedData.originalDate, draggedData.pivotId, draggedData.moveId, targetDate, e.shiftKey);
            } else {
                console.log("DROP ABORTED: Not a valid cell", e.target);
            }
        }

        draggedData = null;
    });


    document.addEventListener('dragend', () => {
        document.getElementById('calendar-grid').classList.remove('is-dragging');
        document.getElementById('fsb-calendar-app').classList.remove('header-drop-active');
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        draggedData = null;
        grid.classList.remove('is-dragging');
    });


});





function openEditModal(selectedDate, selectedTime, eventId = null, pivot_id = null, move_id = null, fetchedData = null, isAuditLog = false) {
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

    const isManualAdd = !selectedDate;
    const activeDate = selectedDate || new Date().toISOString().split('T')[0];

    // Format the display date for the header (only if we have one)
    const displayDate = new Date(activeDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    // ---  Conditional Date UI ---
    // If manual add, show a picker. Otherwise, show the static formatted date.
    const dateSelectorHtml = isManualAdd
        ? `<div style="margin-top: 8px;">
            <label style="font-size: 0.8rem; display:block; margin-bottom:2px;">Select Event Date:</label>
            <input type="date" name="date" id="manual_date_input" value="${activeDate}" style="padding:4px; font-size:0.9rem;">
           </div>`
        : `<div style="font-size: 0.9rem; font-weight: 600; margin-top: 4px;">Date: ${displayDate}</div>
           <input type="hidden" name="date" value="${selectedDate}">`;



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
                ${dateSelectorHtml} ${baseDateInfo}
            </div>

            <input type="hidden" name="event_id" value="${eventId || ''}">
            <input type="hidden" name="pivot_id" value="${pivot_id || ''}">
            <input type="hidden" name="move_id" value="${move_id || ''}">
            <input type="hidden" id="edit_mode" name="edit_mode" value="standard">

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
                    <input type="time" name="start_time" value="${selectedTime || '09:00'}">
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

                ${(eventId && !isAuditLog) ? `
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
    const originalStartTimeInput = form.querySelector('input[name="start_time"]');
    const originalTime = originalStartTimeInput ? originalStartTimeInput.value : '09:00';

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
            openRescheduleDialog(result.data, eventDate, pivotId, moveId, originalTime);
        }
    }
}

function openRescheduleDialog(eventData, clickedDate, pivotId = null, moveId = null, originalTime = '09:00') {
    const modal = document.getElementById('fsb-reschedule-modal');
    const container = document.getElementById('reschedule-form-container');

    console.log(`Reschedule Dialog OPEN: Receiving Pivot: ${pivotId}, Move: ${moveId}`);

    const isRecurring = !!eventData.rrule;
    const titleText = isRecurring ? `Reschedule Series Event: ${eventData.title}` : `Reschedule single instance: ${eventData.title}`;
    const scopeOptionsHtml = isRecurring ? `
        <div style="margin-top:15px; font-size: 0.9rem; padding:10px; background:#fff3e0; border:1px solid #ffe0b2; border-radius:4px;">
            <strong>Apply Move To:</strong><br>
            <label style="display:block; cursor:pointer; margin-top:5px;">
                <input type="radio" name="res_scope" id="scope_instance" value="instance" checked>
                Only this specific instance (${clickedDate})
            </label>
            <label style="display:block; cursor:pointer; margin-top:5px;">
                <input type="radio" name="res_scope" id="scope_remaining" value="remaining">
                This and all future instances in the series
            </label>
        </div>
    ` : `
        <p style="font-size: 0.75rem; color: #ed6c02; margin-top:15px; font-style:italic;">
            * This move only affects this specific event.
        </p>
    `;

    container.innerHTML = `
        <div style="padding: 15px;">
            <h3 style="margin-top:0;">${titleText}</h3>
            <p style="font-size: 0.9rem; color: #666;">Original: ${clickedDate} @ ${formatTimeAMPM(originalTime)}</p>

            <div class="form-group">
                <label>New Date</label>
                <input type="date" id="res_date" value="${clickedDate}" style="width:100%;">
            </div>

            <div class="form-group" style="margin-top:10px;">
                <label>New Start Time</label>
                <input type="time" id="res_time" value="${originalTime}" style="width:100%;">
            </div>

            ${scopeOptionsHtml}

            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="button" class="fsb-save-btn" onclick="
                    const newDate = document.getElementById('res_date').value;
                    const newTime = document.getElementById('res_time').value;
                    const isShift = document.getElementById('scope_remaining') ? document.getElementById('scope_remaining').checked : false;
                    submitReschedule(${eventData.id}, '${clickedDate}', ${pivotId || 'null'}, ${moveId || 'null'}, newDate, isShift, newTime);
                ">Confirm Move</button>
            </div>
        </div>
    `;
    modal.classList.add('is-visible');
}

// Helper to convert 24h DB time to the correct display format based on HOA settings
function formatTimeAMPM(time24) {
    if (!time24) return (window.fsb_config.time_format === '24hr') ? '00:00' : '12:00 AM';

    // If the admin wants 24-hour time, just return the raw DB string!
    if (window.fsb_config.time_format === '24hr') {
        return time24;
    }

    // Otherwise, do the standard 12-hour math
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Converts '0' to '12'
    return `${hours}:${minutes} ${ampm}`;
}

async function submitReschedule(id, origDate, pivotId, moveId, newDate, isShift = false, newTime = null) {
    // Determine the new time.
    // For a drag-drop, we usually keep the original start time.
    let startTime = "09:00"; // Absolute fallback

    if (newTime) {
        // Priority 1: Time passed explicitly from the Reschedule Modal
        startTime = newTime;
    } else if (draggedData && draggedData.id == id) {
        // Use the time grabbed during dragstart
        startTime = draggedData.originalStartTime;
    } else {
        // Look up the time in the global array (for Modal-based moves)
        const event = allEvents.find(e => e.id == id && e.date == origDate);
        if (event && event.start_time) {
            startTime = event.start_time;
        }
    }

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

        // Close the Reschedule Modal
        const resModal = document.getElementById('fsb-reschedule-modal');
        if (resModal) {
            resModal.classList.remove('is-visible');
            document.body.classList.remove('modal-open');
        }

        // Refresh to show the new "Bake"
        if (window.loadData) {
            window.loadData();
        }
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
        // Close the manage modal immediately for better UI feel
        const manageModal = document.getElementById('fsb-manage-modal');
        await saveEventChanges(mode, id, date, false);
        // saveEventChanges already handles the redirect/refresh
    }
}




/**
 * Helper to bridge the Day Modal to the New Event Form
 * Called when the + operator is clicked.
 */
function handleAddEventFromModal(dateStr) {
    const dayModal = document.getElementById('fsb-day-modal');
    if (dayModal) {
        dayModal.classList.remove('is-visible');
    }

    // Call your existing function that opens the blank "Add" form
    // Assuming it's named openAddModal or openEditModal(dateStr, null...)
    if (typeof openAddModal === 'function') {
        openAddModal(dateStr);
    } else {
        // If you use the same modal for add/edit:
        openEditModal(dateStr, null, null, null, null);
    }
}


// Helper to bridge the Modal to the Edit Form
async function handleEditClick(id, dateStr, timeStr, pivot_id, move_id = null, isAuditLog = false) {
    //console.log("Pencil clicked. Closing Day Modal and fetching ID:", id," (Move: ", move_id, " Pivot: ", pivot_id," )");
    const dayModal = document.getElementById('fsb-day-modal');
    if (dayModal) {
        dayModal.classList.remove('is-visible');
    }

    try {
        const response = await fetch(`${fsb_config.ajax_url}?action=fsb_get_event_details&event_id=${id}&nonce=${fsb_config.nonce}`);
        const result = await response.json();

        if (result.success) {
            // now get the current rrule.
            if (pivot_id && pivot_id !== 'null' && pivot_id != id) {
                const pivotResponse = await fetch(`${fsb_config.ajax_url}?action=fsb_get_event_details&event_id=${pivot_id}&nonce=${fsb_config.nonce}`);
                const pivotResult = await pivotResponse.json();

                if (pivotResult.success && pivotResult.data.rrule) {
                    // Override the master's original rrule with the pivot's active rrule
                    result.data.rrule = pivotResult.data.rrule;
                }
            }
            // 2. Pass the freshly fetched data to the modal builder
            openEditModal(dateStr, timeStr, id, pivot_id, move_id, result.data, isAuditLog);
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
            body: formData,
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success) {
            if (silent) return true;

            // ---------------------------------------------------------
            // Admin Check for the Audit Log
            // If we are in the WP Admin backend, reload to refresh the PHP table
            // ---------------------------------------------------------
            if (window.config && window.config.isDashboard) {
                window.location.reload();
                return true;
            }

            //  Close all possible modals after a successful action
            const allModals = document.querySelectorAll('.fsb-modal, .fsb-full-modal');
            allModals.forEach(m => m.classList.remove('is-visible'));
            document.body.classList.remove('modal-open');

            // After a slight delay for database write, refresh the grid
            setTimeout(() => {
                if (window.loadData) { 
                    window.loadData(); // Refresh the grid
                }
            }, 100);

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
 * BRIDGING FUNCTIONS
 */

function openAddModal(dateStr) {
    console.log("Admin clicked [+] for date:", dateStr);
    // We reuse the existing openEditModal logic, 
    // passing null for the ID to trigger a "New Event" form
    openEditModal(dateStr);
}


// Ensure handleEditClick is available globally if needed by other modules
window.handleEditClick = handleEditClick;
window.openAddModal = openAddModal;


