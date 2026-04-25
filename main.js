// =======================================
// ユーティリティ関数
// =======================================
function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =======================================
// データ管理
// =======================================
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let recurringExpenses =
  JSON.parse(localStorage.getItem("recurringExpenses")) || [];
let editingId = null;
let editingRecurringId = null;
let adjustingMonthKey = null;
let openedMonthKeys = new Set();

function saveData() {
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("recurringExpenses", JSON.stringify(recurringExpenses));
}

function isInstallment(expense) {
  return expense.type === "installment";
}

function createInstallments(baseData, totalMonths) {
  const parentId = crypto.randomUUID();
  const results = [];

  const start = new Date(baseData.firstDate);

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = "01";

    results.push({
      ...baseData,
      id: crypto.randomUUID(),
      parentId,
      type: "installment",
      installmentIndex: i + 1,
      installmentTotal: totalMonths,
      firstDate: `${yyyy}-${mm}-${dd}`,
    });
  }

  return results;
}

function groupByMonth(expenses) {
  const grouped = {};

  expenses.forEach((exp) => {
    const d = new Date(exp.firstDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}`;

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });

  return grouped;
}

function groupByExpense(expenses) {
  const grouped = {};
  expenses.forEach((exp) => {
    const key = exp.parentId || exp.id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });
  return grouped;
}

// =======================================
// DOM要素
// =======================================
const form = document.getElementById("expense-form");
const lala = document.querySelector(".lala");
const coco = document.querySelector(".coco");
const nameInput = document.getElementById("name");
const amountInput = document.getElementById("amount");
const firstDateInput = document.getElementById("first-date");
const endDateInput = document.getElementById("end-date");

const tabNormal = document.getElementById("tab-normal");
const tabInstallment = document.getElementById("tab-installment");
const tabRecurring = document.getElementById("tab-recurring");
const normalList = document.getElementById("normal");
const installmentList = document.getElementById("installment");
const recurringList = document.getElementById("recurring");

const groupAmount = document.getElementById("group-amount");
const groupTimes = document.getElementById("group-times");
const groupEnd = document.getElementById("group-end");

const toggleBtn = document.getElementById("mode-toggle");

const message = document.getElementById("message");

let formMode = "normal";

// =======================================
// イベント系
// =======================================

// タブ切替
tabNormal.addEventListener("click", () => {
  tabNormal.classList.add("active");
  tabInstallment.classList.remove("active");
  normalList.style.display = "block";
  installmentList.style.display = "none";
  recurringList.style.display = "none";
});

tabInstallment.addEventListener("click", () => {
  tabInstallment.classList.add("active");
  tabNormal.classList.remove("active");
  installmentList.style.display = "block";
  normalList.style.display = "none";
  recurringList.style.display = "none";
});

tabRecurring.addEventListener("click", () => {
  tabRecurring.classList.add("active");
  tabNormal.classList.remove("active");
  tabInstallment.classList.remove("active");
  recurringList.style.display = "block";
  normalList.style.display = "none";
  installmentList.style.display = "none";
});

// ラベル色変化
document.querySelectorAll(".row input, .row2 input").forEach((input) => {
  input.addEventListener("input", () => {
    const colon = input.previousElementSibling;
    const label = colon ? colon.previousElementSibling : null;
    [label, colon].filter(Boolean).forEach((el) => {
      el.style.color = input.value.trim() ? "#df67bd" : "";
    });
  });
});

// 入力欄の値に応じてラベル色を更新するユーティリティ
function updateLabelColors() {
  document.querySelectorAll(".row input, .row2 input").forEach((input) => {
    const colon = input.previousElementSibling;
    const label = colon ? colon.previousElementSibling : null;
    [label, colon].filter(Boolean).forEach((el) => {
      el.style.color = input.value.trim() ? "#df67bd" : "";
    });
  });
}

// フォームがリセットされたときにラベル色を元に戻す
form.addEventListener("reset", () => {
  // reset() が同期的に値を戻す場合に備え、次タスクで反映させる
  setTimeout(updateLabelColors, 0);
});

//固定費用モード
function applyFormMode() {
  const isRecurring = formMode === "recurring";

  // ボタンUI
  toggleBtn.textContent = isRecurring ? "毎月モード" : "通常モード";

  // ボタンクラス切り替え
  toggleBtn.classList.toggle("normal", !isRecurring);
  toggleBtn.classList.toggle("recurring", isRecurring);

  // 無効化
  amountInput.disabled = isRecurring;
  endDateInput.disabled = isRecurring;

  // required制御
  amountInput.required = !isRecurring;

  // 見た目
  document
    .querySelectorAll(".lala, .coco, #amount, #end-date")
    .forEach((el) => {
      el.classList.toggle("disabled", isRecurring);
    });
}

toggleBtn.addEventListener("click", () => {
  formMode = formMode === "normal" ? "recurring" : "normal";
  console.log("formMode:", formMode);
  applyFormMode();
});

// フォーム送信
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const amount = Number(amountInput.value || 0);
  const firstDate = firstDateInput.value;
  const endDate = endDateInput.value || null;

  const isRecurring = formMode === "recurring";

  // =========================
  // 月別金額調整の場合
  // =========================
  if (adjustingMonthKey && editingRecurringId) {
    const rec = recurringExpenses.find((r) => r.id === editingRecurringId);
    if (rec && amount > 0) {
      if (!rec.monthlyAdjustments) {
        rec.monthlyAdjustments = {};
      }
      rec.monthlyAdjustments[adjustingMonthKey] = amount;
      adjustingMonthKey = null;
      editingRecurringId = null;

      saveData();
      renderAllLists();

      message.textContent = "金額を調整したよ～";
      message.classList.add("show");
      setTimeout(() => message.classList.remove("show"), 2000);

      form.reset();
      return;
    }
  }

  // バリデーション分岐
  if (isRecurring) {
    if (!name || !firstDate) {
      alert("必要な項目を入力してね");
      return;
    }
  } else {
    if (!name || !amount || !firstDate) {
      alert("必要な項目を入力してね");
      return;
    }
  }

  // =========================
  // recurring編集
  // =========================
  if (editingRecurringId) {
    const recIndex = recurringExpenses.findIndex(
      (r) => r.id === editingRecurringId,
    );
    if (recIndex !== -1) {
      recurringExpenses[recIndex].name = name;
      recurringExpenses[recIndex].amount = amount;
      recurringExpenses[recIndex].firstDate = firstDate;
      recurringExpenses[recIndex].day = new Date(firstDate).getDate();
    }
    editingRecurringId = null;

    message.textContent = "編集したよ～";
    message.classList.add("show");
    setTimeout(() => message.classList.remove("show"), 2000);

    // =========================
    // 通常処理
    // =========================
  } else if (isRecurring) {
    recurringExpenses.push({
      id: Date.now(),
      name,
      amount,
      day: new Date(firstDate).getDate(), // 引き落とし日だけ使う設計なら
      firstDate,
      hiddenMonths: [],
    });
  } else {
    if (editingId) {
      // 🔵 編集は「親単位」で処理
      const target = expenses.find((e) => e.id === editingId);
      if (!target) return;

      if (target.parentId) {
        const start = new Date(firstDate);
        const end = new Date(endDate);

        const totalMonths =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) +
          1;

        // 既存分割削除
        expenses = expenses.filter((e) => e.parentId !== target.parentId);

        // 新しい分割生成
        const items = createInstallments(
          { name, amount, firstDate },
          totalMonths,
        );

        expenses.push(...items);
      } else {
        // 通常データ編集
        const index = expenses.findIndex((e) => e.id === editingId);
        if (index !== -1) {
          expenses[index] = {
            ...expenses[index],
            name,
            amount,
            firstDate,
          };
        }
      }

      editingId = null;
    } else {
      if (endDate) {
        const start = new Date(firstDate);
        const end = new Date(endDate);

        const totalMonths =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) +
          1;

        const items = createInstallments(
          { name, amount, firstDate },
          totalMonths,
        );

        expenses.push(...items);
      } else {
        expenses.push({
          id: crypto.randomUUID(),
          name,
          amount,
          firstDate,
          type: "normal",
        });
      }
    }
  }

  saveData();
  renderAllLists();

  message.textContent = "追加したよ～";
  message.classList.add("show");
  setTimeout(() => message.classList.remove("show"), 2000);

  form.reset();
});

// =======================================
// 表示系
// =======================================
function renderExpense(expense, monthKey = null, view = "list") {
  console.log("view:", view, "isInstallment:", isInstallment(expense));
  if (!expense) {
    const li = document.createElement("li");
    li.classList.add("grid");
    li.textContent = "(データなし)";
    return li;
  }

  const day = Number(expense.firstDate.split("-")[2]);
  const li = document.createElement("li");
  li.classList.add("grid");

  // 月別金額調整の確認
  let displayAmount = expense.amount;
  if (expense.isRecurring && monthKey) {
    const rec = recurringExpenses.find((r) => r.id === expense.id);
    if (rec && rec.monthlyAdjustments && rec.monthlyAdjustments[monthKey]) {
      displayAmount = rec.monthlyAdjustments[monthKey];
    }
  }

  li.innerHTML = `
        <span class="top-left">${escapeHTML(expense.name)}</span>
        <span class="bottom-left">毎月${escapeHTML(day)}日</span>
        <span class="right" data-expense-id="${expense.id}" data-month-key="${monthKey || ""}">${escapeHTML(displayAmount.toLocaleString())}<small>円</small></span>
    `;

  // 毎月タブ（recurring view）では右側の金額表示を非表示にする
  const rightSpan = li.querySelector(".right");
  if (view === "recurring" && rightSpan) {
    rightSpan.style.display = "none";
  }

  const buttonsDiv = document.createElement("div");
  buttonsDiv.classList.add("buttons");

  // =========================
  // 編集ボタン
  // =========================
  const editBtn = document.createElement("button");
  editBtn.textContent = "編集";
  editBtn.classList.add("edit-btn");

  editBtn.addEventListener("click", () => {
    const isRecurring =
      expense.isRecurring || recurringExpenses.some((r) => r.id === expense.id);

    if (isRecurring) {
      formMode = "recurring";
      editingRecurringId = expense.id;
    } else {
      formMode = "normal";
      editingId = expense.id;
    }

    applyFormMode();

    nameInput.value = expense.name;
    amountInput.value = expense.amount || "";
    firstDateInput.value = expense.firstDate;

    // ▼ 分割の場合は最終月を計算
    if (expense.parentId) {
      const group = expenses.filter((e) => e.parentId === expense.parentId);

      const last = group.reduce((a, b) =>
        new Date(a.firstDate) > new Date(b.firstDate) ? a : b,
      );

      endDateInput.value = last.firstDate;
    } else {
      endDateInput.value = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // recurringデータの場合、recurringタブでのみ編集ボタンを表示
  const isRecurring =
    expense.isRecurring || recurringExpenses.some((r) => r.id === expense.id);
  if (!isRecurring || view === "recurring") {
    buttonsDiv.appendChild(editBtn);
  }

  // =========================
  // 月別金額調整ボタン（recurringのみ）
  // =========================
  if (expense.isRecurring && monthKey) {
    const adjustBtn = document.createElement("button");
    adjustBtn.textContent = "金額調節";
    adjustBtn.classList.add("adjust-btn");

    adjustBtn.addEventListener("click", () => {
      const rightSpan = li.querySelector(".right");
      const currentAmount = Number(
        rightSpan.textContent.replace("円", "").trim().replace(/,/g, ""),
      );

      // 既存のinputがあれば削除
      const existingInput = rightSpan.querySelector("input");
      if (existingInput) return;

      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.value = currentAmount;
      amountInput.classList.add("inline-amount-input");
      amountInput.style.width = "80px";

      amountInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          amountInput.blur();
        }
      });

      amountInput.addEventListener("blur", () => {
        const newAmount = Number(amountInput.value);
        if (newAmount > 0 && newAmount !== currentAmount) {
          const rec = recurringExpenses.find((r) => r.id === expense.id);
          if (rec) {
            if (!rec.monthlyAdjustments) {
              rec.monthlyAdjustments = {};
            }
            rec.monthlyAdjustments[monthKey] = newAmount;
            saveData();
            renderAllLists();
          }
        } else {
          // キャンセルの場合は再描画
          renderAllLists();
        }
      });

      rightSpan.innerHTML = "";
      rightSpan.appendChild(amountInput);
      const smallEl = document.createElement("small");
      smallEl.textContent = "円";
      rightSpan.appendChild(smallEl);

      setTimeout(() => amountInput.focus(), 0);
    });

    buttonsDiv.appendChild(adjustBtn);
  }

  // =========================
  // 削除ボタン
  // =========================
  if (
    view === "recurring" ||
    (view === "list" && expense.isRecurring) ||
    (view === "list" && !expense.isRecurring)
  ) {
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.classList.add("delete-btn");

    deleteBtn.addEventListener("click", () => {
      if (expense.isRecurring) {
        if (view === "recurring") {
          // 完全削除
          recurringExpenses = recurringExpenses.filter(
            (r) => r.id !== expense.id,
          );
        } else {
          // 今月だけ削除
          const rec = recurringExpenses.find((r) => r.id === expense.id);
          if (rec && monthKey) {
            if (!rec.hiddenMonths) rec.hiddenMonths = [];
            if (!rec.hiddenMonths.includes(monthKey)) {
              rec.hiddenMonths.push(monthKey);
            }
          }
        }
      } else {
        expenses = expenses.filter((e) => e.id !== expense.id);
      }

      saveData();
      renderAllLists();
    });

    buttonsDiv.appendChild(deleteBtn);
  }

  // =========================
  // 全削（分割のみ）
  // =========================
  if (isInstallment(expense)) {
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.textContent = "全削";
    deleteAllBtn.classList.add("delete-all-btn");

    deleteAllBtn.addEventListener("click", () => {
      expenses = expenses.filter((e) => e.parentId !== expense.parentId);
      saveData();
      renderAllLists();
      message.textContent = "全月分削除したよ";
      message.classList.add("show");
      setTimeout(() => message.classList.remove("show"), 2000);
    });

    buttonsDiv.appendChild(deleteAllBtn);
  }

  li.appendChild(buttonsDiv);
  return li;
}

function formatRemainingInstallment(expense) {
  if (!expense.parentId) return 0;

  return expenses.filter((e) => e.parentId === expense.parentId).length;
}

// renderList の該当部分
function renderList(targetEl, mode = "normal", view = "list", data = expenses) {
  targetEl.innerHTML = "";

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 3, 1);

  const filtered = data.filter((exp) => {
    const d = new Date(exp.firstDate);

    // 月別表示は3ヶ月以内だけ
    if (mode === "normal") {
      return d >= startMonth && d < endMonth;
    }

    if (mode === "installment") {
      return isInstallment(exp);
    }

    return true;
  });

  let grouped;
  if (view === "list") grouped = groupByMonth(filtered);
  else if (view === "split") grouped = groupByExpense(filtered);

  // normalモードかつnormalデータが無い場合、recurringから3ヵ月分の月グループを作成
  if (
    mode === "normal" &&
    view === "list" &&
    Object.keys(grouped).length === 0
  ) {
    recurringExpenses.forEach((rec) => {
      const startDate = new Date(rec.firstDate);
      const startYear = startDate.getFullYear();
      const startMonthNum = startDate.getMonth();

      // 3ヵ月分のグループを作成
      for (let i = 0; i < 3; i++) {
        const year = startYear + Math.floor((startMonthNum + i) / 12);
        const month = (startMonthNum + i) % 12;
        const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!grouped[monthKey]) {
          grouped[monthKey] = [];
        }
      }
    });
  }

  // 今月以降を最低3ヵ月分表示する（当月・翌月・翌々月）
  if (recurringExpenses.length > 0) {
    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 3; i++) {
      const d = new Date(
        startMonth.getFullYear(),
        startMonth.getMonth() + i,
        1,
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = [];
    }
  }

  Object.keys(grouped)
    .sort()
    .forEach((key) => {
      const items = grouped[key];

      const box = document.createElement("div");
      box.classList.add("box");

      const title = document.createElement("span");
      title.classList.add("box-title");

      const ul = document.createElement("ul");
      let total = 0;

      if (view === "list") {
        const [year, month] = key.split("-");
        title.textContent = `${year}年${month}月`;

        // undefined を含む可能性があるためフィルタリングしてから描画
        items.filter(Boolean).forEach((exp) => {
          const li = renderExpense(exp, key, "list");
          ul.appendChild(li);
          total += exp.amount || 0;
        });
      } else if (view === "split") {
        const expense = items[0];
        if (!expense) return; // items が空の場合はスキップ

        // li は 1 つだけ
        const li = renderExpense(expense, null, "split");
        ul.appendChild(li);

        // 分割ビューではタイトルを表示しない（非表示）
        title.style.display = "none";
      }

      box.appendChild(title);
      const details = document.createElement("div");
      details.classList.add("details");
      details.appendChild(ul);
      box.appendChild(details);

      // 分割ビューでは折り畳み不可にする（常に展開）
      if (view === "split") {
        details.style.maxHeight = "1000px";
        box.classList.add("open");
      }

      const totalDiv = document.createElement("div");
      totalDiv.className = "total";

      if (view === "list") {
        totalDiv.innerHTML = `<span class="label1">合計 ：</span>${escapeHTML(total.toLocaleString())}<span class="label2"> 円</span>`;
      }

      if (view === "split") {
        const expense = items[0];
        const remaining = formatRemainingInstallment(expense);

        totalDiv.innerHTML = `
                <span class="split-period">残り${remaining}回</span>
            `;
      }

      box.appendChild(totalDiv);

      // 折り畳みは split ビューでは無効
      if (view !== "split") {
        title.addEventListener("click", () => {
          if (box.classList.contains("open")) {
            details.style.maxHeight = null;
            box.classList.remove("open");
          } else {
            details.style.maxHeight = details.scrollHeight + "px";
            box.classList.add("open");
          }
        });
      }

      targetEl.appendChild(box);
    });

  // 何も表示されなかった場合
  if (!targetEl.children.length) {
    const empty = document.createElement("div");
    empty.classList.add("empty-message");

    empty.textContent =
      view === "split" ? "まだ分割はないよ" : "まだ登録されてないよ";

    targetEl.appendChild(empty);
  }
}

// =======================================
// 削除処理（単体安全削除）
// =======================================
function deleteExpense(expenses, idx) {
  expenses.splice(idx, 1);
}

// 全リスト再描画
function renderAllLists() {
  saveData();

  const displayExpenses = generateDisplayData([...expenses]);

  renderList(normalList, "normal", "list", displayExpenses);
  renderList(installmentList, "installment", "split", displayExpenses);
  renderRecurringList();
}

// recurring専用リスト描画
function renderRecurringList() {
  recurringList.innerHTML = "";

  if (recurringExpenses.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("empty-message");
    empty.textContent = "まだ登録されてないよ";
    recurringList.appendChild(empty);
    return;
  }

  recurringExpenses.forEach((rec) => {
    const box = document.createElement("div");
    box.classList.add("box", "open");

    const ul = document.createElement("ul");

    const li = renderExpense({ ...rec, isRecurring: true }, null, "recurring");
    ul.appendChild(li);

    const details = document.createElement("div");
    details.classList.add("details");
    details.appendChild(ul);
    details.style.maxHeight = "1000px"; // 常に展開状態
    box.appendChild(details);

    recurringList.appendChild(box);
  });
}

function generateDisplayData(baseExpenses) {
  const result = [];

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 3, 1);

  // 通常 + 分割
  baseExpenses.forEach((exp) => {
    const d = new Date(exp.firstDate);

    if (d >= startMonth && d < endMonth) {
      result.push(exp);
    }
  });

  // 毎月
  recurringExpenses.forEach((rec) => {
    for (let i = 0; i < 3; i++) {
      const d = new Date(
        startMonth.getFullYear(),
        startMonth.getMonth() + i,
        rec.day,
      );

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(rec.day).padStart(2, "0");

      const monthKey = `${yyyy}-${mm}`;

      if (rec.hiddenMonths?.includes(monthKey)) continue;

      const adjustedAmount = rec.monthlyAdjustments?.[monthKey] ?? rec.amount;

      result.push({
        ...rec,
        isRecurring: true,
        firstDate: `${yyyy}-${mm}-${dd}`,
        amount: adjustedAmount,
      });
    }
  });

  return result;
}

// =======================================
// 初期描画
// =======================================
applyFormMode();
renderAllLists();
