// =======================================
// ユーティリティ関数
// =======================================
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// =======================================
// データ管理
// =======================================
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let editingId = null;

function saveData() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function isInstallment(expense) {
    return expense.endDate && expense.firstDate !== expense.endDate;
}

function groupByMonth(expenses) {
    const grouped = {};
    expenses.forEach(exp => {
        const end = exp.endDate ? new Date(exp.endDate) : new Date(exp.firstDate);
        let current = new Date(new Date(exp.firstDate).getFullYear(), new Date(exp.firstDate).getMonth(), 1);

        while (current <= end) {
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = [];
            if (!exp.hiddenMonths?.includes(key)) grouped[key].push(exp);
            current.setMonth(current.getMonth() + 1);
        }
    });
    return grouped;
}

function groupByExpense(expenses) {
    const grouped = {};
    expenses.forEach(exp => {
        const key = exp.id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(exp);
    });
    return grouped;
}

// =======================================
// DOM要素
// =======================================
const form = document.getElementById('expense-form');
const nameInput = document.getElementById('name');
const amountInput = document.getElementById('amount');
const firstDateInput = document.getElementById('first-date');
const endDateInput = document.getElementById('end-date');

const tabNormal = document.getElementById('tab-normal');
const tabInstallment = document.getElementById('tab-installment');
const normalList = document.getElementById('normal');
const installmentList = document.getElementById('installment');

const message = document.getElementById('message');

// =======================================
// イベント系
// =======================================

// タブ切替
tabNormal.addEventListener('click', () => {
    tabNormal.classList.add('active');
    tabInstallment.classList.remove('active');
    normalList.style.display = 'block';
    installmentList.style.display = 'none';
});

tabInstallment.addEventListener('click', () => {
    tabInstallment.classList.add('active');
    tabNormal.classList.remove('active');
    installmentList.style.display = 'block';
    normalList.style.display = 'none';
});

// ラベル色変化
document.querySelectorAll('.row input, .row2 input').forEach(input => {
    input.addEventListener('input', () => {
        const colon = input.previousElementSibling;
        const label = colon ? colon.previousElementSibling : null;
        [label, colon].filter(Boolean).forEach(el => {
            el.style.color = input.value.trim() ? '#df67bd' : '';
        });
    });
});

// フォーム送信
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const amount = Number(amountInput.value);
    const firstDate = firstDateInput.value;
    const endDate = endDateInput.value || null;

    if (!name || !amount || !firstDate) {
        alert('必要な項目を入力してね');
        return;
    }

    if (editingId) {
        const index = expenses.findIndex(e => e.id === editingId);
        if (index !== -1) {
            expenses[index] = { id: editingId, name, amount, firstDate, endDate, hiddenMonths: expenses[index].hiddenMonths || [] };
        }
        editingId = null;
    } else {
        expenses.push({ id: Date.now(), name, amount, firstDate, endDate, hiddenMonths: [] });
    }

    saveData();
    renderAllLists();

    message.textContent = '追加したよ～';
    message.style.color = 'rgba(255,255,255,1)';
    message.classList.add('show');
    setTimeout(() => message.classList.remove('show'), 2000);

    form.reset();
    form.querySelectorAll('.la, .co, .lala, .coco').forEach(el => el.style.color = '');
});

// =======================================
// 表示系
// =======================================

