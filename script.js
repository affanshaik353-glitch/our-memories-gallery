"use strict";

const KEYS = {
  photos: "ourMemories.photos",
  theme: "ourMemories.theme",
  background: "ourMemories.background",
  admin: "ourMemories.adminSession",
  visitor: "ourMemories.visitorId",
  comments: "ourMemories.comments",
  contacts: "ourMemories.contacts"
};
const ADMIN = { id: "OURWORLD123", password: "OUR_WORLD_123@" };
const state = {
  isAdmin: sessionStorage.getItem(KEYS.admin) === "true",
  photos: [],
  pendingUploads: [],
  capturedDataUrl: "",
  cameraStream: null,
  facingMode: "environment",
  lightboxIndex: 0
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

function showToast(message, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("#toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast(error.name === "QuotaExceededError"
      ? "Storage is full. Try smaller or compressed photos."
      : "This browser could not save the data.", "error");
    return false;
  }
}

function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getVisitorId() {
  let id = localStorage.getItem(KEYS.visitor);
  if (!id) {
    id = uid("visitor");
    localStorage.setItem(KEYS.visitor, id);
  }
  return id;
}

function loadPhotos() {
  state.photos = storageGet(KEYS.photos, []);
  if (!Array.isArray(state.photos)) state.photos = [];
}

function savePhotos() {
  return storageSet(KEYS.photos, state.photos);
}

function addPhoto(photo) {
  state.photos.unshift({
    id: photo.id || uid("memory"),
    title: String(photo.title || "Beautiful Memory").slice(0, 80),
    description: String(photo.description || "").slice(0, 500),
    dataUrl: photo.dataUrl,
    date: photo.date || new Date().toISOString(),
    likes: Array.isArray(photo.likes) ? photo.likes : []
  });
  return savePhotos();
}

function deletePhoto(id) {
  state.photos = state.photos.filter(photo => photo.id !== id);
  const comments = loadComments();
  delete comments[id];
  storageSet(KEYS.comments, comments);
  return savePhotos();
}

function editPhoto(id, title, description) {
  const photo = state.photos.find(item => item.id === id);
  if (!photo) return false;
  photo.title = String(title).trim().slice(0, 80) || "Beautiful Memory";
  photo.description = String(description).trim().slice(0, 500);
  return savePhotos();
}

function toggleLike(id) {
  const photo = state.photos.find(item => item.id === id);
  if (!photo) return;
  if (!Array.isArray(photo.likes)) photo.likes = [];
  const visitor = getVisitorId();
  const index = photo.likes.indexOf(visitor);
  index >= 0 ? photo.likes.splice(index, 1) : photo.likes.push(visitor);
  savePhotos();
  renderGallery();
}

function loadComments() {
  const comments = storageGet(KEYS.comments, {});
  return comments && typeof comments === "object" ? comments : {};
}

function addComment(photoId, name, text) {
  const cleanName = String(name).trim().slice(0, 60);
  const cleanText = String(text).trim().slice(0, 500);
  if (!cleanName || !cleanText) return false;
  const comments = loadComments();
  if (!comments[photoId]) comments[photoId] = [];
  comments[photoId].push({ id: uid("comment"), name: cleanName, text: cleanText, date: new Date().toISOString() });
  return storageSet(KEYS.comments, comments);
}

function saveTheme(theme) {
  try {
    localStorage.setItem(KEYS.theme, theme);
  } catch {
    showToast("The selected theme could not be saved. Browser storage may be full.", "error");
    return;
  }
  applyTheme(theme);
}

