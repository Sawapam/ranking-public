const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbw7Dzk1CzR0sGwecF52RCffqchc9yHQDurqVudZPbU-baSNJu8vHXV2aNzW6_Z7i08rKA/exec';

const EXAM_SITE_MAP = Object.freeze({
  '1': 'เชียงใหม่',
  '2': 'ขอนแก่น',
  '3': 'ศูนย์ธรรมศาสตร์',
  '4': 'ชลบุรี',
  '5': 'นครศรีธรรมราช'
});

let currentRows = [];
let verifiedCandidate = null;
let editableCandidate = null;

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('submitTab').addEventListener('click', () => switchMode('submit'));
  $('rankingTab').addEventListener('click', () => switchMode('ranking'));
  $('editTab').addEventListener('click', () => switchMode('edit'));

  $('verifyForm').addEventListener('submit', handleVerifyCandidate);
  $('submissionForm').addEventListener('submit', handleSubmitCandidate);
  $('searchForm').addEventListener('submit', handleSearch);
  $('editVerifyForm').addEventListener('submit', handleEditVerify);
  $('editForm').addEventListener('submit', handleEditSubmit);

  bindDigitsOnly('examLast3', 3);
  bindDigitsOnly('phone', 10);
  bindDigitsOnly('searchInput', 10);
  bindDigitsOnly('editLast3', 3);
  bindDigitsOnly('editCurrentPhone', 10);
  bindDigitsOnly('editPhone', 10);

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
  const rankingMode = mode === 'ranking';
  const editMode = mode === 'edit';

  $('submitView').classList.toggle('hidden', !submitMode);
  $('rankingView').classList.toggle('hidden', !rankingMode);
  $('editView').classList.toggle('hidden', !editMode);

  $('submitTab').classList.toggle('active', submitMode);
  $('rankingTab').classList.toggle('active', rankingMode);
  $('editTab').classList.toggle('active', editMode);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleVerifyCandidate(event) {
  event.preventDefault();
  resetCandidateState();
  hideSubmitMessage();

  const group = $('examGroup').value;
  const last3 = $('examLast3').value.trim();
  if (!group || !/^\d{3}$/.test(last3)) {
    showSubmitMessage('กรุณาเลือกสนามสอบและกรอกเลขประจำตัวสอบให้ครบ 3 หลัก', 'error');
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
  $('candidateName').textContent = candidate.nameMasked || '-';
  $('candidateMeta').textContent =
    getExamSiteName(candidate.examSite || candidate.group) +
    ' • เลขประจำตัวสอบ ' +
    candidate.fullExamIdMasked +
    ' • 3 หลักสุดท้าย ' +
    candidate.last3;
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

  if (!/^\d{10}$/.test(keyword)) {
    showMessage('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก', 'error');
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


async function handleEditVerify(event) {
  event.preventDefault();
  resetEditState();
  hideEditMessage();

  const last3 = $('editLast3').value.trim();
  const phone = $('editCurrentPhone').value.trim();

  if (!/^\d{3}$/.test(last3) || !/^\d{10}$/.test(phone)) {
    showEditMessage(
      'กรุณากรอกเลขประจำตัวสอบ 3 หลักและเบอร์โทรศัพท์ 10 หลัก',
      'error'
    );
    return;
  }

  setLoading(
    true,
    'กำลังตรวจสอบข้อมูล',
    'ตรวจสอบเลขประจำตัวสอบและเบอร์โทรศัพท์'
  );

  try {
    const data = await apiPost({
      action: 'requestCandidateEdit',
      last3,
      phone
    });

    if (!data || !data.success) {
      throw new Error(
        data && data.message
          ? data.message
          : 'ไม่สามารถตรวจสอบข้อมูลได้'
      );
    }

    editableCandidate = {
      ...data.candidate,
      currentPhone: phone,
      last3
    };

    populateEditForm(editableCandidate);

  } catch (error) {
    showEditMessage(
      error.message || 'เกิดข้อผิดพลาดจากระบบ',
      'error'
    );
  } finally {
    setLoading(false);
  }
}

function populateEditForm(candidate) {
  $('editCandidateName').textContent =
    candidate.nameMasked || '-';

  $('editCandidateMeta').textContent =
    (candidate.examSite || 'ไม่ระบุสนามสอบ') +
    ' • เลข 3 หลักสุดท้าย ' +
    candidate.last3;

  $('editPhone').value = candidate.phone || '';
  $('editExamScore').value = candidate.examScore ?? '';
  $('editServiceYears').value = candidate.serviceYears ?? 0;
  $('editServiceMonths').value = candidate.serviceMonths ?? 0;
  $('editServiceDays').value = candidate.serviceDays ?? 0;
  $('editMeritStep').value = candidate.meritStep ?? '';
  $('editEducation').value = candidate.education || 'ปริญญาตรี';
  $('editDiscipline').value = candidate.discipline || 'ไม่มี';
  $('editConfirmAccuracy').checked = false;

  $('editCandidateCard').classList.remove('hidden');
  $('editSection').classList.remove('hidden');

  $('editSection').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function handleEditSubmit(event) {
  event.preventDefault();
  hideEditMessage();

  if (!editableCandidate) {
    showEditMessage('กรุณาตรวจสอบข้อมูลก่อนแก้ไข', 'error');
    return;
  }

  if (!$('editConfirmAccuracy').checked) {
    showEditMessage('กรุณายืนยันความถูกต้องของข้อมูล', 'error');
    return;
  }

  const payload = {
    action: 'submitCandidateEdit',
    submissionId: editableCandidate.submissionId,
    last3: editableCandidate.last3,
    currentPhone: editableCandidate.currentPhone,
    phone: $('editPhone').value.trim(),
    examScore: $('editExamScore').value,
    serviceYears: $('editServiceYears').value,
    serviceMonths: $('editServiceMonths').value,
    serviceDays: $('editServiceDays').value,
    meritStep: $('editMeritStep').value,
    education: $('editEducation').value,
    discipline: $('editDiscipline').value
  };

  setLoading(
    true,
    'กำลังบันทึกการแก้ไข',
    'กรุณาอย่าปิดหน้าจอหรือกดซ้ำ'
  );

  $('saveEditBtn').disabled = true;

  try {
    const data = await apiPost(payload);

    if (!data || !data.success) {
      throw new Error(
        data && data.message
          ? data.message
          : 'ไม่สามารถบันทึกการแก้ไขได้'
      );
    }

    $('editSection').classList.add('hidden');
    showEditMessage(data.message, 'success');
    editableCandidate = null;

  } catch (error) {
    showEditMessage(
      error.message || 'เกิดข้อผิดพลาดจากระบบ',
      'error'
    );
  } finally {
    $('saveEditBtn').disabled = false;
    setLoading(false);
  }
}

function resetEditState() {
  editableCandidate = null;
  $('editCandidateCard').classList.add('hidden');
  $('editSection').classList.add('hidden');
}

function showEditMessage(message, type) {
  $('editMessageBox').className = 'message-box ' + type;
  $('editMessageBox').textContent = message;
}

function hideEditMessage() {
  $('editMessageBox').className = 'message-box hidden';
  $('editMessageBox').textContent = '';
}

function bindDigitsOnly(id, maxLength) {
  $(id).addEventListener('input', event => {
    event.target.value = event.target.value
      .replace(/\D/g, '')
      .slice(0, maxLength);
  });
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
    showMessage('ไม่พบข้อมูลที่ตรงกับเบอร์โทรศัพท์นี้', 'info');
    return;
  }
  $('resultMeta').textContent = 'พบ ' + formatNumber(data.matchCount || currentRows.length, 0) + ' รายการ • ผู้เข้าสอบทั้งหมด ' + formatNumber(data.totalCandidates || 0, 0) + ' คน • อัปเดต ' + (data.generatedAt || '-');
  $('resultList').innerHTML = currentRows.map((row, index) => `
    <button class="result-card" type="button" onclick="openDetail(${index})">
      <div class="result-card-top"><div><h3 class="result-name">${escapeHtml(row.name || '-')}</h3><div class="result-sub">${escapeHtml(getExamSiteName(row.examSite))} • ${escapeHtml(row.phoneMasked || '-')}</div></div><div class="rank-badge">อันดับที่ ${formatNumber(row.rank, 0)}</div></div>
      <div class="result-score"><span>คะแนนรวม</span><strong>${formatNumber(row.totalScore, 2)}</strong></div>
    </button>`).join('');
  $('resultSection').classList.remove('hidden');
  $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDetail(index) {
  const row = currentRows[index];
  if (!row) return;
  $('modalName').textContent = 'อันดับที่ ' + formatNumber(row.rank, 0) + ' — ' + (row.name || '-');
  $('modalMeta').textContent =
    getExamSiteName(row.examSite) +
    ' • ' +
    (row.phoneMasked || '-');
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
function getExamSiteName(value) {
  const text = String(value == null ? '' : value).trim();

  if (!text) return 'ไม่ระบุสนามสอบ';

  if (EXAM_SITE_MAP[text]) return EXAM_SITE_MAP[text];

  const normalized = text
    .replace(/^สนามสอบ\s*/i, '')
    .replace(/^กลุ่ม\s*/i, '')
    .trim();

  if (EXAM_SITE_MAP[normalized]) return EXAM_SITE_MAP[normalized];

  return text;
}

function detailItem(label, value) { return `<div class="detail-item"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${value}</div></div>`; }
function formatNumber(value, decimals) { const number = Number(value); if (!Number.isFinite(number)) return decimals > 0 ? Number(0).toFixed(decimals) : '0'; return number.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
