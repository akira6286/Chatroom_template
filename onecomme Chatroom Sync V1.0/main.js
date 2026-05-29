var MAX_MESSAGES = 18;
var receivedIds = {};
var oneCommeSDK = null;

function getCurrentTime() {
  var now = new Date();
  var hours = String(now.getHours()).padStart(2, "0");
  var minutes = String(now.getMinutes()).padStart(2, "0");

  return hours + ":" + minutes;
}

function formatTime(value) {
  if (!value) {
    return getCurrentTime();
  }

  var date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 5);
  }

  return String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0");
}

function rgbToCss(color) {
  if (!color) {
    return "";
  }

  if (typeof color === "string") {
    return color;
  }

  if (typeof color.r === "number" && typeof color.g === "number" && typeof color.b === "number") {
    return "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
  }

  return "";
}

function getDisplayName(comment) {
  var data = comment && comment.data ? comment.data : {};
  return data.displayName || data.nickname || data.name || comment.name || "anonymous";
}

function getCommentId(comment) {
  var data = comment && comment.data ? comment.data : {};
  return data.id || comment.id || String(Date.now()) + "-" + Math.random();
}

function trimMessages() {
  var log = document.getElementById("log");

  if (!log) {
    return;
  }

  while (log.children.length > MAX_MESSAGES) {
    delete receivedIds[log.firstElementChild.dataset.id];
    log.removeChild(log.firstElementChild);
  }
}

function renderBadges(container, badges) {
  container.textContent = "";

  if (!Array.isArray(badges)) {
    return;
  }

  badges.forEach(function (badge) {
    if (!badge || !badge.url) {
      return;
    }

    var image = document.createElement("img");
    image.className = "badge";
    image.src = badge.url;
    image.alt = badge.label || "";
    image.title = badge.label || "";
    container.appendChild(image);
  });
}

function createChatLine(comment) {
  comment = comment || {};

  var data = comment && comment.data ? comment.data : {};
  var line = document.createElement("div");
  var timestamp = document.createElement("span");
  var meta = document.createElement("span");
  var badges = document.createElement("span");
  var name = document.createElement("span");
  var message = document.createElement("span");
  var color = rgbToCss(comment && comment.color);
  var sdk = getOneSDK();
  var style = sdk && typeof sdk.getCommentStyle === "function"
    ? sdk.getCommentStyle(comment)
    : {};

  line.className = "chat-line-onecomme";
  line.dataset.id = getCommentId(comment);
  line.dataset.service = comment.service || "";
  line.dataset.from = getDisplayName(comment);

  timestamp.className = "timestamp";
  timestamp.textContent = "[" + formatTime(data.timestamp) + "] ";

  meta.className = "meta";
  meta.style.color = style && style.color ? style.color : color;

  badges.className = "badges";
  renderBadges(badges, data.badges);

  name.className = "name";
  name.textContent = getDisplayName(comment);

  message.className = "message";
  message.innerHTML = data.comment || "";

  meta.appendChild(badges);
  meta.appendChild(name);
  line.appendChild(timestamp);
  line.appendChild(meta);
  line.appendChild(document.createTextNode(" "));
  line.appendChild(message);

  return line;
}

function addComment(comment) {
  var log = document.getElementById("log");
  var id = getCommentId(comment);

  if (!log || receivedIds[id]) {
    return;
  }

  receivedIds[id] = true;
  log.appendChild(createChatLine(comment));
  trimMessages();
}

function addComments(comments) {
  if (!Array.isArray(comments)) {
    return;
  }

  comments.forEach(addComment);
}

function extractComments(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && response.data && Array.isArray(response.data.comments)) {
    return response.data.comments;
  }

  if (response && Array.isArray(response.comments)) {
    return response.comments;
  }

  return [];
}

function clearComments() {
  var log = document.getElementById("log");

  receivedIds = {};

  if (log) {
    log.textContent = "";
  }
}

function deleteComment(payload) {
  var log = document.getElementById("log");
  var id = payload && payload.data ? payload.data.id : payload && payload.id;

  if (!log || !id) {
    return;
  }

  var escapedId = window.CSS && typeof CSS.escape === "function"
    ? CSS.escape(id)
    : String(id).replace(/"/g, "\\\"");
  var line = log.querySelector("[data-id=\"" + escapedId + "\"]");

  if (line) {
    line.classList.add("deleted");
  }

  delete receivedIds[id];
}

function getOneSDK() {
  if (oneCommeSDK) {
    return oneCommeSDK;
  }

  if (window.OneSDK && typeof window.OneSDK.setup === "function") {
    oneCommeSDK = window.OneSDK;
    return oneCommeSDK;
  }

  if (typeof window.OneSDK === "function") {
    oneCommeSDK = new window.OneSDK();
    return oneCommeSDK;
  }

  if (window.OneSDK && typeof window.OneSDK.OneSDK === "function") {
    oneCommeSDK = new window.OneSDK.OneSDK();
    return oneCommeSDK;
  }

  if (window.onesdk && typeof window.onesdk.setup === "function") {
    oneCommeSDK = window.onesdk;
    return oneCommeSDK;
  }

  return null;
}

function setStatus(text) {
  var status = document.querySelector(".chat-statusbar span");

  if (status) {
    status.textContent = text;
  }
}

function initOneComme() {
  var sdk = getOneSDK();

  if (!sdk || typeof sdk.setup !== "function") {
    setStatus("SDK: NOT FOUND");
    return;
  }

  Promise.resolve(typeof sdk.ready === "function" ? sdk.ready() : undefined).then(function () {
    return sdk.setup({
      mode: "all",
      disabledDelay: true,
      intervalTime: 1000,
      maxQueueInterval: 100,
      reconnectInterval: 3000,
      commentLimit: MAX_MESSAGES,
      permissions: ["connected", "comments", "clear", "deleted"]
    });
  }).then(function () {
    sdk.subscribe({
      action: "connected",
      callback: function () {
        setStatus("SDK: CONNECTED");
      }
    });

    sdk.subscribe({
      action: "comments",
      callback: function (response) {
        addComments(extractComments(response));
      }
    });

    sdk.subscribe({
      action: "clear",
      callback: clearComments
    });

    sdk.subscribe({
      action: "deleted",
      callback: deleteComment
    });

    setStatus("SDK: CONNECTING");
    return sdk.connect();
  }).then(function () {
    setStatus("SDK: CONNECTED");

    if (typeof sdk.getComments === "function") {
      return sdk.getComments().then(addComments);
    }
  }).catch(function (error) {
    setStatus("SDK: ERROR");
    console.error("OneComme SDK connection failed:", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOneComme);
} else {
  initOneComme();
}