function applyTheme(theme) {
  document.body.className = "";
  if (theme && theme !== "pink") document.body.classList.add(`theme-${theme}`);
  const savedBackground = localStorage.getItem(KEYS.background);
  if (savedBackground) {
    document.body.classList.add("custom-background");
    document.body.style.setProperty("--custom-bg", `url("${savedBackground}")`);
  } else {
    document.body.classList.remove("custom-background");
    document.body.style.removeProperty("--custom-bg");
  }
  $$(".theme-swatch").forEach(button => {
    button.setAttribute("aria-pressed", button.dataset.theme === theme ? "true" : "false");
  });
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderGallery() {
  loadPhotos();
  const gallery = $("#gallery");
  gallery.innerHTML = "";
  $("#memoryCount").textContent = `${state.photos.length} ${state.photos.length === 1 ? "memory" : "memories"}`;
  if (!state.photos.length) {
    gallery.innerHTML = `<div class="empty-state"><div class="empty-heart">♡</div><h3>Our memory shelf is waiting</h3><p>No photos here yet. A beautiful moment will soon find its place.</p></div>`;
    return;
  }
  const comments = loadComments();
  const visitor = getVisitorId();
  state.photos.forEach((photo, index) => {
    const photoComments = comments[photo.id] || [];
    const likes = Array.isArray(photo.likes) ? photo.likes.length : 0;
    const liked = Array.isArray(photo.likes) && photo.likes.includes(visitor);
    const card = document.createElement("article");
    card.className = "memory-card";
    card.innerHTML = `
      <button class="memory-image-button" type="button" data-view="${index}" aria-label="View ${escapeHtml(photo.title)}">
        <img class="memory-image" src="${photo.dataUrl}" alt="${escapeHtml(photo.title)}" loading="lazy">
      </button>
      <div class="memory-content">
        <h3>${escapeHtml(photo.title)}</h3>
        ${photo.description ? `<p class="memory-description">${escapeHtml(photo.description)}</p>` : ""}
        <time class="memory-date">${escapeHtml(formatDate(photo.date))}</time>
        <div class="memory-actions">
          <button class="like-button ${liked ? "liked" : ""}" type="button" data-like="${escapeHtml(photo.id)}" aria-pressed="${liked}">
            ${liked ? "♥" : "♡"} <span>${likes}</span>
          </button>
          <div class="admin-card-actions ${state.isAdmin ? "" : "hidden"}">
            <button type="button" data-edit="${escapeHtml(photo.id)}">Edit</button>
            <button type="button" data-delete="${escapeHtml(photo.id)}">Delete</button>
          </div>
        </div>
        <button class="comments-toggle" type="button" data-comments="${escapeHtml(photo.id)}">Comments (${photoComments.length})</button>
        <div class="comments-area hidden" id="comments-${escapeHtml(photo.id)}">
          <div class="comments-list">
            ${photoComments.length ? photoComments.map(comment => `
              <div class="comment">
                <strong>${escapeHtml(comment.name)}</strong>
                <time>${escapeHtml(formatDate(comment.date))}</time>
                <p>${escapeHtml(comment.text)}</p>
              </div>`).join("") : `<p class="memory-date">No comments yet. Be the first to leave one.</p>`}
          </div>
          <form class="comment-form" data-comment-form="${escapeHtml(photo.id)}">
            <input name="name" maxlength="60" placeholder="Your name" required>
            <textarea name="text" maxlength="500" rows="2" placeholder="Write a sweet comment..." required></textarea>
            <button class="outline-button" type="submit">Post Comment</button>
          </form>
        </div>
      </div>`;
    gallery.appendChild(card);
  });
}

function adminLogin(user, password) {
  if (user === ADMIN.id && password === ADMIN.password) {
    state.isAdmin = true;
    sessionStorage.setItem(KEYS.admin, "true");
    updateAdminUI();
    closeModal("loginModal");
    $("#loginForm").reset();
    showToast("Welcome to your private dashboard.", "success");
    return true;
  }
  $("#loginError").textContent = "Incorrect User ID or password.";
  return false;
}

function adminLogout() {
  state.isAdmin = false;
  sessionStorage.removeItem(KEYS.admin);
  updateAdminUI();
  showToast("You have been logged out.");
}

function updateAdminUI() {
  $$(".admin-only").forEach(element => element.classList.toggle("hidden", !state.isAdmin));
  $("#adminNavButton").textContent = state.isAdmin ? "Dashboard" : "Admin Login";
  renderGallery();
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.hidden = true;
  if (!$$(".modal:not([hidden])").length) document.body.style.overflow = "";
}

function showGallery() {
  $("#home").scrollIntoView({ behavior: "smooth" });
}

async function compressImage(file, maxSize = 1600, quality = 0.78) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function handlePhotoUpload(files) {
  const validFiles = [...files].filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
  if (!validFiles.length) return showToast("Please choose JPG, JPEG, PNG, or WEBP images.", "error");
  if (validFiles.length !== files.length) showToast("Some unsupported files were skipped.", "error");
  const container = $("#uploadPreviews");
  container.innerHTML = "";
  state.pendingUploads = [];
  $("#saveUploadsButton").disabled = true;
  const loading = showUploadLoading();
  try {
    for (const file of validFiles) {
      const dataUrl = await compressImage(file);
      state.pendingUploads.push({ dataUrl, title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) });
    }
    renderUploadPreviews();
    loading.remove();
    $("#saveUploadsButton").disabled = false;
  } catch {
    loading.remove();
    showToast("One of the selected photos could not be read.", "error");
  }
}