function renderExpense(expense) {
    const day = new Date(expense.firstDate).getDate();
    const li = document.createElement('li');
    li.classList.add('grid');
    li.innerHTML = `
        <span class="top-left">${escapeHTML(expense.name)}</span>
        <span class="bottom-left">毎月${escapeHTML(day)}日</span>
        <span class="right">${escapeHTML(expense.amount.toLocaleString())}<small>円</small></span>
    `;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add('buttons');

    // 編集ボタン
    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.classList.add('edit-btn');
    editBtn.addEventListener('click', () => {
        nameInput.value = expense.name;
        amountInput.value = expense.amount;
        firstDateInput.value = expense.firstDate;
        endDateInput.value = expense.endDate || '';
        editingId = expense.id;
        document.getElementById("title").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    buttonsDiv.appendChild(editBtn);

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', () => {
        expense.hiddenMonths = expense.hiddenMonths || [];
        const todayKey = `${new Date(expense.firstDate).getFullYear()}-${String(new Date(expense.firstDate).getMonth()+1).padStart(2,'0')}`;
        if (!expense.hiddenMonths.includes(todayKey)) expense.hiddenMonths.push(todayKey);
        saveData();
        renderAllLists();
        message.textContent = '削除したよ～';
        message.classList.add('show');
        setTimeout(() => message.classList.remove('show'), 2000);
    });
    buttonsDiv.appendChild(deleteBtn);

    // 分割のみ全削ボタン
    if (expense.endDate && expense.firstDate !== expense.endDate) {
        const deleteAllBtn = document.createElement('button');
        deleteAllBtn.textContent = '全削';
        deleteAllBtn.classList.add('delete-all-btn');
        deleteAllBtn.addEventListener('click', () => {
            expenses = expenses.filter(e => e.id !== expense.id);
            saveData();
            renderAllLists();
            message.textContent = '全削したよ～';
            message.classList.add('show');
            setTimeout(() => message.classList.remove('show'), 2000);
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
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                    (end.getMonth() - start.getMonth()) + 1;
    return `${start.getFullYear()}/${start.getMonth() + 1} 〜 ${end.getFullYear()}/${end.getMonth() + 1}`;
}

// 今日基準で残り回数を計算（今月含む）
function formatRemainingInstallment(expense) {
    const start = new Date(expense.firstDate);
    const end = new Date(expense.endDate);

    // 今日の年月だけ取り出して 1 日にする
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // まだ始まっていない場合は start を thisMonth に置き換え
    const firstMonth = thisMonth > start ? thisMonth : start;

    // 月単位で残り回数を計算
    let remainingCount = (end.getFullYear() - firstMonth.getFullYear()) * 12 +
                            (end.getMonth() - firstMonth.getMonth()) + 1;

    return Math.max(remainingCount, 0); // 0 未満は 0 に
}


// renderList の該当部分
function renderList(targetEl, mode = 'normal', view = 'list') {
    targetEl.innerHTML = '';

    const filtered = expenses.filter(exp => {
        if (mode === 'normal') return true;  // すべて表示
        if (mode === 'installment') return isInstallment(exp); // 分割だけ
        return true;
    });


    let grouped;
    if (view === 'list') grouped = groupByMonth(filtered);
    else if (view === 'split') grouped = groupByExpense(filtered);

    Object.keys(grouped).sort().forEach(key => {
        const items = grouped[key];
        if (!items.length) return;

        const box = document.createElement('div');
        box.classList.add('box');

        const title = document.createElement('span');
        title.classList.add('box-title');

        const ul = document.createElement('ul');
        let total = 0;

        if (view === 'list') {
            const [year, month] = key.split('-');
            title.textContent = `${year}年${month}月`;

            items.forEach(exp => {
                const li = renderExpense(exp);
                ul.appendChild(li);
                total += exp.amount;
            });
        } else if (view === 'split') {
            const expense = items[0];

            const remaining = formatRemainingInstallment(expense);
            total = expense.amount * remaining;

            // li は 1 つだけ表示
            const li = renderExpense(expense);
            ul.appendChild(li);

            // タイトルに名前＋金額＋残り回数＋期間表示
            title.innerHTML = `<div class="split-title">
                <div class="name">${escapeHTML(expense.name)}（${expense.amount.toLocaleString()}円）　</div>
                <div class="period">残り${remaining}回（${formatInstallmentPeriod(expense)}）</div>
            </div>`;
        }

        box.appendChild(title);
        const details = document.createElement('div');
        details.classList.add('details');
        details.appendChild(ul);
        box.appendChild(details);

        const totalDiv = document.createElement('div');
        totalDiv.className = 'total';
        totalDiv.innerHTML = `<span class="label1">合計 ：</span>${escapeHTML(total.toLocaleString())}<span class="label2"> 円</span>`;
        box.appendChild(totalDiv);

        title.addEventListener('click', () => {
            if (box.classList.contains('open')) {
                details.style.maxHeight = null;
                box.classList.remove('open');
            } else {
                details.style.maxHeight = details.scrollHeight + 'px';
                box.classList.add('open');
            }
        });

        targetEl.appendChild(box);
    });
}


// 全リスト再描画
function renderAllLists() {
    renderList(normalList, 'normal', 'list');
    renderList(installmentList, 'installment', 'split');
}

// =======================================
// 初期描画
// =======================================
renderAllLists();
