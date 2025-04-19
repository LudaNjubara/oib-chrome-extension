// --- Constants ---
const Elements = {
  PID_NUMBER: document.getElementById("pid-number"),
  GENERATE_BTN: document.getElementById("generate-btn"),
  COPY_BTN: document.getElementById("copy-btn"),
  CLEAR_HISTORY_BTN: document.getElementById("clear-history-btn"),
  SEARCH_INPUT: document.getElementById("search-input"),
  PID_HISTORY_LIST: document.getElementById("pid-history-list"),
  PINNED_LIST: document.getElementById("pinned-list"), // New element
  PINNED_SECTION: document.getElementById("pinned-section"), // New element
};

const Classes = {
  COPIED_MESSAGE: "copied-message",
  SHOW: "show",
  HIDE: "hide",
  PID_ITEM: "pid-history-item", // Renamed for generic use
  TIMESTAMP: "pid-history-timestamp", // Renamed for generic use
  PIN_BTN: "pin-btn",
  UNPIN_BTN: "unpin-btn",
};

const StorageKeys = {
  PID_HISTORY: "pidHistory",
};

const AnimationTimings = {
  FADE_OUT_START: 500,
  REMOVE_ELEMENT: 750,
};

// --- Utility Functions ---

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

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
  for (let i = 0; i < 10; i++) digits += Math.floor(Math.random() * 10).toString();
  const controlDigit = calculateControlDigit(digits);
  return digits + controlDigit.toString();
}

// --- UI Update Functions ---

function updatePIDDisplay(pid) {
  Elements.PID_NUMBER.textContent = pid || "-";
}

function showCopiedMessage(targetElement) {
  if (!targetElement) return;
  if (getComputedStyle(targetElement).position === "static") targetElement.style.position = "relative";
  const existingMessage = targetElement.querySelector(`.${Classes.COPIED_MESSAGE}`);
  if (existingMessage) existingMessage.remove();

  const messageEl = document.createElement("div");
  messageEl.textContent = "Copied!";
  messageEl.classList.add(Classes.COPIED_MESSAGE);
  targetElement.appendChild(messageEl);
  messageEl.classList.add(Classes.SHOW);

  setTimeout(() => {
    messageEl.classList.remove(Classes.SHOW);
    messageEl.classList.add(Classes.HIDE);
  }, AnimationTimings.FADE_OUT_START);
  setTimeout(() => {
    messageEl.remove();
  }, AnimationTimings.REMOVE_ELEMENT);
}

/**
 * Creates a list item element (li) for a PID entry.
 * Includes PID, timestamp, and pin/unpin button.
 * @param {object} entry - The history entry { pid, timestamp, pinned? }.
 * @returns {HTMLLIElement} The created list item element.
 */
function createListItemElement(entry) {
  const listItemEl = document.createElement("li");
  listItemEl.dataset.pid = entry.pid; // Store pid in dataset for easy access

  const pidEl = document.createElement("span");
  pidEl.textContent = entry.pid;
  pidEl.classList.add(Classes.PID_ITEM);

  const timestampEl = document.createElement("span");
  timestampEl.textContent = formatTimestamp(entry.timestamp);
  timestampEl.classList.add(Classes.TIMESTAMP);

  const imageEl = document.createElement("img");
  imageEl.classList.add("pin-icon");
  imageEl.src = entry.pinned ? "../icons/pin_fill.png" : "../icons/pin_outline.png"; // Use appropriate icon
  imageEl.alt = "Pin PID";
  imageEl.classList.add("pin-icon");
  imageEl.style.width = "16px"; // Set width for the icon
  imageEl.style.height = "16px"; // Set height for the icon

  const pinButton = document.createElement("button");
  pinButton.title = entry.pinned ? "Unpin PID" : "Pin PID";
  pinButton.classList.add(entry.pinned ? Classes.UNPIN_BTN : Classes.PIN_BTN);
  pinButton.appendChild(imageEl); // Append the image to the button

  // Structure: [PID] [Pin/Unpin Button] [Timestamp]
  listItemEl.appendChild(pidEl);
  listItemEl.appendChild(pinButton); // Add button between PID and timestamp
  listItemEl.appendChild(timestampEl);

  return listItemEl;
}

