# FSBHOA Calendar Plugin

## Overview
The FSBHOA Calendar is a custom WordPress plugin designed to provide a live, responsive calendar of events for the Four Seasons at Bakersfield Homeowners Association. 

The application is built to handle complex recurring event logic (including exceptions, rescheduling, and cancellations) while providing a highly polished, responsive user interface that adapts to desktops, mobile devices, and high-resolution print exports.

---

## 1.  Terminology
The calendar relies on a parent-child record structure to handle the complexities of recurring events without data duplication. Understanding these definitions is critical for working on the codebase.

* **Master Record:** The original event declaration. This contains global metadata (title, category, location, flyer) and the scheduling rules (either a one-time date or a recurring `RRule`).
* **Instance:** A generated, discrete occurrence of a Master event that renders on a specific day in the calendar grid. Instances are generated dynamically based on the rules of the most recent master or pivot as modified by the hole and move exceptions.
* **Pivot (Pattern change):** A child record that declares a permanent change in the recurring pattern of a event's instances, taking effect at a specific instance. A pivot alters all subsequent instances.
* **Hole (Cancellation):** A child record that explicitly cancels a specific instance of a recurring event, preventing it from rendering in the calendar. A hole record is identified as a record with a master_id, a pivot_id, and a status of "cancelled".
* **Move (Reschedule):** A child record declaring an out-of-sequence instance. It is used to move an event to a new date/time and is always paired with a *Hole* record to suppress the original instance.
* **Exception** A pivot, move, or hole record. These are ordered child records of the master. Each changes the pattern of instances generated.
* **Boomerang:** A user action in the Admin UI where an exception (a Move or a Hole) is reverted to its original state. The system resolves this by deleting the specific Hole and Move records.
* **Triple-Exception:** A complex edge case operation where a single instance of a recurring event experiences a move/time change, and is subsequently cancelled or moved *again*.

---

## 2. User Interface & Display Modes
The front-end application offers three distinct display modes, automatically selected based on screen size or user preference.

### A. Monthly Grid Mode (Default for Desktop)
* **Layout:** A 7x5 grid displaying day cells, designed to maintain a strict **11x17 aspect ratio**. The grid and header are engineered to fit entirely within the browser viewport without vertical scrolling.
* **Backgrounds:** The month title and grid frame use custom graphical backgrounds designed in Canva. These backgrounds are imported via a ZIP file and maintain a 14% heading ratio.
* **Cell Behavior:** 
    * Events are ordered chronologically by start time.
    * Event backgrounds are color-coded based on their assigned Category.
    * Categories with assigned icons will display the icon in the day header instead of a text title in the cell body.
* **Split Cells:** To accommodate 30/31 day months within a 5-row grid, specific cells are diagonally split (bottom-left to top-right):
    * 31-day months starting on Friday: Split the last Sunday.
    * 30-day months starting on Saturday: Split the last Sunday.
    * 31-day months starting on Saturday: Split the first Saturday.
