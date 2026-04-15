// calendar-print.js

// Main print routine
function openPrintPreview(year, month, events, bgUrl) {
    //console.log("PRINT: openPrintPreview called", year, month, events, bgUrl);

    const layout = buildMonthLayout(year, month);
    const eventLayout = buildEventLayout(events || [], layout);
    const htmlMap = renderPrintEvents(eventLayout);
    const gridHtml = renderPrintGrid(layout, htmlMap);



    let printWin = window.open("", "PrintWindow", "width=800,height=600");
    if (!printWin) return;
    printWin.iconLibrary = window.iconLibrary;
    printWin.document.open();
    printWin.document.write(`
        <html>
        <head>
            <title>Print Calendar</title>
            <style>
                @page {
                    size: 17in 11in;
                    margin: 0;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .print-canvas {
                    width: 1700px;
                    height: 1100px;
                    background-image: url("${bgUrl}");
                    background-repeat: no-repeat;
                    background-size: 1700px 1100px;
                    background-position: top left;
                    position: relative;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .grid-lines {
                    position: absolute;
                    top: 154px;
                    left: 0;
                    width: 1700px;
                    height: 946px;
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    grid-template-rows: repeat(5, 1fr);
                }

                .day-cell {
                    position: relative;
                    box-sizing: border-box;
                    padding: 0;
                    margin: 0;
                    overflow: hidden;
                }

                .day-events {
                    position: relative;
                    margin-top: 0px;
                    padding: 0 4px;
                    overflow: hidden;
                }

                .event-time {
                    font-weight: bold;
                    margin-right: 4px;
                }
                
                /* Individual event rows: wrap text but do NOT expand vertically */
                .print-event {
                    display: block;              /* one per line */
                    margin: 2px 0 0 0;
                    overflow: hidden;
                }

                .print-event-label {
                    display: inline-block;       /* background hugs text */
                    font-size: 12px;
                    line-height: 1.1em;
                    max-height: 2.2em;           /* still caps height */
                    padding: 0 4px;
                    white-space: normal;         /* allow wrapping */
                    background-color: var(--event-color);
                    border-radius: 3px;
                    box-sizing: border-box;
                }

                .day-header {
                    position: relative;
                    text-align: center;
                    height: 22px; /* same height as your day-number area */
                }

                .day-number {
                    position: absolute;
                    top: 3px;
                    left: 6px;
                    font-size: 18px;
                    font-weight: bold;
                    color: #000;
                    z-index: 10;
                }

                .day-icons,
                .day-icons-top,
                .day-icons-bottom {
                    display: inline-flex;
                    gap: 4px;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                }

                .day-icon {
                    width: 16px;
                    height: 16px;
                    object-fit: contain;
                }

                /* SPLIT CELL positioning */

                .split-cell {
                    display: flex;
                    flex-direction: column;
                }

                .split-top {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    border-bottom: 1px solid rgba(0,0,0,0.6);
                }

                .split-bottom {
                    flex: 1;                     /* REQUIRED */
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                }

                /* Events in bottom half */
                .split-bottom-events {
                    flex: 1 1 auto;              /* natural height, no stretching */
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    overflow: hidden;
                    padding: 0 4px;
                    margin-bottom: 2px;
                }

                /* Header pushed to bottom */
                .split-bottom .day-header {
                    margin-top: auto;            /* THIS pushes header to bottom */
                }

                /* Day number positioning */
                .split-top .day-header .day-number {
                    top: 3px;
                    bottom: auto;
                }

                .split-bottom .day-header .day-number {
                    top: auto;
                    bottom: 3px;
                }

            </style>
        </head>
        <body>
            <div class="print-canvas">
                <div class="grid-lines">
                    ${gridHtml}
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 600);
                };
            </script>
        </body>
        </html>
    `);

    printWin.document.close();

    // Inject events into the already-written grid
    setTimeout(() => {
        const cells = printWin.document.querySelectorAll('.day-cell');

        for (let i = 0; i < 35; i++) {
            const cell = cells[i];
            if (!cell) continue;

            const map = htmlMap[i];

            if (map.normal) {
                const c = cell.querySelector(".day-events");
                if (c) c.innerHTML = map.normal;
            }
            if (map.top) {
                const c = cell.querySelector(".split-top-events");
                if (c) c.innerHTML = map.top;
            }
            if (map.bottom) {
                const c = cell.querySelector(".split-bottom-events");
                if (c) c.innerHTML = map.bottom;
            }
        }
    }, 50);
}


