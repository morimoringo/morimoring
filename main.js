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
  return expense.endDate && expense.firstDate !== expense.endDate;
}

function groupByMonth(expenses) {
  const grouped = {};

  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  expenses.forEach((exp) => {
    const end = exp.endDate ? new Date(exp.endDate) : new Date(exp.firstDate);

    let current = new Date(
      new Date(exp.firstDate).getFullYear(),
      new Date(exp.firstDate).getMonth(),
      1,
    );

    while (current <= end) {
      // 🔹 過去月はスキップ
      if (current < thisMonth) {
        current.setMonth(current.getMonth() + 1);
        continue;
      }

      const key = `${current.getFullYear()}-${String(
        current.getMonth() + 1,
      ).padStart(2, "0")}`;

      if (!grouped[key]) grouped[key] = [];

      if (!exp.hiddenMonths?.includes(key)) {
        grouped[key].push(exp);
      }

      current.setMonth(current.getMonth() + 1);
    }
  });

  return grouped;
}

function groupByExpense(expenses) {
  const grouped = {};
  expenses.forEach((exp) => {
    const key = exp.id;
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
  const amount = Number(amountInput.value);
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
      const index = expenses.findIndex((e) => e.id === editingId);
      if (index !== -1) {
        expenses[index] = {
          id: editingId,
          name,
          amount,
          firstDate,
          endDate,
          hiddenMonths: expenses[index].hiddenMonths || [],
        };
      }
      editingId = null;
    } else {
      expenses.push({
        id: Date.now(),
        name,
        amount,
        firstDate,
        endDate,
        hiddenMonths: [],
      });
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
  // safety: expense が undefined の場合は空の要素を返してクラッシュを防ぐ
  if (!expense) {
    const li = document.createElement("li");
    li.classList.add("grid");
    li.textContent = "(データなし)";
    return li;
  }

  const day = new Date(expense.firstDate).getDate();
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
    // recurring判定
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
    endDateInput.value = expense.endDate || "";

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
  // 削除（分岐あり）
  // =========================
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "削除";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    // recurring判定
    const isRecurring =
      expense.isRecurring || recurringExpenses.some((r) => r.id === expense.id);

    if (isRecurring) {
      recurringExpenses = recurringExpenses.filter((r) => r.id !== expense.id);
      message.textContent = "削除したよ～";
    }
    // 月別表示で分割データなら「その月だけ削除」
    else if (view === "list" && monthKey && isInstallment(expense)) {
      expense.hiddenMonths = expense.hiddenMonths || [];
      if (!expense.hiddenMonths.includes(monthKey)) {
        expense.hiddenMonths.push(monthKey);
      }
      message.textContent = "今月分だけ削除したよ";
    }
    // それ以外は完全削除
    else {
      expenses = expenses.filter((e) => e.id !== expense.id);
      message.textContent = "削除したよ～";
    }

    saveData();
    renderAllLists();
    message.classList.add("show");
    setTimeout(() => message.classList.remove("show"), 2000);
  });

  buttonsDiv.appendChild(deleteBtn);

  // =========================
  // 全削（分割のみ）
  // =========================
  if (isInstallment(expense)) {
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.textContent = "全削";
    deleteAllBtn.classList.add("delete-all-btn");

    deleteAllBtn.addEventListener("click", () => {
      expenses = expenses.filter((e) => e.id !== expense.id);

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

// 登録期間そのまま表示（今までのやつ）
function formatInstallmentPeriod(expense) {
  const start = new Date(expense.firstDate);
  const end = new Date(expense.endDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return `${start.getFullYear()}/${start.getMonth() + 1}〜${end.getFullYear()}/${end.getMonth() + 1}`;
}

// 今日基準で残り回数を計算（今月含む）
function formatRemainingInstallment(expense) {
  const start = new Date(expense.firstDate);
  const end = new Date(expense.endDate);

  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 残り計算の開始月
  const firstMonth = thisMonth > start ? thisMonth : start;

  let totalMonths =
    (end.getFullYear() - firstMonth.getFullYear()) * 12 +
    (end.getMonth() - firstMonth.getMonth()) +
    1;

  if (totalMonths <= 0) return 0;

  // hiddenMonths を除外
  const hidden = expense.hiddenMonths || [];

  let hiddenCount = 0;

  hidden.forEach((key) => {
    const [year, month] = key.split("-").map(Number);
    const hiddenDate = new Date(year, month - 1, 1);

    if (hiddenDate >= firstMonth && hiddenDate <= end) {
      hiddenCount++;
    }
  });

  return Math.max(totalMonths - hiddenCount, 0);
}

// renderList の該当部分
function renderList(targetEl, mode = "normal", view = "list") {
  targetEl.innerHTML = "";

  const filtered = expenses.filter((exp) => {
    if (mode === "normal") return true; // すべて表示
    if (mode === "installment") return isInstallment(exp); // 分割だけ
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

  // 追加: 他のデータが2ヶ月以下でも、毎月モードで登録がある場合のみ
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

        // renderList 内の recurring 展開部分
        recurringExpenses.forEach((rec) => {
          const startMonth = rec.firstDate.slice(0, 7); // YYYY-MM
          if (key >= startMonth) {
            // 既存 expenses に同じ id のものがあればそれを使う
            const linkedExpense = expenses.find((e) => e.id === rec.id);

            const li = renderExpense(
              linkedExpense || {
                ...rec,
                amount: rec.amount,
                isRecurring: true,
              },
              key,
              "list",
            );
            ul.appendChild(li);

            // 月別調整を考慮した金額を合計に加算
            if (linkedExpense) {
              total += linkedExpense.amount;
            } else {
              const adjustedAmount =
                rec.monthlyAdjustments && rec.monthlyAdjustments[key]
                  ? rec.monthlyAdjustments[key]
                  : rec.amount;
              total += adjustedAmount;
            }
          }
        });
      } else if (view === "split") {
        const expense = items[0];
        if (!expense) return; // items が空の場合はスキップ

        // li は 1 つだけ
        const li = renderExpense(expense, null, "split");
        ul.appendChild(li);

        // タイトル：名前＋月額
        title.innerHTML = `<div class="split-title">
                <div class="name">
                    ${expense.amount.toLocaleString()}円
                    <span class="label3">（${formatInstallmentPeriod(expense)}）</span>
                </div>
            </div>`;
      }

      box.appendChild(title);
      const details = document.createElement("div");
      details.classList.add("details");
      details.appendChild(ul);
      box.appendChild(details);

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

      title.addEventListener("click", () => {
        if (box.classList.contains("open")) {
          details.style.maxHeight = null;
          box.classList.remove("open");
        } else {
          details.style.maxHeight = details.scrollHeight + "px";
          box.classList.add("open");
        }
      });

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

// 毎月を最低3ヵ月分確保
function syncRecurringMonths() {
  if (recurringExpenses.length === 0) return;

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  recurringExpenses.forEach((rec) => {
    const start = new Date(rec.startDate);
    const startMonth = start.getFullYear() * 12 + start.getMonth();

    if (!rec.generatedMonths) {
      rec.generatedMonths = [];
    }

    // 現在月との差
    const diff = currentMonth - startMonth;
    if (diff < 0) return;

    // 既存の他データの最大月数
    const otherMonths = expenses.length;
    const targetLength = Math.max(3, otherMonths);

    while (rec.generatedMonths.length < targetLength) {
      const nextMonth = startMonth + rec.generatedMonths.length;

      if (nextMonth > currentMonth) break;

      const year = Math.floor(nextMonth / 12);
      const month = nextMonth % 12;

      expenses.push({
        ...rec,
        year,
        month,
        amount: 0,
        isAuto: true,
      });

      rec.generatedMonths.push(nextMonth);
    }
  });
}

// 全リスト再描画
function renderAllLists() {
  // 自動生成データは保存しない
  const displayExpenses = generateRecurringDisplayData([...expenses]);

  // 残り0回の分割は自動削除
  expenses = expenses.filter((exp) => {
    if (!isInstallment(exp)) return true;
    return formatRemainingInstallment(exp) > 0;
  });

  saveData();

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

function generateRecurringDisplayData(baseExpenses) {
  const result = [...baseExpenses];

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  recurringExpenses.forEach((rec) => {
    const start = new Date(rec.firstDate);
    const startMonth = start.getFullYear() * 12 + start.getMonth();

    const otherMonths = baseExpenses.length;
    const targetLength = Math.max(3, otherMonths);

    for (let i = 0; i < targetLength; i++) {
      const monthIndex = startMonth + i;
      if (monthIndex > currentMonth) break;

      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;

      result.push({
        ...rec,
        year,
        month,
        isAuto: true,
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
