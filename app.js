(() => {
  const tg = window.Telegram?.WebApp;

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function decodeDataParam() {
    const data = qs("data");
    if (!data) return null;
    try {
      const json = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch (e) {
      try {
        // иногда escape/unescape не нужно
        const json = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(json);
      } catch {
        return null;
      }
    }
  }

  function setValue(id, v) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v ?? "";
  }

  function getValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (el.type === "checkbox") return el.checked;
    return el.value;
  }

  function showError(msg) {
    const box = document.getElementById("errorBox");
    if (!box) return;
    box.style.display = "block";
    box.textContent = msg;
  }

  function hideError() {
    const box = document.getElementById("errorBox");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  function showOk(msg) {
    const box = document.getElementById("okBox");
    if (!box) return;
    box.style.display = "block";
    box.textContent = msg;
  }

  function hideOk() {
    const box = document.getElementById("okBox");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  function mode() {
    return (qs("mode") || "task").toLowerCase();
  }

  function isEditMode(m) {
    return m === "task_edit" || m === "request_edit";
  }

  function init() {
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const m = mode();
    const prefill = decodeDataParam();

    // заголовки/видимость форм
    const titleEl = document.getElementById("title");
    const subtitleEl = document.getElementById("subtitle");
    const formTask = document.getElementById("formTask");
    const formReq = document.getElementById("formReq");

    if (m === "task" || m === "task_edit") {
      formTask.style.display = "block";
      formReq.style.display = "none";
      titleEl.textContent = m === "task_edit" ? "Редактировать задачу" : "Новая задача";
      subtitleEl.textContent = "Заполни детали поездки";
    } else {
      formTask.style.display = "none";
      formReq.style.display = "block";
      titleEl.textContent = m === "request_edit" ? "Редактировать заявку" : "Новая заявка";
      subtitleEl.textContent = "Опиши, что нужно отвезти";
    }

    // prefill
    if (prefill && typeof prefill === "object") {
      if (m === "task_edit") {
        setValue("task_id", prefill.id);
        setValue("date", prefill.date);
        setValue("time", prefill.time);
        setValue("district", prefill.district);
        setValue("seats_total", prefill.seats_total);
        setValue("has_cargo", prefill.has_cargo);
        setValue("comment_task", prefill.comment);
      }
      if (m === "request_edit") {
        setValue("request_id", prefill.id);
        setValue("comment_req", prefill.comment);
      }
    }

    // handlers
    const btnTask = document.getElementById("btnSendTask");
    const btnReq = document.getElementById("btnSendReq");

    if (btnTask) btnTask.addEventListener("click", sendTask);
    if (btnReq) btnReq.addEventListener("click", sendRequest);
  }

  function mustInitData() {
    // Если initData пустой — Telegram открыл не как WebApp (или домен/открытие не то).
    const initData = tg?.initData || "";
    if (!initData) {
      showError("initData пустой. Открывай форму строго кнопкой WebApp от бота (inline-кнопкой).");
      return "";
    }
    return initData;
  }

  function sendTask() {
    hideError();
    hideOk();

    const m = mode();
    const initData = mustInitData();
    if (!initData) return;

    const date = (getValue("date") || "").trim();
    const time = (getValue("time") || "").trim();
    const district = (getValue("district") || "").trim();
    const seats_total = parseInt(getValue("seats_total") || "0", 10);
    const has_cargo = !!getValue("has_cargo");
    const comment = (getValue("comment_task") || "").trim();

    if (!date || !time || district.length < 2) {
      showError("Заполни дату, время и район.");
      return;
    }
    if (!Number.isFinite(seats_total) || seats_total < 1 || seats_total > 99) {
      showError("Количество мест должно быть 1..99");
      return;
    }

    const payload = {
      initData,
      action: m === "task_edit" ? "update_task" : "create_task",
      id: m === "task_edit" ? parseInt(getValue("task_id") || "0", 10) : undefined,
      date,
      time,
      district,
      seats_total,
      has_cargo,
      comment,
    };

    tg.sendData(JSON.stringify(payload));
    showOk("✅ Отправлено");
    setTimeout(() => tg.close(), 350);
  }

  function sendRequest() {
    hideError();
    hideOk();

    const m = mode();
    const initData = mustInitData();
    if (!initData) return;

    const comment = (getValue("comment_req") || "").trim();
    if (comment.length < 3) {
      showError("Комментарий слишком короткий.");
      return;
    }

    const payload = {
      initData,
      action: m === "request_edit" ? "update_request" : "create_request",
      id: m === "request_edit" ? parseInt(getValue("request_id") || "0", 10) : undefined,
      comment,
    };

    tg.sendData(JSON.stringify(payload));
    showOk("✅ Отправлено");
    setTimeout(() => tg.close(), 350);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
