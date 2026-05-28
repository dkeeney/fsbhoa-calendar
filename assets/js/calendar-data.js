// calendar-data.js
//
function buildMonthLayout(year, month) {
    const rawFirstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = parseInt(window.fsb_config.start_day) || 0; // 0=Sun, 1=Mon

    let mode = 'standard';
    if (startOffset === 0) { // SUNDAY START
        if (rawFirstDay === 5 && daysInMonth === 31) mode = 'bottom_left_single';
        else if (rawFirstDay === 6 && daysInMonth === 30) mode = 'bottom_left_single';
        else if (rawFirstDay === 6 && daysInMonth === 31) mode = 'top_right_single';
    } else { // MONDAY START
        if (rawFirstDay === 6 && daysInMonth === 31) mode = 'top_right_double';
        else if (rawFirstDay === 0 && daysInMonth === 30) mode = 'top_right_single';
        else if (rawFirstDay === 0 && daysInMonth === 31) mode = 'top_right_single';
    }

    let dayArray = new Array(32).fill(null);
    let cellArray = new Array(35).fill(null).map(() => ({ top: null, bottom: null }));
    let offset = (rawFirstDay - startOffset + 7) % 7;

    if (mode === 'bottom_left_single') {
        let topDay = (daysInMonth === 31) ? 24 : 23;
        cellArray[28] = { top: topDay, bottom: daysInMonth };
        dayArray[topDay] = 28;
        dayArray[daysInMonth] = 28;
        for (let d = 1; d <= daysInMonth; d++) {
            if (d === topDay || d === daysInMonth) continue;
            cellArray[offset + d - 1] = { top: d, bottom: null };
            dayArray[d] = offset + d - 1;
        }
    }
    else if (mode === 'top_right_single') {
        cellArray[6] = { top: 1, bottom: 8 };
        dayArray[1] = 6;
        dayArray[8] = 6;
        let d = 2;
        for (let i = 0; i < 35; i++) {
            if (i === 6) continue;
            if (d === 8) d++;
            if (d <= daysInMonth) {
                cellArray[i] = { top: d, bottom: null };
                dayArray[d] = i;
                d++;
            }
        }
    }
    else if (mode === 'top_right_double') {
        cellArray[5] = { top: 1, bottom: 8 };
        dayArray[1] = 5;
        dayArray[8] = 5;
        cellArray[6] = { top: 2, bottom: 9 };
        dayArray[2] = 6;
        dayArray[9] = 6;
        let d = 3;
        for (let i = 0; i < 35; i++) {
            if (i === 5 || i === 6) continue;
            if (d === 8 || d === 9) d++;
            if (d <= daysInMonth) {
                cellArray[i] = { top: d, bottom: null };
                dayArray[d] = i;
                d++;
            }
        }
    }
    else { // STANDARD
        for (let d = 1; d <= daysInMonth; d++) {
            cellArray[offset + d - 1] = { top: d, bottom: null };
            dayArray[d] = offset + d - 1;
        }
    }

    return { year, month, dayArray, cellArray, firstDay: rawFirstDay, daysInMonth };
}





function buildEventLayout(events, layout) {
    const { year, month, dayArray, cellArray } = layout;

    // Prepare 35 buckets, indexed by cell number
    let cellEvents = new Array(35).fill(null).map(() => []);

    if (!Array.isArray(events)) return { cellEvents };

    // Filter events to the current month
    const eventsThisMonth = events.filter(ev => {
        if (!ev || !ev.date) return false;
        const [y, m] = ev.date.split("-").map(Number);
        return y === year && m === month + 1;   // month = 0–11
    });

    for (const ev of eventsThisMonth) {
        if (!ev || !ev.date) continue;

        // Extract day number from YYYY-MM-DD
        const day = parseInt(ev.date.split("-")[2], 10);
        if (!day) continue;


        // Build a normalized event object for renderers
        const normalized = {
            id: ev.id,
            title: ev.title,
            location: ev.location,
            color: ev.cat_color || "#888",
            start_time: ev.start_time,
            end_time: ev.end_time,
            start_fmt: ev.start_fmt,
            end_fmt: ev.end_fmt,
            flyer_url: ev.flyer_url,
            description: ev.description,
            raw: ev
        };

        const cellIndex = dayArray[day];
        if (cellIndex == null) continue;
        const {top, bottom} = cellArray[cellIndex];

        if (bottom == null) {
            // Normal cell
            cellEvents[cellIndex].push({
                target: "normal",
                event: normalized
            });
        } else if (day === top) {
            cellEvents[cellIndex].push({
                target: "top",
                event: normalized
            });
        } else if (day === bottom) {
            cellEvents[cellIndex].push({
                target: "bottom",
                event: normalized
            });
        }
    }

    //
    // Sort events inside each cell by start_time
    //
    for (let i = 0; i < 35; i++) {
        cellEvents[i].sort((a, b) => {
            const t1 = a.event.start_time || "00:00";
            const t2 = b.event.start_time || "00:00";
            return t1.localeCompare(t2);
        });

        // Assign vertical stacking order
        cellEvents[i].forEach((entry, idx) => {
            entry.order = idx;
        });
    }

    return { cellEvents };
}



window.FSB_CAL = window.FSB_CAL || {};
window.FSB_CAL.buildMonthLayout = buildMonthLayout;
window.FSB_CAL.buildEventLayout = buildEventLayout;
