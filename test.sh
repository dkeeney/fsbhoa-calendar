#!/bin/bash
npx playwright test --config=tests/playwright.config.js tests/calendar-forms.spec.js -g "TEST 12"
#npx playwright test --config=tests/playwright.config.js tests/calendar-forms.spec.js