function showUploadLoading() {
  const element = document.createElement("p");
  element.className = "camera-status";
  element.textContent = "Preparing photo previews...";
  $("#uploadPreviews").appendChild(element);
  return element;
}

function renderUploadPreviews() {
  const container = $("#uploadPreviews");
  container.innerHTML = "";
  state.pendingUploads.forEach((photo, index) => {
    const card = document.createElement("div");
    card.className = "upload-preview-card";
    card.innerHTML = `
      <button class="remove-preview" type="button" data-remove-upload="${index}" aria-label="Remove preview">×</button>
      <img src="${photo.dataUrl}" alt="">
      <input type="text" maxlength="80" value="${escapeHtml(photo.title)}" aria-label="Photo title" data-upload-title="${index}" placeholder="Photo title">`;
    container.appendChild(card);
  });
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("#cameraStatus").textContent = "Camera access is not supported by this browser.";
    return;
  }
  stopCamera();
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: state.facingMode } },
      audio: false
    });
    $("#cameraVideo").srcObject = state.cameraStream;
    $("#cameraStatus").textContent = "";
  } catch (error) {
    const name = error.name === "NotAllowedError" ? "Camera permission was denied." : "The camera could not be opened.";
    $("#cameraStatus").textContent = `${name} Please check your browser permissions.`;
    showToast(name, "error");
  }
}

function stopCamera() {
  if (state.cameraStream) state.cameraStream.getTracks().forEach(track => track.stop());
  state.cameraStream = null;
  $("#cameraVideo").srcObject = null;
}

function capturePhoto() {
  const video = $("#cameraVideo");
  if (!state.cameraStream || video.readyState < 2) {
    showToast("The camera is not ready yet.", "error");
    return false;
  }
  const canvas = $("#cameraCanvas");
  const ratio = 1600 / Math.max(video.videoWidth, video.videoHeight);
  canvas.width = Math.round(video.videoWidth * Math.min(1, ratio));
  canvas.height = Math.round(video.videoHeight * Math.min(1, ratio));
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  state.capturedDataUrl = canvas.toDataURL("image/jpeg", .82);
  $("#cameraPreview").src = state.capturedDataUrl;
  $("#cameraPreview").hidden = false;
  $("#cameraVideo").hidden = true;
  $("#captureButton").classList.add("hidden");
  $("#switchCameraButton").classList.add("hidden");
  $("#retakeButton").classList.remove("hidden");
  $("#cameraSaveForm").classList.remove("hidden");
  return true;
}

function openLightbox(index) {
  if (!state.photos.length) return;
  state.lightboxIndex = (index + state.photos.length) % state.photos.length;
  const photo = state.photos[state.lightboxIndex];
  $("#lightboxImage").src = photo.dataUrl;
  $("#lightboxImage").alt = photo.title;
  $("#lightboxTitle").textContent = photo.title;
  $("#lightboxDescription").textContent = photo.description;
  openModal("lightboxModal");
}

function navigateLightbox(direction) {
  openLightbox(state.lightboxIndex + direction);
}

