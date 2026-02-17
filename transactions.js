console.log('📊 All Transactions Page Loaded');

let allTransactions = [];

// ==================== AUTH CHECK ====================
window.addEventListener('load', () => {
  console.log('✓ Page loaded, checking authentication...');

  const user = localStorage.getItem('user');
  if (!user) {
    console.warn('❌ No user found in localStorage');
    window.location.href = 'login.html';
    return;
  }

  const userData = JSON.parse(user);
  console.log('✅ User:', userData.username, 'Role:', userData.role);

  if (userData.role !== 'admin') {
    console.warn('❌ Not admin');
    alert('Admin access required');
    window.location.href = 'login.html';
    return;
  }

  console.log('✅ Admin verified');
  loadTransactions();
});

// ==================== LOAD ALL TRANSACTIONS ====================
async function loadTransactions() {
  console.log('📥 Loading all transactions...');

  try {
    console.log('🌐 Fetching: /transactions');
    const res = await fetch('/transactions');

    console.log('📍 Response status:', res.status);

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    allTransactions = await res.json();

    if (!Array.isArray(allTransactions)) {
      throw new Error('Invalid response - not an array');
    }

    console.log('✅ Fetched', allTransactions.length, 'transactions');

    if (allTransactions.length === 0) {
      displayNoData();
      return;
    }

    // Sort by newest first
    allTransactions.sort((a, b) =>
      new Date(b.scan_time) - new Date(a.scan_time)
    );

    displayTransactions(allTransactions);
    updateStats(allTransactions);

  } catch (err) {
    console.error('❌ Error:', err.message);
    displayError(err.message);
  }
}

// ==================== DISPLAY TRANSACTIONS ====================
function displayTransactions(transactions) {
  const tbody = document.getElementById('tableBody');
  const noDataMsg = document.getElementById('noDataMsg');

  if (!transactions || transactions.length === 0) {
    displayNoData();
    return;
  }

  noDataMsg.style.display = 'none';
  tbody.innerHTML = '';

  transactions.forEach(t => {
    const tr = document.createElement('tr');

    // Format date and time
    const transDate = new Date(t.scan_time);
    const dateTime = transDate.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Check action type
    const action = (t.action || '').toLowerCase();
    const isCheckin = action.includes('checkin') || action === 'check-in';
    const badgeClass = isCheckin ? 'checkin' : 'checkout';
    const badgeText = isCheckin ? '↓ CHECKIN' : '↑ CHECKOUT';

    tr.innerHTML = `
      <td>${escapeHtml(dateTime)}</td>
      <td><strong>${escapeHtml(t.username || 'N/A')}</strong></td>
      <td>${escapeHtml(t.item_code || 'N/A')}</td>
      <td>${escapeHtml(t.item_name || 'N/A')}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;

    tbody.appendChild(tr);
  });

  console.log('✅ Displayed', transactions.length, 'transactions');
}

// ==================== UPDATE STATS ====================
function updateStats(transactions) {
  const total = transactions.length;
  const checkout = transactions.filter(t =>
    (t.action || '').toLowerCase().includes('checkout')
  ).length;
  const checkin = transactions.filter(t =>
    (t.action || '').toLowerCase().includes('checkin')
  ).length;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('checkoutCount').textContent = checkout;
  document.getElementById('checkinCount').textContent = checkin;

  console.log(`📊 Stats: Total=${total}, Checkout=${checkout}, Checkin=${checkin}`);
}

// ==================== SEARCH ====================
function search() {
  console.log('🔍 Searching...');

  const searchText = document.getElementById('search').value.toLowerCase().trim();

  if (!searchText) {
    displayTransactions(allTransactions);
    updateStats(allTransactions);
    return;
  }

  const filtered = allTransactions.filter(t => {
    return (
      (t.username || '').toLowerCase().includes(searchText) ||
      (t.item_code || '').toLowerCase().includes(searchText) ||
      (t.item_name || '').toLowerCase().includes(searchText)
    );
  });

  console.log('✅ Found', filtered.length, 'matches');
  displayTransactions(filtered);
  updateStats(filtered);
}

// ==================== CLEAR SEARCH ====================
function clearSearch() {
  console.log('🧹 Clearing search...');
  document.getElementById('search').value = '';
  displayTransactions(allTransactions);
  updateStats(allTransactions);
}

// ==================== DOWNLOAD EXCEL ====================
function downloadAllTransactions() {
  console.log('📥 Downloading Excel...');

  if (allTransactions.length === 0) {
    alert('No transactions to download');
    return;
  }

  try {
    // Prepare data for Excel
    const data = allTransactions.map(t => ({
      'Date & Time': new Date(t.scan_time).toLocaleString(),
      'Username': t.username || 'N/A',
      'Item Code': t.item_code || 'N/A',
      'Item Name': t.item_name || 'N/A',
      'Action': (t.action || '').toUpperCase()
    }));

    // Create CSV content
    let csv = 'Date & Time,Username,Item Code,Item Name,Action\n';
    data.forEach(row => {
      csv += `"${row['Date & Time']}","${row['Username']}","${row['Item Code']}","${row['Item Name']}","${row['Action']}"\n`;
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('✅ Download started');
  } catch (err) {
    console.error('❌ Download error:', err);
    alert('Download failed: ' + err.message);
  }
}

// ==================== DISPLAY NO DATA ====================
function displayNoData() {
  const tbody = document.getElementById('tableBody');
  const noDataMsg = document.getElementById('noDataMsg');

  tbody.innerHTML = '';
  noDataMsg.style.display = 'flex';
  console.log('📭 No data to display');
}

// ==================== DISPLAY ERROR ====================
function displayError(errorMsg) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; padding:60px 20px;">
        <div style="color:#f56565; font-size:16px;">
          <i class="fas fa-exclamation-circle" style="font-size:32px; margin-bottom:10px; display:block;"></i>
          Error: ${escapeHtml(errorMsg)}
        </div>
      </td>
    </tr>
  `;
}

// ==================== ESCAPE HTML ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== GO BACK ====================
function goBack() {
  console.log('🔙 Going back...');
  window.history.back();
}