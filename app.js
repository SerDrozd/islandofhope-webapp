(function () {
  const tg = window.Telegram?.WebApp;
    const diag = {
      hasTelegramObject: !!window.Telegram,
      hasWebApp: !!window.Telegram?.WebApp,
      ua: navigator.userAgent,
      initDataLen: window.Telegram?.WebApp?.initData?.length || 0,
      hashHasTgWebAppData: /tgWebAppData=/.test(location.hash || ""),
      hashLen: (location.hash || "").length,
    };

    const dbg = document.createElement("pre");
    dbg.style.whiteSpace = "pre-wrap";
    dbg.style.fontSize = "12px";
    dbg.style.opacity = "0.9";
    dbg.style.marginTop = "12px";
    dbg.style.padding = "10px";
    dbg.style.borderRadius = "12px";
    dbg.style.border = "1px solid rgba(255,255,255,.12)";
    dbg.style.background = "rgba(255,255,255,.04)";
    dbg.textContent = "DIAG:\n" + JSON.stringify(diag, null, 2);
    document.querySelector(".card")?.appendChild(dbg);
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const qs = new URLSearchParams(location.search);
  const mode = (qs.get("mode") || "task").toLowerCase();
  const dataB64 = qs.get("data") || "";

  const elTitle = document.getElementById("pageTitle");
  const elSub = document.getElementById("pageSub");

  const taskForm = document.getElementById("taskForm");
  const reqForm = document.getElementById("reqForm");
  const status = document.getElementById("status");

  function showStatus(text, ok) {
    status.classList.remove("hidden", "ok", "err");
    status.classList.add(ok ? "ok" : "err");
    status.textContent = text;
  }

  function b64ToJson(b64) {
    try {
      const padded =
        b64.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((b64.length + 3) % 4);
      const raw = atob(padded);
      const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
      const str = new TextDecoder("utf-8").decode(bytes);
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  // ---- initData fallback: try to extract from URL hash (#tgWebAppData=...) ----
  function extractInitData() {
    if (tg?.initData && tg.initData.length > 0) return tg.initData;

    const h = window.location.hash || "";
    const m = h.match(/tgWebAppData=([^&]+)/);
    if (m && m[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
    return "";
  }

  // Toggle cargo
  const cargoBtn = document.getElementById("taskCargo");
  let cargoState = false;

  function setCargo(v) {
    cargoState = !!v;
    cargoBtn?.setAttribute("aria-pressed", cargoState ? "true" : "false");
    if (cargoBtn) cargoBtn.textContent = cargoState ? "Да" : "Нет";
  }

  cargoBtn?.addEventListener("click", () => setCargo(!cargoState));

  // Show correct form
  function showMode(m) {
    taskForm.classList.add("hidden");
    reqForm.classList.add("hidden");

    if (m.startsWith("task")) {
      elTitle.textContent = m === "task_edit" ? "Редактирование задачи" : "Новая задача";
      elSub.textContent = "Заполни поля и отправь в бот";
      taskForm.classList.remove("hidden");
    } else {
      elTitle.textContent = m === "request_edit" ? "Редактирование заявки" : "Новая заявка";
      elSub.textContent = "Опиши, что нужно отвезти";
      reqForm.classList.remove("hidden");
    }
  }

  showMode(mode);

  // Prefill
  const prefill = dataB64 ? b64ToJson(dataB64) : null;
  if (prefill) {
    if (mode.startsWith("task")) {
      document.getElementById("taskId").value = prefill.id || "";
      document.getElementById("taskDate").value = prefill.date || "";
      document.getElementById("taskTime").value = prefill.time || "";
      document.getElementById("taskDistrict").value = prefill.district || "";
      document.getElementById("taskSeats").value = prefill.seats_total || 1;
      document.getElementById("taskComment").value = prefill.comment || "";
      setCargo(!!prefill.has_cargo);
      document.getElementById("taskSubmit").textContent = "Сохранить";
    } else {
      document.getElementById("reqId").value = prefill.id || "";
      document.getElementById("reqComment").value = prefill.comment || "";
      document.getElementById("reqSubmit").textContent = "Сохранить";
    }
  } else {
    if (mode.startsWith("task")) setCargo(false);
  }

  function send(payload) {
    if (!tg) {
      showStatus("⛔ Открой форму внутри Telegram (WebApp).", false);
      return;
    }

    const initData = extractInitData();
    payload.initData = initData;

    if (!initData) {
      showStatus("⛔ initData пустой. Открывай форму только кнопкой бота.", false);
      return;
    }

    tg.sendData(JSON.stringify(payload));
    showStatus("✅ Отправлено", true);
    setTimeout(() => tg.close(), 450);
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = (document.getElementById("taskId").value || "").trim();
    const date = document.getElementById("taskDate").value;
    const time = document.getElementById("taskTime").value;
    const district = (document.getElementById("taskDistrict").value || "").trim();
    const seats_total = parseInt(document.getElementById("taskSeats").value || "0", 10);
    const comment = (document.getElementById("taskComment").value || "").trim();

    if (!date || !time || district.length < 2) {
      showStatus("Заполни дату, время и район.", false);
      return;
    }
    if (!Number.isFinite(seats_total) || seats_total < 1 || seats_total > 99) {
      showStatus("Кол-во мест должно быть 1..99.", false);
      return;
    }

    const action = mode === "task_edit" ? "update_task" : "create_task";
    const payload = {
      action,
      date,
      time,
      district,
      seats_total,
      has_cargo: cargoState,
      comment,
    };

    if (action === "update_task") payload.id = parseInt(id || "0", 10);

    send(payload);
  });

  reqForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = (document.getElementById("reqId").value || "").trim();
    const comment = (document.getElementById("reqComment").value || "").trim();

    if (comment.length < 3) {
      showStatus("Комментарий слишком короткий.", false);
      return;
    }

    const action = mode === "request_edit" ? "update_request" : "create_request";
    const payload = { action, comment };

    if (action === "update_request") payload.id = parseInt(id || "0", 10);

    send(payload);
  });
})();
