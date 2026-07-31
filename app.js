const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbw7Dzk1CzR0sGwecF52RCffqchc9yHQDurqVudZPbU-baSNJu8vHXV2aNzW6_Z7i08rKA/exec';

let currentRows = [];
let verifiedCandidate = null;

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('submitTab').addEventListener('click', () => switchMode('submit'));
  $('rankingTab').addEventListener('click', () => switchMode('ranking'));
  $('verifyForm').addEventListener('submit', handleVerifyCandidate);
  $('submissionForm').addEventListener('submit', handleSubmitCandidate);
  $('examLast3').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3);
  });
  $('phone').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
  });
  $('searchForm').addEventListener('submit', handleSearch);
  $('clearBtn').addEventListener('click', resetSearch);
  $('closeModalBtn').addEventListener('click', closeDetail);
  $('detailModal').addEventListener('click', event => {
    if (event.target.id === 'detailModal') closeDetail();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDetail();
  });
});

function switchMode(mode) {
  const submitMode = mode === 'submit';
  $('submitView').classList.toggle('hidden', !submitMode);
  $('rankingView').classList.toggle('hidden', submitMode);
  $('submitTab').classList.toggle('active', submitMode);
  $('rankingTab').classList.toggle('active', !submitMode);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleVerifyCandidate(event) {
  event.preventDefault();
  resetCandidateState();
  hideSubmitMessage();

  const group = $('examGroup').value;
  const last3 = $('examLast3').value.trim();
  if (!group || !/^\d{3}$/.test(last3)) {
    showSubmitMessage('กรุณาเลือกกลุ่มและกรอกเลขประจำตัวสอบให้ครบ 3 หลัก', 'error');
    return;
  }

  setLoading(true, 'กำลังตรวจสอบรายชื่อ', 'ตรวจสอบกับรายชื่อทางการ');
  try {
    const data = await apiGet('verifyCandidate', { group, last3 });
    if (!data || !data.success) throw new Error(data && data.message ? data.message : 'ไม่สามารถตรวจสอบรายชื่อได้');

    verifiedCandidate = { ...data.candidate, group, last3 };
    showCandidateCard(data.candidate, data.alreadySubmitted);

    if (data.alreadySubmitted) {
      $('alreadySubmittedBox').textContent = data.message || 'ท่านมีข้อมูลอยู่ในระบบแล้ว ไม่ต้องกรอกใหม่';
      $('alreadySubmittedBox').classList.remove('hidden');
      $('submissionSection').classList.add('hidden');
    } else {
      $('submissionSection').classList.remove('hidden');
      $('submissionSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    showSubmitMessage(error.message || 'เกิดข้อผิดพลาดจากระบบ', 'error');
  } finally {
    setLoading(false);
  }
}

function showCandidateCard(candidate, alreadySubmitted) {
  $('candidateName').textContent = candidate.name || '-';
  $('candidateMeta').textContent = 'กลุ่ม ' + candidate.group + ' • เลขประจำตัวสอบ ' + candidate.fullExamIdMasked + ' • 3 หลักท้าย ' + candidate.last3;
  $('candidateStatus').textContent = alreadySubmitted ? 'มีข้อมูลแล้ว' : 'ยืนยันรายชื่อแล้ว';
  $('candidateStatus').classList.toggle('done', alreadySubmitted);
  $('candidateCard').classList.remove('hidden');
}

async function handleSubmitCandidate(event) {
  event.preventDefault();
  hideSubmitMessage();

  if (!verifiedCandidate) {
    showSubmitMessage('กรุณาตรวจสอบรายชื่อก่อนกรอกข้อมูล', 'error');
    return;
  }
  if (!$('confirmAccuracy').checked) {
    showSubmitMessage('กรุณายืนยันความถูกต้องของข้อมูล', 'error');
    return;
  }

  const payload = {
    action: 'submitCandidate',
    group: verifiedCandidate.group,
    last3: verifiedCandidate.last3,
    phone: $('phone').value.trim(),
    examScore: $('examScore').value,
    serviceYears: $('serviceYears').value,
    serviceMonths: $('serviceMonths').value,
    serviceDays: $('serviceDays').value,
    meritStep: $('meritStep').value,
    education: $('education').value,
    discipline: $('discipline').value,
    userAgent: navigator.userAgent
  };

  setLoading(true, 'กำลังบันทึกข้อมูล', 'กรุณาอย่าปิดหน้าจอหรือกดซ้ำ');
  $('submitCandidateBtn').disabled = true;
  try {
    const data = await apiPost(payload);
    if (!data || !data.success) throw new Error(data && data.message ? data.message : 'ไม่สามารถบันทึกข้อมูลได้');

    $('submissionSection').classList.add('hidden');
    $('candidateStatus').textContent = 'ส่งข้อมูลแล้ว';
    $('candidateStatus').classList.add('done');
    showSubmitMessage(data.message + ' เลขอ้างอิง ' + data.submissionId, 'success');
    $('submitMessageBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    showSubmitMessage(error.message || 'เกิดข้อผิดพลาดจากระบบ', 'error');
  } finally {
    $('submitCandidateBtn').disabled = false;
    setLoading(false);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const keyword = $('searchInput').value.trim();
  hideMessage();
  hideResults();
  if (!keyword) {
    showMessage('กรุณากรอกชื่อ-สกุล หรือเบอร์โทรศัพท์', 'error');
    return;
  }

  setLoading(true, 'กำลังค้นหาและคำนวณอันดับ', 'กรุณารอสักครู่');
  try {
    const data = await apiGet('search', { q: keyword });
    if (!data || !data.success) throw new Error(data && data.message ? data.message : 'ไม่สามารถค้นหาข้อมูลได้');
    currentRows = Array.isArray(data.rows) ? data.rows : [];
    renderResults(data);
  } catch (error) {
    showMessage(error.message || 'เกิดข้อผิดพลาดจากระบบ', 'error');
  } finally {
    setLoading(false);
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(GAS_API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('_', Date.now());
  const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store', redirect: 'follow' });
  if (!response.ok) throw new Error('เรียกข้อมูลไม่สำเร็จ HTTP ' + response.status);
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ HTTP ' + response.status);
  return response.json();
}

function resetCandidateState() {
  verifiedCandidate = null;
  $('candidateCard').classList.add('hidden');
  $('alreadySubmittedBox').classList.add('hidden');
  $('submissionSection').classList.add('hidden');
  $('candidateStatus').classList.remove('done');
}

function renderResults(data) {
  if (!currentRows.length) {
    showMessage('ไม่พบข้อมูลที่ตรงกับชื่อหรือเบอร์โทรศัพท์นี้', 'info');
    return;
  }
  $('resultMeta').textContent = 'พบ ' + formatNumber(data.matchCount || currentRows.length, 0) + ' รายการ • ผู้เข้าสอบทั้งหมด ' + formatNumber(data.totalCandidates || 0, 0) + ' คน • อัปเดต ' + (data.generatedAt || '-');
  $('resultList').innerHTML = currentRows.map((row, index) => `
    <button class="result-card" type="button" onclick="openDetail(${index})">
      <div class="result-card-top"><div><h3 class="result-name">${escapeHtml(row.name || '-')}</h3><div class="result-sub">${escapeHtml(row.examSite || 'ไม่ระบุสนามสอบ')} • ${escapeHtml(row.phoneMasked || '-')}</div></div><div class="rank-badge">อันดับที่ ${formatNumber(row.rank, 0)}</div></div>
      <div class="result-score"><span>คะแนนรวม</span><strong>${formatNumber(row.totalScore, 2)}</strong></div>
    </button>`).join('');
  $('resultSection').classList.remove('hidden');
  $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDetail(index) {
  const row = currentRows[index];
  if (!row) return;
  $('modalName').textContent = 'อันดับที่ ' + formatNumber(row.rank, 0) + ' — ' + (row.name || '-');
  $('modalMeta').textContent = (row.examSite || 'ไม่ระบุสนามสอบ') + ' • ' + (row.phoneMasked || '-');
  $('modalBody').innerHTML = `
    <div class="detail-grid">
      ${detailItem('คะแนนสอบ', formatNumber(row.examScore, 0))}
      ${detailItem('อายุราชการที่บันทึก', escapeHtml(row.serviceTenureRaw || '-'))}
      ${detailItem('อายุราชการหลังปัดเศษ', escapeHtml(row.serviceRoundedText || '-'))}
      ${detailItem('คะแนนอายุราชการ', formatNumber(row.serviceScore, 2) + ' / 15')}
      ${detailItem('ความดีความชอบ', formatNumber(row.meritStep, 2) + ' ขั้น')}
      ${detailItem('คะแนนความดีความชอบ', formatNumber(row.meritScore, 2) + ' / 5')}
      ${detailItem('วุฒิการศึกษา', escapeHtml(row.education || '-'))}
      ${detailItem('คะแนนวุฒิการศึกษา', formatNumber(row.educationScore, 0) + ' / 5')}
      ${detailItem('โทษทางวินัย', escapeHtml(row.discipline || '-'))}
      ${detailItem('คะแนนวินัย', formatNumber(row.disciplineScore, 0) + ' / 5')}
    </div>
    <div class="total-panel"><span>คะแนนรวม</span><strong>${formatNumber(row.totalScore, 2)}</strong></div>
    <div class="formula-note">คะแนนรวม = คะแนนสอบ + คะแนนอายุราชการ + คะแนนความดีความชอบ + คะแนนวุฒิการศึกษา + คะแนนโทษทางวินัย</div>`;
  $('detailModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDetail() { $('detailModal').classList.add('hidden'); document.body.style.overflow = ''; }
function resetSearch() { currentRows = []; $('searchInput').value = ''; hideMessage(); hideResults(); $('searchInput').focus(); }
function hideResults() { $('resultSection').classList.add('hidden'); $('resultList').innerHTML = ''; }
function showMessage(message, type) { $('messageBox').className = 'message-box ' + (type === 'error' ? 'error' : 'info'); $('messageBox').textContent = message; }
function hideMessage() { $('messageBox').className = 'message-box hidden'; $('messageBox').textContent = ''; }
function showSubmitMessage(message, type) { $('submitMessageBox').className = 'message-box ' + type; $('submitMessageBox').textContent = message; }
function hideSubmitMessage() { $('submitMessageBox').className = 'message-box hidden'; $('submitMessageBox').textContent = ''; }
function setLoading(isLoading, title = 'กำลังดำเนินการ', text = 'กรุณารอสักครู่') {
  $('loadingOverlay').classList.toggle('hidden', !isLoading);
  $('loadingTitle').textContent = title;
  $('loadingText').textContent = text;
  ['verifyBtn', 'searchBtn'].forEach(id => { if ($(id)) $(id).disabled = isLoading; });
}
function detailItem(label, value) { return `<div class="detail-item"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${value}</div></div>`; }
function formatNumber(value, decimals) { const number = Number(value); if (!Number.isFinite(number)) return decimals > 0 ? Number(0).toFixed(decimals) : '0'; return number.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