* **Interactivity:**
    * Hovering over a day cell triggers a **Magnifier**, expanding the cell to reveal truncated titles or hidden overflowing instances.
    * Clicking an event opens the associated Flyer (in a new tab) or a Detail Modal if no flyer exists.
    * Clicking the day header opens a Day Modal (a focused list view of that day's events).
    * Left/Right navigation arrows allow month-to-month traversal.

### B. Agenda Mode (Default for Mobile)
* **Layout:** A vertical, scrolling list of event instances grouped by day.
* **Structure:** Features a sticky month header. Each day begins with a header row (Date + Icons) followed by individual event cards detailing start times and locations.
* **Interactivity:** Clicking an event card opens the Flyer or Detail Modal.

### C. Print Layout Mode
* **Purpose:** Generates a clean, static version of the Monthly Grid specifically for the HOA's tabloid sized newsletter.
* **Layout:** Strictly enforced 11x17 landscape format. Strips away all interactive UI elements (navigation arrows, toolbars, hover states) so it can be cleanly exported to PDF and imported back into Canva as a centerfold.


### D. Roles & Permissions (The Gatekeeper)
The calendar utilizes a dual-tier permission system. The UI dynamically loads the editing scripts (`calendar-editor.js`) and renders the "Edit Pencils" based on these two tiers:

1. **Global Administrators:** Users with the WordPress `manage_options` capability. Admins see edit pencils and add + icons for all events and can assign delegates.
2. **Event Delegates:** Targeted, event-level ownership. If a resident's logged-in WordPress email matches the `owner_email` column of an event, they are granted permission to edit *only* that specific event lineage.

*Security Note:* All edit requests are routed through the `fsb_save_calendar_event` AJAX endpoint, which strictly enforces Nonce verification and WordPress capability checks before invoking the database repository.
---

## E. The Editing Operations
When an Admin or Delegate interacts with the calendar, the JavaScript packages the payload with a specific `edit_mode` and sends it to the PHP Controller. The `Repository.php` class then executes the precise database mutations.

After any edit action the compiler is called to regenerate the .json file containing all events to be displayed.  The javascript code then re-renders the calendar using the new .json file.

### 1. Meta-Data Edits (`soft_save`)
* **Trigger:** User changes the Title, Description, Flyer URL, Location, or Category, but leaves the Time and Recurrence Rules alone.
* **Backend Action:** The Repository updates the `fsbhoa_events` row on the master, in-place without triggering the complex exception engine.

### 2. Changing the Rules (`maybe_pivot_series`)
* **Trigger:** User changes the Start Time, End Time, or the `RRule` of an existing recurring event.
* **Backend Action:** The system detects a "DNA Change". 
    * If the edit occurs on the original start date of the rule, it updates the record in-place.
    * If the edit occurs in the middle of a series, it creates a **New Pivot** record starting on that date, and automatically triggers `delete_downstream()` to wipe out any orphaned exceptions tied to the old rule.


### 3. Drag-and-Drop Rescheduling (`instance_move`)
* **Trigger:** User drags an event instance to a new day cell, or uses the "Reschedule" modal.
* **Backend Action (`move_event_instance`):** * The Repository computes the "Natural" time the event was supposed to occur.
    * It inserts a *Hole* (status: `cancelled`) at the natural time.
    * It inserts a *Move* (status: `active`) at the new target time.
    * *Collision Detection:* If the user drags a previously moved event instance, the system seamlessly cleans up the old move records to prevent database bloating.

* **Trigger:** User holds shift and drags an event instance to a new day cell, or uses the "reschedule" modal with "Reschedule all remaining".
* **Backend Action** * The Repository performs a pivot at that point causing all subsequent instances of the event to follow the new pattern. It will remove all downstream exception records.

### 4. Cancellations (`instance_cancel` & `master_cancel`)
* **Trigger:** User drops an event in the top red "Cancel" header zone, or clicks "Cancel ONLY this instance."
* **Backend Action:** Inserts a child record on that specific date with the status set to `cancelled`. The Compiler will skip this date when generating the JSON.

* **Trigger:** User holds shift and drags an event instance to the header zone, or clicks "Terminate event".
* **Backend Action:** Ends the event by changing the RRule on the most recent master or pivot record to include a termination date. No event instances are generated beyone that date.

### 5. The Restorations
* **Trigger:** User clicks "Restore Instance" or "Resume Series."
* **Backend Action (`restore_hole` / `resume_series`):** Deletes the specific `cancelled` row from the database, or strips the `UNTIL` clause from an RRule, instantly reverting the calendar grid back to its natural recurring state.

---

## 3. Environment & Tooling
* **Platform:** WordPress Plugin.
* **Global Toolbar:** Present in both Monthly and Agenda modes, anchored to the bottom of the screen.
    * *Today:* Centers the view on the current date.
    * *Fullscreen:* Expands the application to occupy the entire monitor.
    * *Print:* Triggers the Print Layout Mode.
    * *Magnifier:* A toggle checkbox to enable/disable the hover magnification feature.
    * *Monthly <> Agenda:* A toggle switch to manually override the responsive display mode.

## 4. Project Metadata
* **Author:** David Keeney
* **Role:** Chairperson, IT/Website Committee
* **Version:** 1.0.10 (Development)
* **License:** Open Source, GNU v3.
* **Design Tool:** Gemini Pro 2.5.

## 5. Prerequisites & Tech Stack
* **Environment:** WordPress 6.x+
* **Backend:** PHP 8.x+ 
* **Frontend:** Vanilla JavaScript, CSS3, HTML5
* **Testing:** Playwright (Node.js) for UI testing
* **Assets:** Canva (used for generating monthly background zip files)

## 6. Installation & Deployment
Because this repository does not include external dependencies (like Composer packages or Node modules), you must build the project locally before installing it on the live website.

### Phase 1: Local Setup & Dependencies
1. Clone the repository to your local machine or testbed environment.
2. **Install PHP Dependencies:** Run the following command in the plugin root to install the `rlanvin/php-rrule` package and generate the `vendor/` folder:
   ```bash
   composer install
   ```
### Phase 2: Packaging for Production
To install the plugin on the live WordPress website, you must package it manually:
1. Run `./make-zip.sh` in the plugin root. This script will automatically create the `.zip` archive while safely excluding testing libraries (`node_modules/`), local Git data, and Aider chat history.
2. In the WordPress Admin dashboard, go to **Plugins > Add New Plugin > Upload Plugin**.
3. Upload the `.zip` file, click **Install Now**, and then click **Activate**.

### Phase 3: Frontend Configuration
The plugin relies on shortcodes to render the UI on the front end. Create or edit a WordPress Page and insert the desired shortcode(s):
* `[fsbhoa_calendar]` : Renders the responsive monthly grid (defaults to desktop view).
* `[fsbhoa_agenda]` : Renders the vertical, mobile-friendly list view.
*(Note: Both shortcodes can be utilized on the same page depending on your page layout and responsive design strategy).*