document.addEventListener("DOMContentLoaded", () => {
  loadPhotos();
  getVisitorId();
  applyTheme(localStorage.getItem(KEYS.theme) || "pink");
  updateAdminUI();

  $("#exploreButton").addEventListener("click", () => {
    $("#memories").classList.remove("hidden-section");
    $("#memories").scrollIntoView({ behavior: "smooth" });
  });
  $("#manageButton").addEventListener("click", () => $("#dashboard").scrollIntoView({ behavior: "smooth" }));

  $("#menuToggle").addEventListener("click", () => {
    const open = $("#navLinks").classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(open));
  });
  $$(".nav-link").forEach(link => link.addEventListener("click", () => {
    $("#navLinks").classList.remove("open");
    $("#menuToggle").setAttribute("aria-expanded", "false");
  }));
  $("#adminNavButton").addEventListener("click", () => state.isAdmin ? $("#dashboard").scrollIntoView({ behavior: "smooth" }) : openModal("loginModal"));
  $("#logoutButton").addEventListener("click", adminLogout);

  $("#loginForm").addEventListener("submit", event => {
    event.preventDefault();
    adminLogin($("#adminUser").value.trim(), $("#adminPassword").value);
  });
  $("#togglePassword").addEventListener("click", () => {
    const input = $("#adminPassword");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    $("#togglePassword").textContent = showing ? "Show" : "Hide";
    $("#togglePassword").setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  $$("[data-close]").forEach(element => element.addEventListener("click", () => {
    closeModal(element.dataset.close);
    if (element.dataset.close === "cameraModal") stopCamera();
  }));

  $("#photoUpload").addEventListener("change", event => handlePhotoUpload(event.target.files));
  $("#saveUploadsButton").addEventListener("click", () => {
    const titleInputs = $$("[data-upload-title]");
    titleInputs.forEach(input => state.pendingUploads[Number(input.dataset.uploadTitle)].title = input.value.trim());
    let added = 0;
    state.pendingUploads.forEach(photo => {
      if (addPhoto(photo)) added++;
    });
    if (added) {
      showToast(`${added} ${added === 1 ? "memory" : "memories"} saved.`, "success");
      state.pendingUploads = [];
      $("#uploadPreviews").innerHTML = "";
      $("#saveUploadsButton").disabled = true;
      $("#photoUpload").value = "";
      renderGallery();
    }
  });
  $("#uploadPreviews").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-upload]");
    if (!button) return;
    state.pendingUploads.splice(Number(button.dataset.removeUpload), 1);
    renderUploadPreviews();
    $("#saveUploadsButton").disabled = !state.pendingUploads.length;
  });

  $("#openCameraButton").addEventListener("click", () => {
    if (!state.isAdmin) return;
    state.capturedDataUrl = "";
    $("#cameraPreview").hidden = true;
    $("#cameraVideo").hidden = false;
    $("#captureButton").classList.remove("hidden");
    $("#switchCameraButton").classList.remove("hidden");
    $("#retakeButton").classList.add("hidden");
    $("#cameraSaveForm").classList.add("hidden");
    $("#cameraTitleInput").value = "";
    $("#cameraDescriptionInput").value = "";
    openModal("cameraModal");
    startCamera();
  });
  $("#captureButton").addEventListener("click", capturePhoto);
  $("#switchCameraButton").addEventListener("click", () => {
    state.facingMode = state.facingMode === "environment" ? "user" : "environment";
    startCamera();
  });
  $("#retakeButton").addEventListener("click", () => {
    state.capturedDataUrl = "";
    $("#cameraPreview").hidden = true;
    $("#cameraVideo").hidden = false;
    $("#captureButton").classList.remove("hidden");
    $("#switchCameraButton").classList.remove("hidden");
    $("#retakeButton").classList.add("hidden");
    $("#cameraSaveForm").classList.add("hidden");
  });
  $("#saveCapturedButton").addEventListener("click", () => {
    if (!state.capturedDataUrl || !state.isAdmin) return;
    if (!addPhoto({ dataUrl: state.capturedDataUrl, title: $("#cameraTitleInput").value.trim(), description: $("#cameraDescriptionInput").value.trim() })) return;
    showToast("Captured memory saved.", "success");
    renderGallery();
    stopCamera();
    closeModal("cameraModal");
  });

  $$(".theme-swatch").forEach(button => button.addEventListener("click", () => {
    if (!state.isAdmin) return;
    saveTheme(button.dataset.theme);
    showToast(`${button.textContent.trim()} theme applied.`, "success");
  }));
  $("#backgroundUpload").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!state.isAdmin || !file) return;
    try {
      const dataUrl = await compressImage(file, 1920, .72);
      try {
        localStorage.setItem(KEYS.background, dataUrl);
      } catch {
        showToast("Storage is full. Try a smaller background photo.", "error");
        return;
      }
      applyTheme(localStorage.getItem(KEYS.theme) || "pink");
      $("#backgroundPreview").innerHTML = `<img src="${dataUrl}" alt="Background preview">`;
      showToast("Background photo applied.", "success");
    } catch {
      showToast("The background photo could not be read.", "error");
    }
  });
  const currentBackground = localStorage.getItem(KEYS.background);
  if (currentBackground) $("#backgroundPreview").innerHTML = `<img src="${currentBackground}" alt="Current background preview">`;
  $("#removeBackgroundButton").addEventListener("click", () => {
    if (!state.isAdmin) return;
    localStorage.removeItem(KEYS.background);
    applyTheme(localStorage.getItem(KEYS.theme) || "pink");
    $("#backgroundPreview").innerHTML = "";
    showToast("Background photo removed.");
  });

  $("#gallery").addEventListener("click", event => {
    const view = event.target.closest("[data-view]");
    const like = event.target.closest("[data-like]");
    const del = event.target.closest("[data-delete]");
    const edit = event.target.closest("[data-edit]");
    const commentToggle = event.target.closest("[data-comments]");
    if (view) openLightbox(Number(view.dataset.view));
    if (like && !event.target.closest("[data-view]")) toggleLike(like.dataset.like);
    if (del && state.isAdmin && confirm("Delete this memory permanently?")) {
      deletePhoto(del.dataset.delete);
      renderGallery();
      showToast("Memory deleted.");
    }
    if (edit && state.isAdmin) {
      const photo = state.photos.find(item => item.id === edit.dataset.edit);
      $("#editPhotoId").value = photo.id;
      $("#editPhotoTitle").value = photo.title;
      $("#editPhotoDescription").value = photo.description;
      openModal("editModal");
    }
    if (commentToggle) {
      const area = $(`#comments-${CSS.escape(commentToggle.dataset.comments)}`);
      area.classList.toggle("hidden");
    }
  });
  $("#gallery").addEventListener("submit", event => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;
    event.preventDefault();
    const name = form.elements.name.value;
    const text = form.elements.text.value;
    if (!addComment(form.dataset.commentForm, name, text)) return showToast("Please enter your name and comment.", "error");
    form.reset();
    renderGallery();
    const newArea = $(`#comments-${CSS.escape(form.dataset.commentForm)}`);
    if (newArea) newArea.classList.remove("hidden");
    showToast("Comment added.", "success");
  });

  $("#editForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!state.isAdmin) return;
    if (!editPhoto($("#editPhotoId").value, $("#editPhotoTitle").value, $("#editPhotoDescription").value)) return;
    closeModal("editModal");
    renderGallery();
    showToast("Memory updated.", "success");
  });
  $("#lightboxPrev").addEventListener("click", () => navigateLightbox(-1));
  $("#lightboxNext").addEventListener("click", () => navigateLightbox(1));
  document.addEventListener("keydown", event => {
    if (!$("#lightboxModal").hidden) {
      if (event.key === "Escape") closeModal("lightboxModal");
      if (event.key === "ArrowLeft") navigateLightbox(-1);
      if (event.key === "ArrowRight") navigateLightbox(1);
    }
  });

  $("#contactForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#contactName").value.trim();
    const email = $("#contactEmail").value.trim();
    const message = $("#contactMessage").value.trim();
    if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showToast("Please enter a valid name, email, and message.", "error");
    }
    const messages = storageGet(KEYS.contacts, []);
    messages.push({ id: uid("contact"), name, email, message, date: new Date().toISOString() });
    if (!storageSet(KEYS.contacts, messages)) return;
    event.target.reset();
    showToast("Your note was saved locally.", "success");
  });

  window.addEventListener("beforeunload", stopCamera);
  renderGallery();
});
