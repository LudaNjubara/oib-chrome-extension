// --- Constants ---
const Elements = {
  PID_NUMBER: document.getElementById("pid-number"),
  GENERATE_BTN: document.getElementById("generate-btn"),
  COPY_BTN: document.getElementById("copy-btn"),
  CLEAR_HISTORY_BTN: document.getElementById("clear-history-btn"),
  SEARCH_INPUT: document.getElementById("search-input"),
  PID_HISTORY_LIST: document.getElementById("pid-history-list"),
};

const Classes = {
  COPIED_MESSAGE: "copied-message",
  SHOW: "show",
  HIDE: "hide",
  PID_HISTORY_ITEM: "pid-history-item",
  PID_HISTORY_TIMESTAMP: "pid-history-timestamp",
};

const StorageKeys = {
  PID_HISTORY: "pidHistory",
};

const AnimationTimings = {
  FADE_OUT_START: 600,
  REMOVE_ELEMENT: 800,
};

// --- Utility Functions ---

/**
 * Formats a timestamp into a localized time string (HH:MM:SS).
 * @param {number} timestamp - The timestamp to format.
 * @returns {string} The formatted time string.
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Generates a random Croatian PID (OIB) with a valid control digit.
 * @returns {string} The generated 11-digit PID.
 */
function generateRandomPID() {
  function calculateControlDigit(digits) {
    let temp = 10;
    for (let i = 0; i < digits.length; i++) {
      const num = parseInt(digits[i], 10);
      temp = (temp + num) % 10 === 0 ? 10 : (temp + num) % 10;
      temp = (temp * 2) % 11;
    }
    return (11 - temp) % 10;
  }

  let digits = "";
  for (let i = 0; i < 10; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  const controlDigit = calculateControlDigit(digits);
  return digits + controlDigit.toString();
}

// --- UI Update Functions ---

/**
 * Updates the main PID display area.
 * @param {string} pid - The PID to display, or null/undefined to show placeholder.
 */
function updatePIDDisplay(pid) {
  Elements.PID_NUMBER.textContent = pid || "-";
}

/**
 * Displays an animated "Copied!" message over a target element.
 * @param {HTMLElement} targetElement - The element to display the message over.
 */
function showCopiedMessage(targetElement) {
  if (!targetElement) return;

  // Ensure target can contain the absolutely positioned message
  if (getComputedStyle(targetElement).position === "static") {
    targetElement.style.position = "relative";
  }

  // Remove any existing message first
  const existingMessage = targetElement.querySelector(`.${Classes.COPIED_MESSAGE}`);
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.textContent = "Copied!";
  messageEl.classList.add(Classes.COPIED_MESSAGE);
  targetElement.appendChild(messageEl);

  // Trigger animations
  messageEl.classList.add(Classes.SHOW);

  // Set timeouts for fade-out and removal
  setTimeout(() => {
    messageEl.classList.remove(Classes.SHOW);
    messageEl.classList.add(Classes.HIDE);
  }, AnimationTimings.FADE_OUT_START);

  setTimeout(() => {
    messageEl.remove();
  }, AnimationTimings.REMOVE_ELEMENT);
}

/**
 * Creates and renders a single history list item.
 * @param {object} entry - The history entry { pid, timestamp }.
 * @param {boolean} prepend - Whether to add the item to the top (true) or bottom (false).
 * @returns {HTMLLIElement} The created list item element.
 */
function createHistoryListItem(entry) {
  const listItemEl = document.createElement("li");
  const pidEl = document.createElement("span");
  const timestampEl = document.createElement("span");

  pidEl.textContent = entry.pid;
  timestampEl.textContent = formatTimestamp(entry.timestamp);
  pidEl.classList.add(Classes.PID_HISTORY_ITEM);
  timestampEl.classList.add(Classes.PID_HISTORY_TIMESTAMP);

  listItemEl.appendChild(pidEl);
  listItemEl.appendChild(timestampEl);
  return listItemEl;
}

/**
 * Renders a history item to the DOM list.
 * @param {object} entry - The history entry { pid, timestamp }.
 * @param {boolean} prepend - Whether to add the item to the top (true) or bottom (false).
 */
function renderHistoryItem(entry, prepend = true) {
  const listItemEl = createHistoryListItem(entry);
  if (prepend) {
    Elements.PID_HISTORY_LIST.insertBefore(listItemEl, Elements.PID_HISTORY_LIST.firstChild);
  } else {
    Elements.PID_HISTORY_LIST.appendChild(listItemEl);
  }
  // Apply current filter to the newly added item
  filterHistoryList();
}

/**
 * Filters the visible history list items based on the search input.
 */
function filterHistoryList() {
  const searchTerm = Elements.SEARCH_INPUT.value.toLowerCase();
  const items = Elements.PID_HISTORY_LIST.getElementsByTagName("li");

  for (const item of items) {
    const pidEl = item.querySelector(`.${Classes.PID_HISTORY_ITEM}`);
    if (pidEl) {
      const pidText = pidEl.textContent.toLowerCase();
      item.style.display = pidText.includes(searchTerm) ? "" : "none";
    }
  }
}

// --- Storage Functions ---

/**
 * Retrieves the PID history from local storage.
 * @returns {Promise<Array<object>>} A promise resolving to the history array.
 */
async function getHistoryFromStorage() {
  try {
    const result = await chrome.storage.local.get(StorageKeys.PID_HISTORY);
    return result[StorageKeys.PID_HISTORY] || [];
  } catch (error) {
    console.error("Error loading history from storage:", error);
    return []; // Return empty array on error
  }
}

/**
 * Saves a new PID entry to local storage.
 * @param {object} newEntry - The new history entry { pid, timestamp }.
 * @returns {Promise<void>}
 */
async function saveHistoryEntryToStorage(newEntry) {
  try {
    const history = await getHistoryFromStorage();
    history.push(newEntry);
    // Optional: Limit history size here if needed
    await chrome.storage.local.set({ [StorageKeys.PID_HISTORY]: history });
  } catch (error) {
    console.error("Error saving history entry:", error);
  }
}

/**
 * Clears the PID history from local storage.
 * @returns {Promise<void>}
 */
async function clearHistoryFromStorage() {
  try {
    await chrome.storage.local.remove(StorageKeys.PID_HISTORY);
  } catch (error) {
    console.error("Error clearing history from storage:", error);
  }
}

// --- Core Logic Functions ---

/**
 * Copies the given PID to the clipboard and shows feedback.
 * @param {string} pid - The PID to copy.
 * @param {HTMLElement} [feedbackElement] - Optional element to show feedback animation on.
 */
async function copyPidToClipboard(pid, feedbackElement) {
  if (!pid || pid === "-") return; // Don't copy placeholder

  try {
    await navigator.clipboard.writeText(pid);
    console.log("PID copied to clipboard:", pid);
    if (feedbackElement) {
      showCopiedMessage(feedbackElement);
    }
  } catch (err) {
    console.error("Failed to copy PID: ", err);
    // Optionally show an error message to the user
  }
}

/**
 * Loads history from storage and populates the UI.
 */
async function initializeHistory() {
  const history = await getHistoryFromStorage();
  Elements.PID_HISTORY_LIST.innerHTML = ""; // Clear existing list items

  if (history.length > 0) {
    // Render history, ensuring newest are at the top visually
    history.forEach((entry) => renderHistoryItem(entry, true));
    updatePIDDisplay(history[history.length - 1].pid); // Display the latest PID
  } else {
    // Generate and display an initial PID if history is empty
    await handleGenerateClick(); // Generate, save, and render
  }

  Elements.PID_HISTORY_LIST.scrollTop = 0; // Scroll to top
  filterHistoryList(); // Apply initial filter if search has value
}

/**
 * Handles the click event for the generate button.
 */
async function handleGenerateClick() {
  const newPID = generateRandomPID();
  const generationTime = Date.now();
  const newEntry = { pid: newPID, timestamp: generationTime };

  updatePIDDisplay(newPID);
  await saveHistoryEntryToStorage(newEntry);
  renderHistoryItem(newEntry, true); // Render prepended
  Elements.PID_HISTORY_LIST.scrollTop = 0; // Ensure scroll stays at top
}

/**
 * Handles the click event for the clear history button.
 */
async function handleClearHistoryClick() {
  if (window.confirm("Are you sure you want to clear the entire PID history? This cannot be undone.")) {
    await clearHistoryFromStorage();
    Elements.PID_HISTORY_LIST.innerHTML = "";
    updatePIDDisplay("-");
    Elements.SEARCH_INPUT.value = "";
    console.log("PID history cleared.");
    // Optionally generate a new initial PID after clearing
    // await handleGenerateClick();
  } else {
    console.log("Clear history cancelled.");
  }
}

// --- Event Handlers ---

function handleCopyButton() {
  copyPidToClipboard(Elements.PID_NUMBER.textContent, Elements.COPY_BTN);
}

function handlePidNumberClick() {
  copyPidToClipboard(Elements.PID_NUMBER.textContent, Elements.PID_NUMBER);
}

function handleHistoryListClick(event) {
  const listItem = event.target.closest("li");
  if (!listItem) return;

  const pidEl = listItem.querySelector(`.${Classes.PID_HISTORY_ITEM}`);
  if (pidEl) {
    copyPidToClipboard(pidEl.textContent, listItem);
  }
}

// --- Event Listener Setup ---

function setupEventListeners() {
  Elements.GENERATE_BTN.addEventListener("click", handleGenerateClick);
  Elements.COPY_BTN.addEventListener("click", handleCopyButton);
  Elements.PID_NUMBER.addEventListener("click", handlePidNumberClick);
  Elements.CLEAR_HISTORY_BTN.addEventListener("click", handleClearHistoryClick);
  Elements.SEARCH_INPUT.addEventListener("input", filterHistoryList);
  Elements.PID_HISTORY_LIST.addEventListener("click", handleHistoryListClick);
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initializeHistory();
});
