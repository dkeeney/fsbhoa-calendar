<h1 align="center">HOAplugin Calendar User Manual</h1>
<p align="center"><small>June 14, 2026</small></p>

---

# Chapter 1: Getting Started

Welcome to the complete website calendar tailored specifically for HOA communities. This guide will walk you through the initial setup, ensuring your calendar is perfectly configured for your residents.

![HOAplugin Calendar Dashboard Workspace Layout](assets/images/screenshot-pro-license.png)

---

## 1.1 Downloading and Installing the Plugin

The HOAplugin Calendar operates on a "Core + Pro" system. The free base version provides the essential calendar framework, while the Pro version connects to your license account to unlock premium features and automatic updates.

### Installing the Free Base Version
The free version does not require a license account to download.

1. **Option A (WordPress Library):** Log in to your WordPress Admin Dashboard on your website. Navigate to **Plugins > Add New**, search for "HOAplugin Calendar", and click **Install Now**.
2. **Option B (Manual Download):** Go to [HOAplugin.com](https://hoaplugin.com) and click the download link for the free base version. In your WordPress Dashboard, navigate to **Plugins > Add New > Upload Plugin**, select the `.zip` file you downloaded, and click **Install Now**.
3. Once installed, click **Activate**.

### Upgrading to the Pro Version
To unlock premium features like visual drag-and-drop rescheduling, 11x17 PDF printing, and over-the-air dashboard updates, you must purchase a Pro License key (available as an unlimited lifetime license or a flexible monthly subscription). 

The installation process is fully automated. You do not need to deal with downloading or uploading a second plugin file!

1. Go to [HOAplugin.com](https://hoaplugin.com) and purchase the Pro version. 
2. During checkout, provide your email address. You will instantly receive an emailed receipt containing your unique **Pro License Code**. *(You can also retrieve this code at any time by logging into the "Manage License" portal directly on the license server).*
3. Log in to your target WordPress Admin Dashboard.
4. Click on the **HOAplugin Calendar** tab in your left-hand menu, and select the **Pro License** tab located at the top of the settings page.
5. Paste your license code into the input box and click the **Install and activate HOAplugin Calendar Pro** button. 

The system will securely authenticate your key, automatically download the necessary upgrade packages from the server, and activate your premium features in seconds. 

> **Administrators on a WordPress Multisite:** If you manage a complex network of multiple community sub-sites, you can purchase multiple Pro license slots and utilize a single Pro license code across all of your sites. The plugin will maintain a completely isolated database for each individual HOA website. Through the central license portal, you can easily map, add, or revoke the specific websites assigned to each of your purchased license slots.

---

## 1.2 Configuring Your Core Settings

Once activated, you will see a new **HOAplugin Calendar** menu item in your WordPress dashboard (look for the custom calendar icon). Click this to open your primary Configuration panel.

The first tab displayed is **Settings**. This controls the fundamental behavior and layout rules of your community's grid.

### Baking & Data Configuration
To keep the calendar loading lightning-fast for hundreds of residents simultaneously, it "bakes" a flat snapshot of your raw database events into a highly optimized JSON file. 
* **Past Months (Default: 1):** Determines how far back in time residents can navigate to view historical community events.
* **Future Months (Default: 12):** Determines how far into the future the calendar compiler will look forward to calculate and display upcoming events. 

### Display Preferences
Customize exactly how the calendar matrix renders to your public visitors.
* **Calendar Start Day:** Choose whether your weekly grid rows begin on **Sunday** or **Monday**.
* **Time Format:** Select standard **12-Hour** (e.g., 1:00 PM) or military **24-Hour** (e.g., 13:00) time.
* **Time Placement:** Choose how event text formats within the monthly grid cells:
  * *Time First:* Displays the time before the event name (e.g., **1:00 PM** Board Meeting).
  * *Title First:* Displays the name before the time (e.g., Board Meeting **1:00 PM**).
  * *Hide Time:* Removes the timestamp text from the grid entirely (ideal if your monthly cells are exceptionally crowded).

Make sure to click the blue **Save All Settings & Re-Bake** button at the bottom of the page to apply your changes.

---

## 1.3 The Uninstall Safety Switch

At the bottom of the main Settings tab, you will find a critical security feature labeled **Uninstall Behavior**. 

By default, the calendar prioritizes data protection. If you temporarily deactivate, reset, or delete the plugin (for example, during a routine server optimization process or while running an update), all of your events, recurring schedules, custom backgrounds, and settings remain safely stored in the database.

* **Erase all calendar data upon plugin deletion:** Check this box *only* if you are deliberately performing a permanent system wipe on your server and wish to completely destroy all associated event history, uploaded assets, and custom database tables.

---
---

# Chapter 2: Locations, Categories, and Permissions

To keep your community calendar clean, structured, and legible, the HOAplugin Calendar utilizes an asset-relationship layout composed of Locations and Categories. This framework also dictates your community access control permissions.

## 2.1 Managing Locations (Rooms & Facilities)

Locations define the specific physical rooms or recreational spaces within your homeowners association (e.g., the Clubhouse, the Grand Ballroom, the Community Pool, or the Pickleball Courts). 

**To add or edit a Location:**
1. In your WordPress Dashboard, navigate to **HOAplugin Calendar** and click the **Locations** tab at the top.
2. Under the "Add New Location" window, type the name of the facility into the **Location Name** text box.
3. Click the blue **Add Location** button.

The location will instantly populate in the data table above. You can click the **Edit** button next to any row to modify its name, or the **Del** button to remove it. 
*Note: If you delete a location that is currently linked to an active event, that event will safely default to showing "TBD" on the front-end grid rather than crashing.*

---

## 2.2 Managing Event Categories

Categories allow you to color-code events so residents can instantly scan the calendar (e.g., Fitness Classes, Social Events, HOA Board Meetings, Facility Maintenance).

**To add a new Category:**
1. Click the **Categories** tab located at the top of the main configuration page.
2. **Category Name:** Enter the name of the category (e.g., `Social Committee`).
3. **Display Color:** Click the color box to select a hex color. This color serves as the background fill of the event text bar on the monthly grid.
4. **Category Icon (Optional):** You can upload a vector icon (`.svg` file) to represent the category. This icon will appear in the top-right corner of the calendar day cell whenever an event of this type is scheduled. 
    * **Where to find icons:** There are many web libraries that offer free or premium SVG icons. You can also create custom icons using design tools like Canva, though exported Canva files often include hidden code bloat or "baggage." 
    * Simply drag and drop your `.svg` file into the dashed box, or click the zone to browse your local computer files.
    * The calendar will automatically strip out the original static fill colors from your SVG asset and dynamically paint it using your chosen **Display Color** so your site theme matches.
    * *Troubleshooting Tip:* If your uploaded icon appears broken, missing paths, or carries Canva baggage, run the file through the free online utility [SVGOMG](https://jakearchibald.github.io/svgomg/) using default settings, then re-upload.
5. Click **Add Category**.

---

## 2.3 The Delegate System (Permissions)

One of the most powerful features of the HOAplugin Calendar is the "Gatekeeper" security infrastructure. 

As an administrator, you do not want to hand out full WordPress Administrator credentials to every community volunteer or club leader. Instead, you can "delegate" specific calendar categories to specific residents using their email addresses.

**How to assign a Category Delegate:**
1. Go to the **Categories** tab and edit an existing category (or create a new one).
2. Locate the text area labeled **Category Delegates (Emails)**.
3. Type in the email address of the resident who should manage this category. You can authorize multiple residents by separating their emails with a clean comma (e.g., `social_committee@myhoa.com, resident@email.com`).
4. Click **Update Category**.

**What the Delegate experiences:**
When an authorized delegate logs into the community website and views the calendar:
* They will see a **[+]** symbol on the calendar grid cells, allowing them to add new events.
* When creating an event, the Category dropdown menu will automatically filter to *only* display the specific categories they have been granted permission to manage. They cannot see or select restricted categories.
* They will see a **✎ (Pencil)** edit icon *only* on events belonging to their approved categories. They are completely locked out from altering, moving, or deleting events managed by other committees.

Administrators (users with full WordPress access) bypass these restrictions completely and can manage any event in any category.

---
---

# Chapter 3: Setting Up Monthly Backgrounds

To give your community website a professional, premium feel, the HOAplugin Calendar supports custom structural backgrounds for each month. This allows you to display seasonal graphics, event highlights, or custom photography behind the grid layout.

## 3.1 Understanding Calendar Backgrounds

The calendar canvas is engineered to fit a standard **1700x1100 pixel** layout (an absolute 11x17 aspect ratio, optimized for standard tabloid newsletter center-spread printing). 

The template space is mathematically split into two distinct rendering zones:
* **The Header (Top 14% / 154px):** Displays the month name title, the active year, and the days of the week column labels. 
* **The Grid (Remaining 86% / 946px):** Displays the actual 35-cell matrix where your community events are drawn.

### The Automated Fallback System
You do not need to manually design or upload artwork for every month. If the plugin cannot locate a custom image file for the current month, it triggers a **built-in SVG template generator**. This generator automatically bakes a sharp, clean, high-contrast grid outline on the fly, outputting the correct text based on your current Display settings.

---

## 3.2 Designing Custom Backgrounds via Canva

If you prefer to design beautiful, seasonal monthly layouts using graphic tools like Canva, the plugin provides a perfectly proportioned blueprint template file to seed your project.

**How to use the Canva Grid Seed:**
1. On the **Monthly Backgrounds** tab, locate the buttons below the preview block and click **Download 11x17 Canva Grid Seed (SVG)**.
2. Log into your Canva account.
3. Upload or drag the downloaded SVG file directly into Canva to establish it as your structural project blueprint. You can then replicate that seed page to build a multi-page set for the entire year. Add your month names, year text, and days of the week inside the header area. Be sure to set the page filenames correctly as described below.

### Critical Design & Layout Rules:
* **Do not alter the grid framework:** Never stretch, shift, or distort the core matrix lines of the grid, and do not modify the aspect ratio of the page. The calendar compiler relies on these exact geometric lines to overlay event titles perfectly on the webpage.
* **Customizing the Header:** You have complete creative freedom to alter header fonts, background colors, and graphics (including the month, year, and day names), and you can add decoration anywhere on the page.
* **Adding Decorations:** If you choose to embed decorative vectors or illustrations inside a specific cell, try to choose cells that will remain empty for that month so your text bars remain perfectly readable.
* **Handling 5-Row Months (The Split Cells):** Certain months will not fit into 5 standard rows. The calendar program calculates these instances mathematically and will automatically overlay a clean diagonal slash (`/`) in the split day cells for the months that require them. You do not need to draw the slash in Canva! The split rules when starting your week on Sunday are:
    * *Standard Layout:* No splits (Fits cleanly in 5 rows).
    * *Bottom-Left Split Cell:* Sunday `[23/30]` or `[24/31]` is split. (Triggered for 30-day months starting on a Saturday, or 31-day months starting on a Friday).
    * *Top-Right Split Cell:* Saturday `[1/8]` is split. (Triggered for 31-day months starting on a Saturday).
    * *Monday Start Note:* There is a matching mathematical rule configuration for installations that choose Monday as their calendar start day. Split days will always manifest on weekends since they naturally contain fewer community events.

---

## 3.3 Publishing and Uploading Your Background Set

The calendar engine accumulates backgrounds over time based strictly on their image filenames. This allows you to quickly replace a single month or pre-load next year's canvas assets.

### Filename Rules
The filename in the upper-left corner of your design page must follow this strict format: `cal-YYYY-MM`. This tells the file compiler exactly which slot the background populates.
* *Example (January 2026):* `cal-2026-01`
* *Example (January 2027):* `cal-2027-01`

> **Tip for Future Years:** After uploading your initial set, you can easily plan ahead for next year. Go back into your Canva template, copy the January layout, change the heading text to 2027, update that page filename to `cal-2027-01`, and tweak your graphics. When uploaded, the new 2027 background will be indexed, while your original 2026 asset remains safe until it is more than a year old.

> **Warning on Filenames:** Be especially careful that your page filename matches the targeted month and year. Because the application cannot read the artistic headings inside your graphics, a December theme incorrectly named `cal-2026-07` will show up as your background in July. If you ever make an indexing mistake, simply correct the filename in your design suite and export your ZIP package again.

### Step-by-Step Publishing Procedure:
1.  **Save Your Work:** Click save inside your design platform to guarantee all vector paths are committed.
2.  **Export from Canva:** Inside your project workspace, click **Share** (top-right), then select **Download**.
    * Set the file format dropdown strictly to **PNG**.
    * Check the box labeled **Compress** (this significantly reduces loading delays for your residents).
    * Click **Download**. This compiles your pages into a compressed file named `CalendarBackgrounds.zip` in your computer's local Downloads directory.
3.  **Upload to the Website:**
    * Log into your WordPress Admin Dashboard as an Administrator.
    * Navigate to **HOAplugin Calendar** in the left menu.
    * Select the **Monthly Backgrounds** tab at the top.
    * Scroll to the ZIP upload module, click **Choose File**, and select the `CalendarBackgrounds.zip` file from your Downloads folder.
    * Click the blue **Upload and Process ZIP** button.
    * Refresh your web page to view your active custom layout.

The background processing engine will instantly unpack your file structure, and your live community events will now be dynamically drawn perfectly on top of your artwork!

---
---

# Chapter 4: Adding, Editing, and Managing Events

The HOAplugin Calendar allows administrators and delegated committee volunteers to smoothly coordinate one-off community events or complex recurring activity series.

---

## 4.1 Creating a New Event

There are two primary methods to access the event creation interface:
* **From the front-end Calendar Grid:** Hover your mouse over the specific day block where you want to add an event. If you have delegate or admin permissions for that day, a **[+]** icon will appear. Clicking it opens the event configuration sheet preset to that date.
* **From the Admin Dashboard:** If you are working in the backend, click the **HOAplugin Calendar** menu, select the **Event Audit Log** tab, and click the blue **[+]** symbol at the top right of the data table. Because this method is global, an interactive date-picker field will appear in the form for you to select your target day manually.

### Event Form Field Directory:
1.  **Event Title:** Enter a clear name for the activity (e.g., `Bridge Club Meeting`).
2.  **Description:** Use the main content editor to provide details for your residents (e.g., meeting guidelines, what to bring, or coordinator contact info). This text displays inside an interactive modal when a resident clicks on the event chip.
3.  **Setup Notes (Internal/Admin):** This specialized yellow-tinted text field is reserved for facility maintenance crews and setup staffs (e.g., `Requires 4 round tables and 16 folding chairs arranged by 8:00 AM`). *Note: These internal notes are visible to admins and residents viewing the expanded event details sheet.*
4.  **Flyer URL (Optional):** If your committee designed a custom graphic poster or PDF flyer, paste the link here. You can also paste the URL of an external club webpage.
    * If your asset is uploaded to the site, click **[Browse Media]** to open the native WordPress Media Library, locate your document, and select it.
    * ⚠️ **Important Red Redirection Notice:** Populating this field changes the calendar's behavior. Clicking this event chip on the front-end calendar will instantly open the flyer file or webpage link in a brand-new browser tab, skipping the standard description pop-up entirely.
5.  **Start and End Time:** Set the timing boundaries for the activity. The system records this data using a universal 24-hour clock internally, but it handles formatting on the front end according to your community's settings.
6.  **Location (Room):** Select the facility where the event is occurring from your dropdown directory.
7.  **Category:** Map the event to its corresponding category. *(Delegates will only see their approved options).* This sets the color hex fill of the text bar. If the category has a dedicated corner icon configured (like a tennis racket), that icon will display in the upper corner of the day cell rather than drawing a wide colored horizontal bar, keeping the grid clean.
8.  **Privacy & Visibility:**
    * *Public (Everyone):* Openly viewable to any public visitor browsing your community website.
    * *Residents Only:* Encrypts the block. If a user is not logged into a verified resident account, the event chip remains invisible to protect community privacy.
9.  **Tickets & Registration:** If an event requires ticketing, check **Requires Tickets / Registration**. This reveals a **Cost** input field where you can define entry fees or parameters (e.g., `$5.00` or `Register at Lobby Desk`).

---

## 4.2 Setting Up Repeating (Recurring) Events

For activities that run on a set cycle, the calendar features an advanced recurrence builder to automate your scheduling.

1.  Check the box labeled **This is a Repeating Event** to unlock the **Recurrence Rules Builder**. All sub-fields below are optional.
2.  **Days of Week:** Check the specific days your event occurs (e.g., check `MO`, `WE`, `FR` for a Monday-Wednesday-Friday aerobics class).
3.  **Frequency:** Sets the structural gap. Leaving this at `1` schedules the pattern every week or month. Adjusting it to `2` creates a bi-weekly or bi-monthly skip pattern.
4.  **Which Weeks? (Monthly Patterns):** For clubs meeting on specific weeks of the month (like a group that meets on the *2nd and 4th Monday*), check boxes `2` and `4`. To target the final week of any month, check the `-1 (Last)` box.
5.  **Specific Day of Month:** For events tied to an absolute calendar number (like a Board Meeting that occurs on the *15th of every month*), select that day number from the dropdown menu. This will instantly override the "Which Weeks" options.
6.  **Ends On (Optional):** If a class or league only runs for a seasonal window, input the final expiration date here. Leave it empty to let the series run infinitely.

---

## 4.3 Modifying or Canceling a Scheduled Event

To adjust an event, click its chip on the calendar grid and select the **✎ (Pencil)** icon. This icon is hidden from public view and is only accessible to logged-in admins and authorized delegates.

When managing a recurring series, data saves behave differently based on which fields you adjust:
* **Global Field Overrides:** Modifying text-based fields like the *Title, Description, Setup Notes, Flyer URL, Location, or Category* will automatically push updates globally across your entire history (altering all past, present, and future instances of that series simultaneously).
* **Time Shift Boundaries:** Modifying the main *Start Time or End Time* inputs establishes a chronological boundary. The time change applies to the specific day you selected and propagates forward to all future events, leaving your historical past logs safely untouched. If you only want to change the time of a *single* instance, use the **Rescheduling** tool instead of modifying these main fields.

### Modifying a Series (The "Pivot" Engine)
The database engine isolates updates relative to the day you selected on the grid. This allows you to alter scheduling rules mid-stream without corrupting historical records:

* **Pivoting a Series (Creating a New Era):** If a club has met at 9:00 AM for months, but votes to permanently shift to 11:00 AM starting next Monday, click on *next Monday's cell* and click edit. Update the time. The system will cut the timeline: perfectly preserving your historical tracking logs for past months while spawning a brand-new scheduling era for all occurrences going forward.

> ⚠️ **Warning on Turning Off Recurrence:** If you edit a repeating event and uncheck the "This is a Repeating Event" box, saving will strip the background rules and collapse the series into a single, isolated day. A confirmation prompt will appear to safeguard you from accidentally wiping out your future schedule.

### Rescheduling and Canceling via the Management Panel
Clicking the **Cancel Event** button on an existing entry closes the primary form and brings up your specialized **Manage Instance** dashboard.

#### For a One-Time (Single) Event:
* **Delete Event Forever:** Completely removes the entry from your database tables and clears it off the website grid instantly.

#### For a Recurring Series (Advanced Scope Control):
* **Cancel ONLY this instance:** This "punches a hole" in your repeating pattern. It leaves the master series intact but completely drops this single day from the display. Public visitors will no longer see it (ideal for handling a single holiday closure or a rained-out session).
* **Restore Next Cancelled Instance:** This serves as an immediate "undo" function for single cancellations. If an instance was canceled by mistake, click on the closest *previous active instance* of that series on the grid, open this panel, and click this button. The system will look forward, locate the deletion hole, and erase it—restoring the natural event block to the grid.
* **End series starting today:** This clips your timeline. It updates the master series with an expiration date for the previous day, ensuring your past history remains perfectly intact for archival purposes while cutting off all future instances from rendering.
* **Resume Series & Restore All Future:** If a series was previously expired or cut off, clicking this button strips out the termination clauses, making the pattern infinite once again and clearing downstream blocks to restore the lineage.
* **DELETE ENTIRE SERIES & HISTORY:** This is the nuclear option. It completely deletes the master rules, every historical log, all individual moves, and all single cancellations from the server. Use this only if you created a series by mistake.

---
---

# Chapter 5: Viewing the Calendar (Monthly Grid vs. Agenda Stream)

The HOAplugin Calendar features a fully responsive rendering layout, automatically restructuring its visual interface depending on whether a resident accesses it via a desktop monitor, tablet, or smartphone.

## 5.1 The Monthly Grid View

The Monthly Grid is the default display for large screens. It overlays your interactive community event chips directly on top of your custom high-resolution background templates.

### Grid Navigation Navigation Controls:
* **Arrow Buttons:** Navigating between months is handled via the high-contrast left (`<`) and right (`>`) arrow buttons situated in the upper corners of the workspace. 
* **Navigation Limits:** To optimize site performance, the navigation controls mathematically block users from scrolling beyond the boundaries configured in your Admin settings (e.g., 1 month past, 12 months future). When a limit is hit, the arrows automatically dim and deactivate.
* **The "Today" Button:** If a resident is browsing months deep into the future, clicking the **Today** button (bottom-left) instantly snaps the grid viewpoint back to the current day.
* **The Daily Pop-Up Window:** Clicking the numeric day header on any calendar block opens an isolated day module listing every single event scheduled for that specific date, allowing residents to easily review dense schedules.

---

## 5.2 The Day Cell Magnifier (Zoom Tool)

Because active homeowners associations often host multiple concurrent events on a single day, the monthly grid features a built-in cell magnifier to maintain legibility.

* **How it works:** When a user hovers their cursor over a calendar cell, that specific day block smoothly scales up and expands over the surrounding layout, bringing text titles into clear focus and making administrative tool icons easily clickable.
* **Two Dates in One Square (Split Cells):** For months where two calendar dates are compressed into a single shared cell (such as dates 23 and 30 sharing a block), the magnifier tracks your mouse coordinates using precision diagonal math. It will zoom into *only* the specific triangular date partition your cursor is touching.
* **Deactivating the Zoom:** If a resident prefers a static viewing experience, they can uncheck the **Magnifier** box located in the bottom-right toolbar to completely lock the grid cells to a flat size.

---

## 5.3 The Agenda Stream View

The Agenda view strips away grid lines and background templates, translating your event database into a clean, vertically scrolling reading stream. It is designed for rapid, clear scanning on small screens.

### Automated Screen Responsive Thresholds:
The calendar monitoring engine tracks browser viewport widths in real-time:
* **Desktop & Laptops (Widescreen):** Locks to the visual Monthly Grid layout to maximize your background artwork.
* **Smartphones (Mobile View):** When a user hits the site on a smartphone, the grid automatically hides itself and shifts to the vertical **Agenda list** so users don't have to pinch-zoom or squint.
* **Tablet Rotation:** If a resident holds a tablet vertically (Portrait), they receive the clean Agenda stream. If they rotate the tablet sideways (Landscape), the calendar immediately snaps back into the full Monthly Grid.

### Manual Layout Overrides
Users can bypass the automated responsiveness at any time. Clicking the **Monthly / Agenda** toggle switch in the footer toolbar lets residents manually switch between the two display layouts on demand.

---

## 5.4 Exporting to Personal Calendars

Residents do not need to manually copy event details into their personal devices. Every activity block displayed inside the Agenda view or the daily pop-up module includes a custom sub-link labeled **📅 Add to your Calendar**.

Clicking this link automatically bridges the event data directly into the resident's personal device calendar (such as Apple Calendar, Google Calendar, or Microsoft Outlook) via the secure **Webcal** subscription protocol. If the activity is part of a recurring series, their device will subscribe to the entire sequence—automatically syncing any future time modifications, room changes, or weather cancellations seamlessly without requiring manual action.

---
---

# Chapter 6: Advanced Drag-and-Drop Rescheduling (Pro Feature)

When the Pro upgrade module is active on your site, administrators and approved category delegates can bypass management forms entirely and adjust the community schedule visually using a mouse.

## 6.1 Moving Events on the Grid

The drag-and-drop workflow provides an instantaneous way to reorganize your calendar:

1.  **Select an Entry:** Click and hold your mouse down on any event text block or category icon inside the monthly grid. As you begin to move your cursor, the grid cells will dynamically illuminate with blue borders to signal the workspace is active.
2.  **Reposition the Chip:** Drag the item over to your target day. Active calendar cells will glow and display an overlay indicator reading **"Reschedule Here"**.
3.  **Dropping on Split Cells:** If you drag an event onto a shared multi-date cell, the engine's coordinate tracking system calculates your mouse placement. It will illuminate either the upper or lower triangular half, ensuring your event drops onto the exact intended date.

---

## 6.2 Rescheduling a Single Day vs. the Entire Series (The Shift Key)

When dragging a repeating event series to a new day, you can control the scope of the move instantly using your keyboard's **Shift key**:

* **Rescheduling a Single Day:** Simply drag and drop the event block normally without holding any keys. This moves *only* the instance for that specific day. The system will handle the database math automatically: punching a cancellation hole on the old day and creating an isolated override block on the new day, leaving the rest of the weekly pattern untouched.
* **Shifting the Entire Series Forward:** If a committee votes to permanently move their weekly meeting day, hold down the **Shift key** while dragging the event block. The overlay indicator will switch to read **"Reschedule Following"**. Dropping the block with the Shift key held down permanently moves that session *and all future occurrences* to the new day across your timeline, while leaving your past historical logs perfectly intact.

---

## 6.3 Dragging to Delete or Cancel

You can cancel or purge events by dragging them off the grid matrix completely and dropping them into the main calendar header area (where the month name and day columns live).

* **Cancel an Individual Session:** Drag a repeating event bar straight up into the calendar header zone. The header container will turn red and display **"DROP TO CANCEL INSTANCE"**. Release your mouse button to bring up a confirmation box confirming you want to cancel just that single day's session.
* **End a Series Permanently:** Hold down the **Shift key** and drag a repeating event bar up into the header. The alert shifts to read **"DROP TO END SERIES"**, letting you clean out the schedule from today forward.
* **Delete One-Time Events:** Dragging an isolated, non-repeating single event into the header zone displays **"DROP TO DELETE EVENT"**, completely purging the record from your site server.

---
---

# Chapter 7: 11x17 Newsletter Printing (Pro Feature)

To make publishing physical community newsletters effortless, the Pro version includes a dedicated layout compiler that packages your digital event logs into a high-density, tabloid-sized printing sheet.

## 7.1 Opening the Print Interface

1.  Navigate to the calendar page on the public side of your community website.
2.  Use the calendar navigation arrows to display the specific month you intend to print for your physical newsletter.
3.  Click the **Print (PDF)** button located in the bottom-right footer toolbar.
4.  A new, clean browser preview window will pop up on your screen, rendering your events perfectly scaled over your custom monthly background graphic.

---

## 7.2 Printed Page Layout & Mechanical Features

The print window engine locks your layout to a strict **17in x 11in Tabloid size** format, matching standard newsletter center-spread configurations.

* **Text Wrap Optimization:** Unlike web views that clip long titles to prevent grid crowding, the print layout allows text to naturally wrap down into multiple rows so readers of the printed newsletter can see the complete title.
* **Full-Color Icon Stamping:** If your categories utilize custom vector icons, those graphics print sharply in full color directly in the upper corner of your day boxes.
* **Printing to Physical Paper:** Ensure your desired physical printer is selected. Note that if you attempt to force the print onto standard letter paper (8.5x11), white margins will appear because the aspect ratios do not match. Printing directly to true 11x17 tabloid paper prints edge-to-edge.
* **Printing to PDF (For Design Imports):** If you layout your newsletter using design software like Canva, set your printer output device destination to **Save as PDF**. This captures the entire calendar month as a clean, unpixelated 1700x1100 asset file that you can upload into Canva and drop straight onto your tabloid newsletter pages.

---

## 7.3 Configuring Your Hardware Printer Settings

Because this system prints a large 11x17 sheet, you must adjust your local device print options to avoid cutting off margins:

1.  **Paper Size:** Change your print dialog paper size setting to **Tabloid**, **11x17**, or **Ledger**.
2.  **Orientation:** Ensure it is locked to **Landscape** (horizontal).
3.  **Margins:** Set your margins dropdown strictly to **None** or **Default**.
4.  **Critical Background Switch:** Look for the checkbox labeled **Background Graphics** (frequently found under "More Settings" or "Options") and make sure it is checked **ON**. If this remains unchecked, your computer will strip out your monthly background graphics and output a blank white grid.

---
---

# Chapter 8: System Troubleshooting and Support

This guide covers common diagnostic questions you may encounter while operating the calendar, along with step-by-step resolution procedures.

## 8.1 Missing or Outdated Information on the Grid

To maintain blazing-fast page loads for residents, the calendar compiles your schedules into a static cache file on the server. If you make rapid back-to-back edits, your local browser may temporarily show an older version of this file out of its local memory.

### Resolution Steps:
1.  **Execute a Hard Refresh:** On your keyboard, press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac). This commands your browser to clear its local memory cache and pull down the fresh data layout.
2.  **Force a Manual Server Re-Bake:** If the hard refresh doesn't fix the display, log in as an administrator and go to **HOAplugin Calendar > Settings** in your dashboard. Scroll to the bottom and click the blue **Save All Settings & Re-Bake** button. This sends a direct command to the server to delete the old cache file, read your database tables fresh, and recompile a clean `calendar-events.json` file.

---

## 8.2 Category Icons Are Invisible or Displaying Solid Black

If you upload an SVG vector icon for a category and it doesn't appear, or shows up as a solid blocky black shape, the file contains hidden internal style blocks or grouping tags left behind by your graphic illustration suite.

### Resolution Steps:
1.  Open your internet browser and navigate to the free open-source vector optimizer: [jakearchibald.github.io/svgomg](https://jakearchibald.github.io/svgomg/).
2.  Drag and drop your troubled icon file into the application window. Leave all toggle settings at their default values.
3.  Click the **Download** button to save the cleaned asset.
4.  Navigate to **HOAplugin Calendar > Categories** in your dashboard, click edit on the affected category, drag your new optimized file into the dropzone, and click **Update Category**. The calendar will now be able to strip out the internal paths and apply your chosen category color perfectly.

---

## 8.3 Voluteer Delegates Are Receiving "Permission Denied" Errors

If an authorized committee volunteer reports that they cannot see the creation symbols or are blocked from saving changes to an event, they have hit the Gatekeeper security firewall.

### Diagnostic Checklist:
1.  **Verify Login Status:** Ensure the volunteer is actively logged into their assigned user account on your community website.
2.  **Check Category Email Strings:** Navigate to **HOAplugin Calendar > Categories** and open the category they are attempting to update. Verify that their email address is spelled correctly in the **Category Delegates** field and that multiple emails are separated by a clean comma.
3.  **Verify Event Ownership:** If they are editing an existing event, they must either manage that event's category, or their specific email address must be populated inside that individual event form's **Delegate Owner** input box.

---

## 8.4 Safe Practices for Deactivating or Updating the Plugin

If you need to temporarily deactivate the plugin, run a manual file refresh, or upgrade to a newer software edition, your underlying data tables are secure by default.

### Verification Steps:
1.  Navigate to **HOAplugin Calendar > Settings** and scroll to the bottom of the form.
2.  **Locate the Uninstall Behavior section and confirm the data destruction checkbox is unchecked.** As long as this box is empty, you can safely delete the calendar plugin files from your WordPress plugins panel; your events, categories, and custom backgrounds remain completely safe inside your server database.
3.  *Only check this box if you intend to permanently destroy all community scheduling records from the database forever.*

---
---

# Chapter 9: The Calendar's Event Audit Log

The Event Audit Log is a centralized administrative control matrix located inside your WordPress dashboard. It allows managers to inspect the calendar database row-by-row and instantly fix scheduling or structural mistakes.

## 9.1 Reading the Audit Log Data Table

To view the log, log into your dashboard as an administrator, click **HOAplugin Calendar**, and select the **Event Audit Log** tab.

* **Chrological Lineage Grouping:** The table structures your records sequentially. Core **Master Series** rules are highlighted in bold blue rows, while any single-day modifications (like an individual moved session or a single cancel) are cleanly nested directly underneath that master row, allowing you to trace an event's full operational history at a glance.
* **Exception Holes:** Any repeating session marked as canceled shows in the timeline as a "Hole" entry with a cancelled tag.
* **Move Records:** Any session that was shifted shows a "Hole" row for its original slot and a corresponding "Move" row tracking its new target date and time.
* **Pivots:** Any structural adjustment to a series pattern manifests as a "Pivot" row tracking the date the change occurred and the new matching RRule code.

**Direct Dashboard Shortcuts:** You can click the orange **✎ (Pencil)** icon on any row to open its editor form, or click the red **× (Delete)** icon to instantly purge it.

---

## 9.2 Using the Audit Log for Rapid Maintenance

The Audit Log serves as a master control panel for clearing out administrative errors:

* **Create a Blank Event:** Click the blue **[+]** symbol at the top right of the log table to pull up a fresh configuration form.
* **Undoing a Cancellation:** If a regular session was marked as canceled by mistake, simply locate that specific row in the Audit Log and click its red **× (Delete)** icon. Erasing the cancellation log instantly restores that session to the live grid.
* **Undoing a Series Pivot:** If you accidentally pivoted a weekly series or set an incorrect time boundary, find the corresponding Pivot row and click its red delete button to instantly restore the original structural pattern.
* **The Global Mass-Purge Button:** If you accidentally created an entire recurring event series incorrectly, do not spend time deleting sessions day-by-day on the grid. Find the bold blue **Master Series** row for that event inside the Audit Log and click its red **× (Delete)** icon. This single click will clean out the master rules, all history logs, and all overrides across the entire life of that event from the database.

---
---

# Chapter 10: Frequently Asked Questions (FAQ)

## 10.1 Can I set an event to repeat on a pattern like "the 2nd and 4th Monday"?
Yes. Check the **This is a Repeating Event** box inside the editor. Under **Days of Week**, check `MO`. Then, go to the **Which Weeks?** row and check boxes `2` and `4`. The compiler will automatically calculate the correct calendar dates every month.

## 10.2 An instructor is going on vacation for three weeks. How do I clear those dates?
You do not need to delete the series. Go to your calendar grid, click on the first vacation date, and click the edit pencil. Select **Cancel Event**, and on the management panel click **Cancel ONLY this instance**. Repeat this step for the other two vacation dates. This punches a hole in the schedule for those three dates while leaving the rest of the year's classes completely active.

## 10.3 We have a holiday, but instead of canceling our regular Monday meeting, we are moving it to Tuesday night. What are the steps?
Ensure you are logged in as an administrator or authorized delegate. 
* **If you have the Pro version:** Click and hold the event chip on the holiday Monday, drag it over to Tuesday night on the grid, and let go. 
* **If you have the Free version:** Click the edit pencil on the holiday Monday chip, click the yellow **Reschedule** button, select your new Tuesday date and time, make sure the scope is set to **Only this specific instance**, and click **Confirm Move**.

The calendar will cleanly drop the event off the holiday Monday and build a custom rescheduled chip on that specific Tuesday without altering the rest of your series.

## 10.4 Why can't a resident see a specific event when browsing on their phone?
If you can see the block as an admin, but a resident reports it is missing, inspect the event's **Privacy & Visibility** settings. If it is set to **Residents Only**, it is encrypted from public view. The resident must log into their registered website account on their mobile device or tablet to authenticate and reveal those hidden blocks.

## 10.5 What happens to the calendar data if our website server experiences an outage?
Because the calendar saves all master configurations directly onto your secure website hosting database, your schedules are completely safe. As soon as your server restarts and power or internet connectivity is restored, the calendar will automatically display online to your residents instantly without requiring any manual data recovery actions.

---
---

# Chapter 11: Calendar Data Backups and Maintenance

To protect your community schedule against accidental database deletions, server hardware failures, or hosting corruptions, the calendar utilizes a multi-layered storage framework. 

## 11.1 Understanding How Calendar Data is Structured

The calendar splits your data into two separate locations on your web server:
1.  **The Event Registry (The Database Master):** Every custom category, room location, individual event entry, cancellation hole, and repeating rule is recorded directly into three custom tables inside your WordPress database: `wp_hoapg_events`, `wp_hoapg_categories`, and `wp_hoapg_locations`. This is your permanent master data.
2.  **The Compiled Snapshot (The JSON Cache):** Every time you save an entry or click "Re-Bake", the system flattens your schedule into a fast-loading file named `calendar-events.json` located inside your server's `wp-content/uploads/fsbhoa-calendar/` directory. This file is temporary and automatically regenerates itself on the fly, meaning it does not need to be backed up manually.

---

## 11.2 How to Back Up Your Calendar

Because your master entries live inside the core WordPress database, they are easily protected as part of your community's standard website backup routine.

### Method 1: Automated WordPress Backup Plugins
If your website uses a standard automated backup solution (such as Duplicator, UpdraftPlus, BackWPup, or VaultPress):
* **Database Configuration:** Ensure your backup plugin is set to save your database tables. The software will automatically sweep and include the custom `hoapg_` calendar tables along with your user accounts and pages.
* **Uploads Folder Inclusion:** Verify that your backup solution captures your site's **Uploads Folder** (`wp-content/uploads/`). This guarantees that your custom monthly background PNG images and category vector icons are safely preserved.
* **Flyer Documents:** Any PDF or image flyers uploaded to your events are held in the standard WordPress Media Library and will be safely preserved if your backup captures the Uploads directory.

### Method 2: Manual Export via phpMyAdmin
To take a manual snapshot of your calendar data before making large schedule updates or migrating hosting servers:
1.  Log into your hosting account control panel and open **phpMyAdmin**.
2.  Locate your website's database and check the boxes next to these three custom tables:
    * `wp_hoapg_events`
    * `wp_hoapg_categories`
    * `wp_hoapg_locations`
3.  Click the **Export** tab at the top of the screen, leave the format set to **SQL**, and click **Go**. This downloads a lightweight, secure text snapshot to your computer that can be imported to restore your calendar perfectly in seconds if an emergency ever occurs.

---

## 11.3 Restoring Your Calendar from a Backup

If you ever need to restore your website from a backup file, follow these quick post-restoration steps to sync your system cleanly:

1.  Restore your website database and uploads directory using your standard site backup tool.
2.  Log into the WordPress dashboard and navigate to **HOAplugin Calendar > Settings**.
3.  Scroll to the bottom of the page and click the blue **Save All Settings & Re-Bake** button. 

This commands the system to immediately read your newly restored database tables and write a fresh, clean `calendar-events.json` file, bringing your interactive monthly grid and mobile agenda streams back online instantly for your residents.

---
---

# Chapter 12: Free vs. Pro Feature Reference

This reference guide outlines the differences between the Free base version of the plugin and the Pro upgrade features, helping you track your capabilities.

## 12.1 Feature Comparison Matrix

| Feature Capability | Free Base Version | Pro Upgrade Edition |
| :--- | :---: | :---: |
| **Interactive Monthly Grid View** | Standard | Standard |
| **Responsive Mobile Agenda Stream** | Standard | Standard |
| **Committee Delegate System** | Standard | Standard |
| **Custom Monthly Background Canvas** | Standard | Standard |
| **Resident-Only Privacy Controls** | Standard | Standard |
| **Add to Personal Calendar Link (Webcal)** | Standard | Standard |
| **Visual Drag-and-Drop Rescheduling** | Disabled | Fully Enabled |
| **Drag-to-Delete Header Drop Zone** | Disabled | Fully Enabled |
| **Advanced Shift-Key Series Pivoting** | Manual Forms Only | Mouse Drag Shortcuts |
| **11x17 Tabloid Newsletter PDF Printing** | Disabled | Complete Layout Engine |
| **Automated Dashboard Version Updates** | Disabled | Automated Updates |
| **Technical Support** | No Support | Full Email Support |

---

## 12.2 Premium Upgrade Features Detailed

### 1. Visual Drag-and-Drop Editor
The Pro license unlocks fluid mouse interaction across your entire calendar layout. Instead of opening individual event panels, typing new dates, or manually calculating future timeline shifts, administrators can make schedule adjustments visually by grabbing, dragging, and dropping sessions on the grid to reschedule, or into the header bar to cancel.

### 2. Tabloid Newsletter Layout Engine
The Pro edition includes a specialized print module that compiles your event registry into a rigid 17in x 11in ledger-sized format. It expands hidden text, cleanly wraps titles into multiple readable rows, stamps vector category icons into cell corners, and prepares your layouts so they fit directly into the center-spread of your newsletter.

### 3. Software Updates and Support
With an active subscription or lifetime license key connected to the HOAplugin.com server, you will automatically receive background updates whenever an optimization, feature enhancement, or security maintenance build is released. If you ever have technical questions or code inquiries, you can contact the developer directly via email for priority troubleshooting support.

