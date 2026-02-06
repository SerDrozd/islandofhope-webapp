(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const $ = (id) => document.getElementById(id);
  const errorBox = $("errorBox");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function pathMode() {
    const p = (window.location.pathname || "/").toLowerCase();
    if (p.includes("/task")) return "task";
    if (p.includes("/request")) return "request";
    // fallback: use query ?mode=
    const mode = new URLSearchParams(window.location.search).get("mode");
    return (mode === "task" || mode === "request") ? mode : "task";
  }

  const mode = pathMode();
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id"); // task_id or request_id for editing

  const title = $("title");
  const subtitle = $("subtitle");
  const taskForm = $("taskForm");
  const requestForm = $("requestForm");

  function setTitle(t, s) {
    title.textContent = t;
    subtitle.textContent = s || "Внутри Telegram WebApp";
  }

  function initDefaultsTask() {
    // set default date/time to nearest
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    $("task_date").value = `${yyyy}-${mm}-${dd}`;

    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    $("task_time").value = `${hh}:${mi}`;

    $("task_seats").value = "1";
    $("task_cargo").checked = false;
  }

  function sanitizeText(s, maxLen) {
    s = (s || "").toString().trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function getInitData() {
    // This is what we validate on the bot / backend
    return tg ? (tg.initData || "") : "";
  }

  async function apiGet(url) {
    // pass initData in query (simple), could also use header X-Tg-Init-Data
    const initData = encodeURIComponent(getInitData());
    const sep = url.includes("?") ? "&" : "?";
    const full = `${url}${sep}initData=${initData}`;
    const res = await fetch(full, { method: "GET" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    return j;
  }

  function send(payload) {
    clearError();
    if (!tg) {
      showError("Откройте форму внутри Telegram (WebApp).");
      return;
    }
    payload.initData = getInitData(); // IMPORTANT: bot validates this
    tg.sendData(JSON.stringify(payload));
  }

  async function loadEditData() {
    if (!editId) return;

    if (mode === "task") {
      setTitle("Редактирование задачи", `#${editId}`);
      const j = await apiGet(`/api/task?id=${encodeURIComponent(editId)}`);
      const t = j.task;

      $("task_date").value = t.date || "";
      $("task_time").value = t.time || "";
      $("task_district").value = t.district || "";
      $("task_seats").value = String(t.seats_total ?? 1);
      $("task_cargo").checked = (Number(t.has_cargo) === 1);
      $("task_comment").value = t.comment || "";
      return;
    }

    if (mode === "request") {
      setTitle("Редактирование заявки", `#${editId}`);
      const j = await apiGet(`/api/request?id=${encodeURIComponent(editId)}`);
      const r = j.request;
      $("req_comment").value = r.comment || "";
      return;
    }
  }

  function setSent(statusEl) {
    statusEl.textContent = "✅ Отправлено";
    setTimeout(() => {
      try { tg.close(); } catch (e) {}
    }, 450);
  }

  // ----- render mode -----
  if (mode === "task") {
    taskForm.classList.remove("hidden");
    requestForm.classList.add("hidden");

    setTitle(editId ? "Редактирование задачи" : "Новая задача", "Заполните поля");
    initDefaultsTask();

    loadEditData().catch((e) => showError(`Не удалось загрузить данные: ${e.message}`));

    $("task_submit").addEventListener("click", () => {
      clearError();
      const date = $("task_date").value;
      const time = $("task_time").value;
      const district = sanitizeText($("task_district").value, 60);
      const seats = Number($("task_seats").value);
      const hasCargo = $("task_cargo").checked;
      const comment = sanitizeText($("task_comment").value, 500);

      if (!date) return showError("Укажите дату.");
      if (!time) return showError("Укажите время.");
      if (!district || district.length < 2) return showError("Укажите район (минимум 2 символа).");
      if (!Number.isInteger(seats) || seats < 1 || seats > 99) return showError("Количество мест должно быть 1..99.");

      const payload = {
        action: editId ? "update_task" : "create_task",
        ...(editId ? { id: Number(editId) } : {}),
        date,
        time,
        district,
        seats_total: seats,
        has_cargo: hasCargo,
        comment,
      };

      send(payload);
      setSent($("task_status"));
    });
  } else {
    requestForm.classList.remove("hidden");
    taskForm.classList.add("hidden");

    setTitle(editId ? "Редактирование заявки" : "Новая заявка", "Опишите что и куда");
    loadEditData().catch((e) => showError(`Не удалось загрузить данные: ${e.message}`));

    $("req_submit").addEventListener("click", () => {
      clearError();
      const comment = sanitizeText($("req_comment").value, 800);
      if (!comment || comment.length < 3) return showError("Комментарий должен быть минимум 3 символа.");

      const payload = {
        action: editId ? "update_request" : "create_request",
        ...(editId ? { id: Number(editId) } : {}),
        comment,
      };

      send(payload);
      setSent($("req_status"));
    });
  }
})();
