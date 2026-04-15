// calendar-data.js
//
function buildMonthLayout(year, month) {
    const firstDay = new Date(year, month, 1).getDay();   // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const isSatStart31 = (firstDay === 6 && daysInMonth === 31);
    const isSatStart30 = (firstDay === 6 && daysInMonth === 30);
    const isFriStart31 = (firstDay === 5 && daysInMonth === 31);

    let dayArray = new Array(32).fill(null);
    let cellArray = new Array(35).fill(null).map(() => ({ top: null, bottom: null }));


    //
    // CASE 1 — August 2026 (Saturday start, 31 days)
    //          Split cell 6 (day 1 & 8)
    //
    if (isSatStart31) {
        // Fill days 2–30 normally to cells 0-5.
        for (let d = 2; d <= 7; d++) {
            dayArray[d] = d - 2; 
            cellArray[d - 2] = { top: d, bottom: null };
        }

        // split: cell 6 → days 1 and 8
        cellArray[6] = { top: 1, bottom: 8 };
        dayArray[1] = 6;
        dayArray[8] = 6;

        // Fills days 9-31 into cells 7 to 29.
        for (let d = 9; d <= 31; d++) {
            dayArray[d] = d - 2;
            cellArray[d - 2] = { top: d, bottom: null };
        }


        return {
            year,
            month,
            dayArray,
            cellArray,
            firstDay,
            daysInMonth
        };
    }

    //
    // CASE 2 — Standard months
    //
    for (let i = 0; i < 35; i++) {
        const dayNum = i - firstDay + 1;
        if (dayNum >= 1 && dayNum <= daysInMonth) {
            dayArray[dayNum] = i;   // day → cell index
            cellArray[i] = { top: dayNum, bottom: null};
        }
    }

    //
    // Standard split-day logic
    //
    // Split always occurs at index 28
    //
    if (isSatStart30) {
        // 30-day month starting on Saturday → split 23 / 30
        cellArray[28] = { top: 23, bottom: 30};
        dayArray[23] = 28;
        dayArray[30] = 28;
    }

    if (isFriStart31) {
        // 31-day month starting on Friday → split 24 / 31
        cellArray[28] = { top: 24, bottom: 31};
        dayArray[24] = 28;
        dayArray[31] = 28;

    }

    return {
        year,
        month,
        dayArray,
        cellArray,
        firstDay,
        daysInMonth
    };
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