// Build the print grid HTML (35 cells, with split support)
function renderPrintGrid(layout, htmlMap) {
    const { dayArray, cellArray } = layout;

    let html = "";

    for (let i = 0; i < 35; i++) {
        const {top, bottom} = cellArray[i];

        if (bottom === null) {
            // Normal cell
            html += `
                <div class="day-cell">
                  <div class="day-header">
                      <span class="day-number">${top}</span>
                      <div class="day-icons">${htmlMap[i].icons}</div>
                  </div>
                  <div class="day-events"></div>
              </div>
            `;
        } else {
            // Split cell
            html += `
                <div class="day-cell split-cell">
                    <div class="split-top">
                        <div class="day-header">
                            <span class="day-number">${top}</span>
                            <div class="day-icons-top">${htmlMap[i].iconsTop}</div>
                        </div>
                        <div class="split-top-events"></div>
                    </div>
                    <div class="split-bottom">
                        <div class="split-bottom-events"></div>
                        <div class="day-header">
                            <span class="day-number">${bottom}</span>
                            <div class="day-icons-bottom">${htmlMap[i].iconsBottom}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    return html;
}

// Build event mapping for each cell (normal + split)
// calendar-print.js

function renderPrintEvents(eventLayout) {
    const { cellEvents } = eventLayout;

    // Build a parallel array of HTML buckets
    let htmlMap = new Array(35).fill(null).map(() => ({
        normal: "",
        top: "",
        bottom: "",
        icons: "",
        iconsTop: "",
        iconsBottom: ""
    }));

    for (let i = 0; i < 35; i++) {
        const events = cellEvents[i];
        if (!events || events.length === 0) continue;

        for (const entry of events) {
            const ev = entry.event;
            const color = ev.color || "#888";

            //console.log("ev = ", JSON.stringify(ev, null, 2));



            // If this event has an icon, append it to the correct bucket
            const catId = ev.raw?.category_id || ev.category_id;
            const svgPath = iconLibrary[catId];

            if (svgPath) {
                const iconHtml = `
                    <svg class="day-icon" viewBox="0 0 24 24" fill="${ev.color || '#000'}">
                        <path d="${svgPath}"></path>
                    </svg>
                `;

                if (entry.target === "normal") {
                    htmlMap[i].icons += iconHtml;
                } else if (entry.target === "top") {
                    htmlMap[i].iconsTop += iconHtml;
                } else if (entry.target === "bottom") {
                    htmlMap[i].iconsBottom += iconHtml;
                }

                continue; // skip text rendering
            }




            // Smart Time Logic (e.g., "9a" or "9:30p")
            let timeStr = '';
            if (ev.start_fmt) {
                timeStr = ev.start_fmt.toLowerCase().replace(':00', '').replace(' ', '');
            }

            let combinedTitle = '';
            const pos = fsb_config.time_position;

            if (pos === 'prepend') {
                combinedTitle = `<span style="font-weight:900;">${timeStr}</span> ${ev.title}`;
            } else if (pos === 'append') {
                combinedTitle = `${ev.title} <span style="font-weight:900;">${timeStr}</span>`;
            } else {
                combinedTitle = ev.title;
            }




            const eventHtml = `
                <div class="print-event">
                    <span class="print-event-label" style="background-color: ${color}">
                        ${combinedTitle}
                    </span>
                </div>
            `;


            if (entry.target === "normal") {
                htmlMap[i].normal += eventHtml;
            } else if (entry.target === "top") {
                htmlMap[i].top += eventHtml;
            } else if (entry.target === "bottom") {
                htmlMap[i].bottom += eventHtml;
            }
        }
    }

    return htmlMap;
}


// Simple HTML escaper for safety
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[m];
    });
}

