# SIMNS Project Style Guide

This document outlines the coding standards and workflow rules for the SIMNS prototype. All team members must adhere to these guidelines to ensure consistency and maintainability across the codebase.

## 1\. Naming Conventions

* **JavaScript Variables and Functions:** Use `camelCase`.

  * *Example:* `let employeeList = \[];`, `function checkEligibility() {}`
* **HTML IDs:** Use `camelCase` to easily match with JavaScript selectors.

  * *Example:* `<div id="notificationPanel">`
* **HTML/CSS Classes:** Use `kebab-case` for styling selectors.

  * *Example:* `<button class="btn-primary">`
* **Constants:** Use `UPPER\_SNAKE\_CASE` for global constants.

  * *Example:* `const MAX\_STEP\_INCREMENT = 8;`

## 2\. Formatting Rules

* **Indentation:** Use 2 spaces for indentation across all HTML, CSS, and JS files. Do not use tabs.
* **Quotes:** Use single quotes (`'`) for JavaScript strings, and double quotes (`"`) for HTML attributes.

  * *JS Example:* `const role = 'admin';`
  * *HTML Example:* `<input type="text" id="username">`
* **Braces:** Use the standard opening brace placement for JavaScript (opening brace on the same line).

  * *Example:* ```javascript
if (isEligible) {
approveIncrement();
}

&#x20;   ```
\* \*\*Semicolons:\*\* Semicolons are mandatory at the end of every JavaScript statement.

* **Semicolons:** Semicolons are mandatory at the end of every JavaScript statement.

## 3\. Commenting Standards

* **Function Headers:** Every major JavaScript function must have a JSDoc-style comment explaining its purpose, parameters, and return value.

  * *Example:*

&#x20;   ```javascript
    /\*\*
     \* Calculates if an employee is due for a step increment.
     \* @param {string} lastStepDate - The date of the last increment.
     \* @returns {boolean} True if eligible, false otherwise.
     \*/
    ```

* **Inline Comments:** Use standard inline comments (`//`) to explain complex logic blocks, such as the date parsing for the 3-year increment rule. Do not state the obvious (e.g., `// adds 1 to x`).

## 4\. Branch Naming

All branches must be created from `main` and follow this specific naming format: `<type>/<short-description>`. Use hyphens to separate words.

* **Feature Branches:** `feature/add-audit-log` or `feature/login-ui`
* **Bug Fixes:** `bugfix/increment-calculation-error`
* **Documentation:** `docs/update-readme`