/**
 * Renders a single item to the appropriate list (pinned or history).
 * Appends the item to maintain descending timestamp order.
 * @param {object} entry - The history entry { pid, timestamp, pinned? }.
 */
function renderItem(entry) {
  const listItemEl = createListItemElement(entry);
  const targetList = entry.pinned ? Elements.PINNED_LIST : Elements.PID_HISTORY_LIST;
  // Append to show newest first (as source array is sorted descending)
  targetList.appendChild(listItemEl); // Changed from insertBefore
}

/**
 * Updates the visibility of the pinned section based on whether it has items.
 */
function updatePinnedSectionVisibility() {
  const hasPinnedItems = Elements.PINNED_LIST.children.length > 0;
  Elements.PINNED_SECTION.hidden = !hasPinnedItems;
}

/**
 * Filters both the pinned and history lists based on the search input.
 */
function filterLists() {
  const searchTerm = Elements.SEARCH_INPUT.value.toLowerCase();
  const lists = [Elements.PINNED_LIST, Elements.PID_HISTORY_LIST];

  lists.forEach((list) => {
    const items = list.getElementsByTagName("li");
    for (const item of items) {
      const pidEl = item.querySelector(`.${Classes.PID_ITEM}`);
      if (pidEl) {
        const pidText = pidEl.textContent.toLowerCase();
        item.style.display = pidText.includes(searchTerm) ? "" : "flex"; // Use flex due to li styling
      }
    }
  });
}

// --- Storage Functions ---

async function getHistoryFromStorage() {
  try {
    const result = await chrome.storage.local.get(StorageKeys.PID_HISTORY);
    const history = (result[StorageKeys.PID_HISTORY] || []).map((entry) => ({
      ...entry,
      pinned: !!entry.pinned,
    }));
    // Sort the history by timestamp descending (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);
    return history;
  } catch (error) {
    console.error("Error loading history:", error);
    return [];
  }
}

async function saveHistoryToStorage(history) {
  try {
    await chrome.storage.local.set({ [StorageKeys.PID_HISTORY]: history });
  } catch (error) {
    console.error("Error saving history:", error);
  }
}

/**
 * Updates the pinned status of a specific PID in storage.
 * @param {string} pid - The PID to update.
 * @param {boolean} pinned - The new pinned status.
 * @returns {Promise<Array<object>|null>} Updated history array or null on error/not found.
 */
async function updatePinStatusInStorage(pid, pinned) {
  try {
    const history = await getHistoryFromStorage();
    const itemIndex = history.findIndex((item) => item.pid === pid);
    if (itemIndex > -1) {
      history[itemIndex].pinned = pinned;
      await saveHistoryToStorage(history);
      return history; // Return updated history
    }
    console.warn("PID not found in history for pinning:", pid);
    return null; // Indicate PID not found
  } catch (error) {
    console.error("Error updating pin status:", error);
    return null; // Indicate error
  }
}

async function clearHistoryFromStorage() {
  try {
    await chrome.storage.local.remove(StorageKeys.PID_HISTORY);
  } catch (error) {
    console.error("Error clearing history:", error);
  }
}

// --- Core Logic Functions ---

async function copyPidToClipboard(pid, feedbackElement) {
  if (!pid || pid === "-") return;
  try {
    await navigator.clipboard.writeText(pid);
    console.log("PID copied:", pid);
    if (feedbackElement) showCopiedMessage(feedbackElement);
  } catch (err) {
    console.error("Failed to copy PID:", err);
  }
}

/**
 * Loads sorted history, separates pinned/unpinned, and renders both lists.
 */
async function initializeUI() {
  const history = await getHistoryFromStorage(); // Gets sorted history
  Elements.PID_HISTORY_LIST.innerHTML = "";
  Elements.PINNED_LIST.innerHTML = "";

  let latestPid = "-";
  if (history.length > 0) {
    history.forEach((entry) => renderItem(entry)); // Renders to correct list, appending
    // The first item in the sorted array is the latest overall
    latestPid = history[0].pid;
  } else {
    // Generate initial PID if history is completely empty
    // handleGenerateClick will append the new item correctly
    latestPid = await handleGenerateClick(true); // Render the new item
  }

  updatePIDDisplay(latestPid);
  updatePinnedSectionVisibility(); // Show/hide pinned section
  filterLists(); // Apply initial filter
  // No need to scroll to top anymore, as newest is already there
  // Elements.PID_HISTORY_LIST.scrollTop = 0;
  // Elements.PINNED_LIST.scrollTop = 0;
}

/**
 * Handles generating a new PID, saving it, and rendering it.
 * @param {boolean} render - Whether to render the item immediately (default true).
 * @returns {Promise<string>} The newly generated PID.
 */
async function handleGenerateClick(render = true) {
  const newPID = generateRandomPID();
  const generationTime = Date.now();
  const newEntry = { pid: newPID, timestamp: generationTime, pinned: false };

  updatePIDDisplay(newPID);

  // Save to storage first
  const history = await getHistoryFromStorage(); // Get potentially unsorted history
  history.push(newEntry);
  // No need to sort here, saveHistoryToStorage just saves
  await saveHistoryToStorage(history);

  if (render) {
    // Re-initialize UI to ensure correct sorting after adding
    await initializeUI();
  }
  return newPID; // Return the generated PID
}

async function handleClearHistoryClick() {
  if (window.confirm("Clear entire PID history (pinned items will remain)?")) {
    const history = await getHistoryFromStorage();
    const pinnedItems = history.filter((item) => item.pinned); // Keep only pinned items
    await saveHistoryToStorage(pinnedItems); // Save back only pinned items
    await initializeUI(); // Re-render UI
    console.log("Non-pinned history cleared.");
  } else {
    console.log("Clear history cancelled.");
  }
}

/**
 * Handles pinning or unpinning an item. Re-initializes UI to maintain sort order.
 * @param {string} pid - The PID of the item.
 * @param {boolean} shouldPin - True to pin, false to unpin.
 */
async function handlePinToggle(pid, shouldPin) {
  const updatedHistory = await updatePinStatusInStorage(pid, shouldPin);
  if (updatedHistory) {
    // Re-initialize the entire UI to ensure correct sorting in both lists
    await initializeUI();
  }
}

// --- Event Handlers ---

function handleCopyButton() {
  copyPidToClipboard(Elements.PID_NUMBER.textContent, Elements.PID_NUMBER);
}
function handlePidNumberClick() {
  copyPidToClipboard(Elements.PID_NUMBER.textContent, Elements.PID_NUMBER);
}

/**
 * Handles clicks within the Pinned or History lists.
 * Delegates to copy or pin/unpin actions.
 * @param {Event} event
 */
function handleListClick(event) {
  const target = event.target;
  const listItem = target.closest("li");
  if (!listItem) return;

  const pid = listItem.dataset.pid;
  if (!pid) return;

  // Check if pin/unpin button was clicked
  if (target.closest(`.${Classes.PIN_BTN}`)) {
    handlePinToggle(pid, true); // Pin the item
  } else if (target.closest(`.${Classes.UNPIN_BTN}`)) {
    handlePinToggle(pid, false); // Unpin the item
  } else {
    // Otherwise, assume click is to copy PID
    copyPidToClipboard(pid, listItem);
  }
}

// --- Event Listener Setup ---

function setupEventListeners() {
  Elements.GENERATE_BTN.addEventListener("click", () => handleGenerateClick()); // Pass no args
  Elements.COPY_BTN.addEventListener("click", handleCopyButton);
  Elements.PID_NUMBER.addEventListener("click", handlePidNumberClick);
  Elements.CLEAR_HISTORY_BTN.addEventListener("click", handleClearHistoryClick);
  Elements.SEARCH_INPUT.addEventListener("input", filterLists); // Filter both lists
  Elements.PID_HISTORY_LIST.addEventListener("click", handleListClick); // Single handler for history list
  Elements.PINNED_LIST.addEventListener("click", handleListClick); // Single handler for pinned list
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initializeUI(); // Use the new initialization function
});
