import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  List as ListIcon,
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Trash2,
  Building,
  Search,
  Download,
  ShieldCheck,
  Lock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw, // 새로고침 아이콘
} from 'lucide-react';

// =========================================================================
// 🚨 중요: 여기에 구글 Apps Script에서 발급받은 '웹 앱 URL'을 붙여넣으세요!
// =========================================================================
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwuRh4nCrUPOeQybUEpdiuJyXqkY9kyB3VlMJExo7hSlk2eSKV73dM3E3V2qZAw_FeH/exec';

// 시간대 오류 방지용 유틸 함수
const getLocalMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (value) => {
  if (!value) return '';

  try {
    if (typeof value === 'string' && value.length === 10) {
      return value;
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) return value;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return value;
  }
};

const formatTime = (value) => {
  if (!value) return '';

  const str = String(value);

  if (/^\d{2}:\d{2}$/.test(str)) return str;

  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    });
  }

  return str;
};

// 출근시간: 05 ~ 12
const startHourOptions = Array.from({ length: 8 }, (_, i) =>
  String(i + 5).padStart(2, '0')
);

// 퇴근시간: 12 ~ 23 + 00
const endHourOptions = [
  ...Array.from({ length: 12 }, (_, i) => String(i + 12).padStart(2, '0')),
  '00',
];

const minuteOptions = ['00', '10', '20', '30', '40', '50'];

const splitTime = (time) => {
  const [hour = '00', minute = '00'] = String(time || '00:00').split(':');
  return { hour, minute };
};

const makeTime = (hour, minute) => `${hour}:${minute}`;

// 로컬 사용자 ID 생성 (본인 글 삭제 권한 확인용)
const getLocalUserId = () => {
  let id = localStorage.getItem('jy_local_uid');
  if (!id) {
    id =
      'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem('jy_local_uid', id);
  }
  return id;
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState('list');
  const [workType, setWorkType] = useState('post');
  const [userName, setUserName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success',
  });
  const [isManager, setIsManager] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태 추가
  const [editingLogId, setEditingLogId] = useState(null);
  const [editData, setEditData] = useState({
    startTime: '',
    endTime: '',
    reason: '',
  });

  const [selectedMonth, setSelectedMonth] = useState(getLocalMonthStr());
  const currentUserId = getLocalUserId();

  const [formData, setFormData] = useState({
    date: getLocalDateStr(),
    startTime: '09:00',
    endTime: '20:00',
    duration: 2,
    reason: '',
  });

  // --- 구글 시트 데이터 불러오기 (선택된 월 데이터만 가져오기) ---
  const fetchLogs = async () => {
    if (GOOGLE_SCRIPT_URL === '여기에_웹앱_URL을_붙여넣으세요') return;

    setIsLoading(true);
    try {
      // url에 month 파라미터 추가
      const response = await fetch(
        `${GOOGLE_SCRIPT_URL}?action=getLogs&month=${selectedMonth}`,
        {
          method: 'GET',
          redirect: 'follow',
        }
      );

      const text = await response.text();

      try {
        const data = JSON.parse(text);

        // 정렬: 날짜 오름차순 -> 출근시간 오름차순
        data.sort((a, b) => {
          if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
          return String(a.startTime).localeCompare(String(b.startTime));
        });

        setLogs(data);
      } catch (parseError) {
        console.error('JSON 파싱 에러(구글 보안 차단일 확률 높음):', text);
        if (
          text.includes('<html') ||
          text.includes('Sign in') ||
          text.includes('로그인')
        ) {
          showToast(
            '미리보기 환경(iframe)때문에 구글 통신이 차단되었습니다. Vercel 배포 시 정상 작동합니다!',
            'error'
          );
        } else {
          showToast('데이터 형식이 올바르지 않습니다.', 'error');
        }
      }
    } catch (error) {
      console.error('데이터 불러오기 실패(CORS/네트워크 에러):', error);
      showToast(
        '미리보기 환경(iframe)때문에 구글 통신이 차단되었습니다. Vercel 배포 시 정상 작동합니다!',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 이름 로드용
  useEffect(() => {
    const savedName = localStorage.getItem('jy_userName');
    if (savedName) setUserName(savedName);
  }, []);

  // 월이 바뀔 때마다 해당 월의 데이터를 새로 불러옴
  useEffect(() => {
    fetchLogs();
  }, [selectedMonth]);

  // --- Helpers ---
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: '', type: 'success' }),
      3000
    );
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    if (endMins < startMins) endMins += 24 * 60;
    const REGULAR_START = 9 * 60;
    const REGULAR_END = 18 * 60;
    const overlapStart = Math.max(startMins, REGULAR_START);
    const overlapEnd = Math.min(endMins, REGULAR_END);
    const overlapMins = Math.max(0, overlapEnd - overlapStart);
    let overtimeMins = endMins - startMins - overlapMins;
    let hours = overtimeMins / 60;
    if (hours < 0) hours = 0;
    return parseFloat(hours.toFixed(1));
  };

  // --- Actions ---
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setUserName(newName);
    localStorage.setItem('jy_userName', newName);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === 'startTime' || name === 'endTime') {
        newData.duration = calculateDuration(
          newData.startTime,
          newData.endTime
        );
      }
      return newData;
    });
  };

  const handleTimeSelectChange = (field, part, value) => {
    setFormData((prev) => {
      const current = splitTime(prev[field]);

      const newTime =
        part === 'hour'
          ? makeTime(value, current.minute)
          : makeTime(current.hour, value);

      const newData = {
        ...prev,
        [field]: newTime,
      };

      newData.duration = calculateDuration(newData.startTime, newData.endTime);

      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (GOOGLE_SCRIPT_URL === '여기에_웹앱_URL을_붙여넣으세요') {
      showToast('구글 스크립트 URL이 설정되지 않았습니다.', 'error');
      return;
    }
    if (!userName.trim()) {
      showToast('성명을 입력해주세요.', 'error');
      return;
    }
    if (!formData.reason.trim()) {
      showToast('근무내역을 입력해주세요.', 'error');
      return;
    }
    if (formData.duration > 4 || formData.duration <= 0) {
      showToast('수당시간은 0초과, 4시간 이하여야 합니다.', 'error');
      return;
    }

    setIsLoading(true);
    const newLog = {
      id: 'log_' + Date.now().toString(36), // 고유 ID
      userId: currentUserId,
      userName,
      type: workType,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      duration: parseFloat(formData.duration),
      reason: formData.reason,
      status: '대기',
      createdAt: new Date().toISOString(),
    };

    try {
      // 보안(CORS) 에러 방지를 위해 headers에 text/plain 명시 추가
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'addLog', data: newLog }),
      });
      showToast('시간외근무가 등록되었습니다.');
      setView('list');
      setFormData((prev) => ({
        ...prev,
        reason: '',
        duration: calculateDuration(prev.startTime, prev.endTime),
      }));
      fetchLogs(); // 새로고침
    } catch (error) {
      console.error('등록 에러:', error);
      showToast(
        '미리보기 화면이라 차단되었습니다. Vercel 배포 시 정상 등록됩니다.',
        'error'
      );
      setIsLoading(false);
    }
  };

  // 삭제 시 어떤 월(탭)에서 지울지 날짜 정보(logDate) 추가
  const handleDelete = async (id, logUserId, logDate) => {
    // 결재 완료된 건 관리자만 삭제 가능
    if (logDate && !isManager) {
      const targetLog = logs.find((l) => l.id === id);

      if (targetLog && targetLog.status !== '대기') {
        showToast('결재 완료된 기록은 관리자만 삭제할 수 있습니다.', 'error');
        return;
      }
    }

    // 기존 권한 체크
    if (currentUserId !== logUserId && !isManager) {
      showToast('본인의 기록만 삭제할 수 있습니다.', 'error');
      return;
    }

    if (!window.confirm('정말 이 기록을 삭제하시겠습니까?')) return;

    setIsLoading(true);
    const monthTab = formatDate(logDate).substring(0, 7);

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'deleteLog', id, month: monthTab }),
      });
      showToast('기록이 삭제되었습니다.');
      fetchLogs();
    } catch (error) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
      setIsLoading(false);
    }
  };
  const handleEditStart = (log) => {
    if (!isManager) return;

    setEditingLogId(log.id);
    setEditData({
      startTime: formatTime(log.startTime),
      endTime: formatTime(log.endTime),
      reason: log.reason || '',
    });
  };

  const handleEditCancel = () => {
    setEditingLogId(null);
    setEditData({
      startTime: '',
      endTime: '',
      reason: '',
    });
  };

  const handleEditTimeSelectChange = (field, part, value) => {
    setEditData((prev) => {
      const current = splitTime(prev[field]);

      const newTime =
        part === 'hour'
          ? makeTime(value, current.minute)
          : makeTime(current.hour, value);

      return {
        ...prev,
        [field]: newTime,
      };
    });
  };

  const handleEditSave = async (log) => {
    if (!isManager) return;

    if (!editData.reason.trim()) {
      showToast('근무내역을 입력해주세요.', 'error');
      return;
    }

    const newDuration = calculateDuration(editData.startTime, editData.endTime);

    if (newDuration > 4 || newDuration <= 0) {
      showToast('수당시간은 0초과, 4시간 이하여야 합니다.', 'error');
      return;
    }

    const updatedLog = {
      ...log,
      startTime: editData.startTime,
      endTime: editData.endTime,
      reason: editData.reason,
      duration: newDuration,
    };

    setIsLoading(true);

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'updateLog',
          id: log.id,
          month: formatDate(log.date).substring(0, 7),
          data: updatedLog,
        }),
      });

      const text = await response.text();
      console.log('updateLog 응답:', text);

      const result = JSON.parse(text);

      if (!result.success) {
        showToast(result.message || '수정 저장에 실패했습니다.', 'error');
        setIsLoading(false);
        return;
      }

      showToast('기록이 수정되었습니다.');
      setEditingLogId(null);
      fetchLogs();
    } catch (error) {
      showToast('수정 중 오류가 발생했습니다.', 'error');
      setIsLoading(false);
    }
  };

  // 상태 변경 시 어떤 월(탭)에서 변경할지 날짜 정보(logDate) 추가
  const handleStatusChange = async (id, newStatus, logDate) => {
    if (!isManager) return;
    setIsLoading(true);
    const monthTab = formatDate(logDate).substring(0, 7);

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          id,
          status: newStatus,
          month: monthTab,
        }),
      });
      if (newStatus === '대기') showToast('결재가 대기 상태로 변경되었습니다.');
      else showToast(`성공적으로 ${newStatus} 처리되었습니다.`);
      fetchLogs();
    } catch (error) {
      showToast('상태 변경 중 오류가 발생했습니다.', 'error');
      setIsLoading(false);
    }
  };

  // --- UI 핸들러 ---
  const handlePrevMonth = () => {
    let [year, month] = selectedMonth.split('-').map(Number);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };
  const handleNextMonth = () => {
    let [year, month] = selectedMonth.split('-').map(Number);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };
  const handleYearSelect = (e) =>
    setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1]}`);
  const handleMonthSelect = (e) =>
    setSelectedMonth(
      `${selectedMonth.split('-')[0]}-${String(e.target.value).padStart(
        2,
        '0'
      )}`
    );

  const toggleManagerMode = () => {
    if (isManager) {
      setIsManager(false);
      showToast('관리자 모드가 해제되었습니다.');
    } else {
      setPwdInput('');
      setShowPwdModal(true);
    }
  };

  const handlePwdSubmit = (e) => {
    e.preventDefault();
    if (pwdInput === 'jjong0311') {
      setIsManager(true);
      setShowPwdModal(false);
      showToast('관리자 모드로 전환되었습니다.');
    } else {
      showToast('비밀번호가 일치하지 않습니다.', 'error');
    }
  };

  const exportToExcel = () => {
    if (displayedLogs.length === 0) {
      showToast('다운로드할 데이터가 없습니다.', 'error');
      return;
    }
    const [displayYear, displayMonth] = selectedMonth.split('-');
    const displayMonthNum = parseInt(displayMonth, 10);

    let tableHtml = `
      <table border="1" style="border-collapse: collapse; font-family: 'Malgun Gothic', sans-serif; text-align: center;">
        <thead>
        <tr><th colspan="8" style="font-size: 20px; font-weight: bold; padding: 15px;">${displayYear}년 ${displayMonthNum}월 시간외근무 ${workType === 'pre' ? '사전신청대장' : '사후확인대장'}(안)</th></tr>
          <tr><th colspan="8" style="text-align: right; padding-bottom: 10px;">(시설명: 절영종합사회복지관)</th></tr>
          <tr style="background-color: #E0E7FF; color: #1E3A8A; font-weight: bold;">
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 60px;">연번</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 120px;">근무일</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 100px;">성명</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 250px;">근무내역(상세히 기재)</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 100px;">출근시간</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; border-right: 2px solid red; width: 100px;">퇴근시간</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 100px;">수당시간</th>
            <th style="padding: 10px; border: 1px solid #1E3A8A; width: 120px;">결재(시설장)</th>
          </tr>
        </thead>
        <tbody>
    `;
    displayedLogs.forEach((log, index) => {
      tableHtml += `
        <tr>
          <td style="padding: 8px; border: 1px solid #A5B4FC;">${index + 1}</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC;">${formatDate(
            log.date
          )}</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC;">${
            log.userName
          }</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC; text-align: left;">${
            log.reason
          }</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC;">${formatTime(
            log.startTime
          )}</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC; border-right: 2px solid red;">${formatTime(
            log.endTime
          )}</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC; font-weight: bold; color: #1E3A8A;">${
            log.duration
          }</td>
          <td style="padding: 8px; border: 1px solid #A5B4FC; background-color: #EEF2FF;">${
            log.status === '대기' ? '' : log.status
          }</td>
        </tr>`;
    });
    for (let i = displayedLogs.length; i < 5; i++) {
      tableHtml += `<tr><td style="border: 1px solid #A5B4FC; height:30px;"></td><td style="border: 1px solid #A5B4FC;"></td><td style="border: 1px solid #A5B4FC;"></td><td style="border: 1px solid #A5B4FC;"></td><td style="border: 1px solid #A5B4FC;"></td><td style="border: 1px solid #A5B4FC; border-right: 2px solid red;"></td><td style="border: 1px solid #A5B4FC;"></td><td style="border: 1px solid #A5B4FC; background-color: #EEF2FF;"></td></tr>`;
    }
    tableHtml += `</tbody></table>`;

    const htmlTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /></head><body>${tableHtml}</body></html>`;
    const blob = new Blob(['\uFEFF' + htmlTemplate], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${displayYear}년_${displayMonthNum}월_시간외근무_${workType === 'pre' ? '사전신청대장' : '사후확인대장'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('엑셀 파일이 다운로드 되었습니다.');
  };

  const displayedLogs = useMemo(() => {
    let filtered = logs.filter((log) => {
      const logType = log.type || 'post';
  
      return (
        formatDate(log.date).startsWith(selectedMonth) &&
        logType === workType
      );
    });
  
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((log) =>
        log.userName.includes(searchQuery.trim())
      );
    }
  
    return filtered;
  }, [logs, searchQuery, selectedMonth, workType]);

  const displayedTotalHours = useMemo(() => {
    return displayedLogs
      .filter((log) => log.status === '승인')
      .reduce((sum, log) => sum + Number(log.duration), 0)
      .toFixed(1);
  }, [displayedLogs]);

  const [displayYear, displayMonth] = selectedMonth.split('-');
  const displayMonthNum = parseInt(displayMonth, 10);
  const yearOptions = Array.from({ length: 7 }, (_, i) => 2024 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800 font-sans pb-20 md:pb-8 relative">
      {/* 로딩 오버레이 (통신 중일 때 표시) */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white bg-opacity-70 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#1E3A8A] border-t-transparent"></div>
        </div>
      )}

      {/* URL 경고창 (가장 처음 사용자에게 보여짐) */}
      {GOOGLE_SCRIPT_URL === '여기에_웹앱_URL을_붙여넣으세요' && (
        <div className="bg-red-600 text-white p-4 text-center text-sm font-bold">
          <p>
            ⚠️ 현재 구글 스프레드시트가 연결되지 않았습니다. AI가 안내해 드린
            [구글 시트 연동 가이드]를 확인해주세요!
          </p>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-full text-[#1E3A8A]">
                <Lock size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">결재권자 접속</h3>
            </div>
            <form onSubmit={handlePwdSubmit}>
              <p className="text-sm text-gray-600 mb-4">
                관리자 비밀번호를 입력해주세요.
                <br />
                (관리자 전용)
              </p>
              <input
                type="password"
                value={pwdInput}
                onChange={(e) => setPwdInput(e.target.value)}
                placeholder="비밀번호"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none mb-5"
                autoFocus
              />
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl font-bold"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-opacity duration-300 ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-600'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toast.type === 'error' ? (
              <XCircle size={20} />
            ) : (
              <CheckCircle size={20} />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#1E3A8A] rounded-xl flex items-center justify-center text-white shadow-md">
              <Building size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                절영종합사회복지관
              </h1>
              <p className="text-sm text-gray-500">
                시간외근무 관리 시스템
              </p>
            </div>
          </div>
          <button
            onClick={toggleManagerMode}
            title="결재권자 로그인"
            className={`p-2 rounded-xl transition-all ${
              isManager
                ? 'bg-[#1E3A8A] text-white shadow-md'
                : 'bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldCheck size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6 w-full">
          <div className="flex space-x-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-fit">
            <button
              onClick={() => setView('list')}
              className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                view === 'list'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ListIcon size={18} />
              <span>대장 보기</span>
            </button>
            <button
              onClick={() => setView('form')}
              className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                view === 'form'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plus size={18} />
              <span>근무 등록</span>
            </button>
          </div>

          {/* 수동 새로고침 버튼 */}
          <button
            onClick={fetchLogs}
            className="hidden md:flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 shadow-sm text-sm font-bold"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>새로고침</span>
          </button>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-fit">
            <button
              onClick={() => setWorkType('pre')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                workType === 'pre'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              사전 신청
            </button>

            <button
              onClick={() => setWorkType('post')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                workType === 'post'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              사후 확인
            </button>
          </div>
        </div>


        {view === 'list' && (
          <div className="space-y-6">
            <div className="text-center py-4 flex flex-col items-center">
              <div className="flex items-center justify-center space-x-4 md:space-x-6 mb-3">
                <button
                  onClick={handlePrevMonth}
                  className="p-2.5 bg-white border border-[#A5B4FC] rounded-full hover:bg-[#EEF2FF] transition-colors shadow-sm text-[#1E3A8A]"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="flex items-center space-x-1 text-2xl md:text-3xl font-extrabold text-[#1E3A8A] tracking-tight">
                  <select
                    value={parseInt(displayYear, 10)}
                    onChange={handleYearSelect}
                    className="bg-transparent border-none appearance-none cursor-pointer hover:bg-[#E0E7FF] rounded-lg px-2 py-1 outline-none text-center"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}년
                      </option>
                    ))}
                  </select>
                  <select
                    value={displayMonthNum}
                    onChange={handleMonthSelect}
                    className="bg-transparent border-none appearance-none cursor-pointer hover:bg-[#E0E7FF] rounded-lg px-2 py-1 outline-none text-center"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="p-2.5 bg-white border border-[#A5B4FC] rounded-full hover:bg-[#EEF2FF] transition-colors shadow-sm text-[#1E3A8A]"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
              <p className="text-md text-[#1E3A8A] font-medium">
                (시설명: 절영종합사회복지관)
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-4 gap-3">
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="성명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-48 pl-9 pr-3 py-2 bg-white border border-[#A5B4FC] rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A8A] outline-none shadow-sm"
                  />
                </div>
                {searchQuery.trim() && (
                  <span className="text-sm font-bold text-[#1E3A8A] bg-[#EEF2FF] px-3 py-2 rounded-lg border border-[#A5B4FC] whitespace-nowrap">
                    누적: {displayedTotalHours}시간
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between w-full md:w-auto md:space-x-3">
                <button
                  onClick={exportToExcel}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Download size={16} />
                  <span>엑셀 다운로드</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#A5B4FC] shadow-sm overflow-x-auto">
              <table className="w-full text-sm text-center whitespace-nowrap min-w-[800px]">
                <thead className="bg-[#E0E7FF] text-[#1E3A8A] border-b-2 border-[#1E3A8A]">
                  <tr>
                    <th className="px-3 py-3 border-r border-[#A5B4FC] font-bold w-16">
                      연번
                    </th>
                    <th className="px-4 py-3 border-r border-[#A5B4FC] font-bold w-32">
                      근무일
                    </th>
                    <th className="px-4 py-3 border-r border-[#A5B4FC] font-bold w-24">
                      성명
                    </th>
                    <th className="px-6 py-3 border-r border-[#A5B4FC] font-bold w-auto">
                      근무내역(상세히 기재)
                    </th>
                    <th className="px-4 py-3 border-r border-[#A5B4FC] font-bold w-24">
                      출근시간
                    </th>
                    <th className="px-4 py-3 border-r border-red-500 font-bold w-24 relative">
                      퇴근시간
                      <div className="absolute top-0 right-[-1px] bottom-0 w-[1px] bg-red-500 z-10"></div>
                    </th>
                    <th className="px-4 py-3 border-r border-[#A5B4FC] font-bold w-24">
                      수당시간
                    </th>
                    <th className="px-4 py-3 font-bold w-32">결재(시설장)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-12 text-center text-gray-500 bg-gray-50"
                      >
                        <FileText
                          size={32}
                          className="mx-auto text-gray-300 mb-2"
                        />
                        등록된 근무 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log, index) => (
                      <tr
                        key={log.id}
                        className="border-b border-[#E0E7FF] hover:bg-[#F8FAFC] transition-colors group"
                      >
                        <td className="px-3 py-2.5 border-r border-[#E0E7FF] text-gray-600">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5 border-r border-[#E0E7FF] text-gray-800">
                          {formatDate(log.date)}
                        </td>
                        <td className="px-4 py-2.5 border-r border-[#E0E7FF] font-medium text-gray-900">
                          {log.userName}
                        </td>
                        <td className="px-6 py-2.5 border-r border-[#E0E7FF] text-left text-gray-700 whitespace-normal min-w-[200px]">
                          {editingLogId === log.id ? (
                            <textarea
                              value={editData.reason}
                              onChange={(e) =>
                                setEditData((prev) => ({
                                  ...prev,
                                  reason: e.target.value,
                                }))
                              }
                              rows={2}
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A8A] outline-none resize-none"
                            />
                          ) : (
                            log.reason
                          )}
                        </td>
                        <td className="px-4 py-2.5 border-r border-[#E0E7FF] text-gray-700">
                          {editingLogId === log.id ? (
                            <div className="grid grid-cols-2 gap-1">
                              <select
                                value={splitTime(editData.startTime).hour}
                                onChange={(e) =>
                                  handleEditTimeSelectChange(
                                    'startTime',
                                    'hour',
                                    e.target.value
                                  )
                                }
                                className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                              >
                                {startHourOptions.map((h) => (
                                  <option key={h} value={h}>
                                    {h}시
                                  </option>
                                ))}
                              </select>

                              <select
                                value={splitTime(editData.startTime).minute}
                                onChange={(e) =>
                                  handleEditTimeSelectChange(
                                    'startTime',
                                    'minute',
                                    e.target.value
                                  )
                                }
                                className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                              >
                                {minuteOptions.map((m) => (
                                  <option key={m} value={m}>
                                    {m}분
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            formatTime(log.startTime)
                          )}
                        </td>
                        <td className="px-4 py-2.5 border-r border-red-500 text-gray-700 relative">
                          {editingLogId === log.id ? (
                            <div className="grid grid-cols-2 gap-1">
                              <select
                                value={splitTime(editData.endTime).hour}
                                onChange={(e) =>
                                  handleEditTimeSelectChange(
                                    'endTime',
                                    'hour',
                                    e.target.value
                                  )
                                }
                                className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                              >
                                {endHourOptions.map((h) => (
                                  <option key={h} value={h}>
                                    {h}시
                                  </option>
                                ))}
                              </select>

                              <select
                                value={splitTime(editData.endTime).minute}
                                onChange={(e) =>
                                  handleEditTimeSelectChange(
                                    'endTime',
                                    'minute',
                                    e.target.value
                                  )
                                }
                                className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                              >
                                {minuteOptions.map((m) => (
                                  <option key={m} value={m}>
                                    {m}분
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            formatTime(log.endTime)
                          )}
                          <div className="absolute top-0 right-[-1px] bottom-0 w-[1px] bg-red-500 z-10"></div>
                        </td>
                        <td className="px-4 py-2.5 border-r border-[#E0E7FF] font-bold text-[#1E3A8A]">
                          {log.duration}
                        </td>
                        <td className="px-4 py-2.5 bg-[#EEF2FF] text-gray-500 relative">
                          {isManager ? (
                            <div className="flex items-center justify-center space-x-1.5">
                              {log.status === '대기' ? (
                                <>
                                  <button
                                    onClick={() =>
                                      handleStatusChange(
                                        log.id,
                                        '승인',
                                        log.date
                                      )
                                    }
                                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded"
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleStatusChange(
                                        log.id,
                                        '반려',
                                        log.date
                                      )
                                    }
                                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded"
                                  >
                                    반려
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <span
                                    className={`font-bold ${
                                      log.status === '승인'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}
                                  >
                                    {log.status}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleStatusChange(
                                        log.id,
                                        '대기',
                                        log.date
                                      )
                                    }
                                    className="p-1 text-gray-400 hover:text-[#1E3A8A] bg-white rounded-full border shadow-sm ml-1"
                                    title="결재 취소"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                </div>
                              )}
                              {editingLogId === log.id ? (
                                <>
                                  <button
                                    onClick={() => handleEditSave(log)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    className="px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs font-bold rounded"
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleEditStart(log)}
                                  className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded"
                                >
                                  수정
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  handleDelete(log.id, log.userId, log.date)
                                }
                                className="text-gray-400 hover:text-red-500 p-1 ml-1"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <span
                                className={`font-bold ${
                                  log.status === '승인'
                                    ? 'text-green-600'
                                    : log.status === '반려'
                                    ? 'text-red-600'
                                    : 'text-transparent'
                                }`}
                              >
                                {log.status === '대기' ? '대기' : log.status}
                              </span>
                              {log.userId === currentUserId &&
                                log.status === '대기' && (
                                  <button
                                    onClick={() =>
                                      handleDelete(log.id, log.userId, log.date)
                                    }
                                    className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 absolute right-2"
                                    title="기록 삭제"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  {displayedLogs.length > 0 &&
                    Array.from({
                      length: Math.max(0, 5 - displayedLogs.length),
                    }).map((_, i) => (
                      <tr
                        key={`empty-${i}`}
                        className="border-b border-[#E0E7FF] h-10"
                      >
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="border-r border-red-500 relative">
                          <div className="absolute top-0 right-[-1px] bottom-0 w-[1px] bg-red-500 z-10"></div>
                        </td>
                        <td className="border-r border-[#E0E7FF]"></td>
                        <td className="bg-[#EEF2FF]"></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#A5B4FC] overflow-hidden max-w-2xl mx-auto">
            <div className="px-6 py-5 border-b border-[#E0E7FF] bg-[#F8FAFC]">
              <h2 className="text-lg font-bold text-[#1E3A8A]">
              시간외근무 {workType === 'pre' ? '사전 신청' : '사후 확인'} 등록
              </h2>
              <p className="text-sm text-gray-500 mt-1">
              {workType === 'pre'
               ? '시간외근무 예정 내용을 작성해 주세요.'
               : '실제 시간외근무 내용을 작성해 주세요.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    성명
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={userName}
                      onChange={handleNameChange}
                      placeholder="본인 성명"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    근무일
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleFormChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    출근시간
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={splitTime(formData.startTime).hour}
                      onChange={(e) =>
                        handleTimeSelectChange(
                          'startTime',
                          'hour',
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    >
                      {startHourOptions.map((h) => (
                        <option key={h} value={h}>
                          {h}시
                        </option>
                      ))}
                    </select>

                    <select
                      value={splitTime(formData.startTime).minute}
                      onChange={(e) =>
                        handleTimeSelectChange(
                          'startTime',
                          'minute',
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}분
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    퇴근시간
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={splitTime(formData.endTime).hour}
                      onChange={(e) =>
                        handleTimeSelectChange(
                          'endTime',
                          'hour',
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    >
                      {endHourOptions.map((h) => (
                        <option key={h} value={h}>
                          {h}시
                        </option>
                      ))}
                    </select>

                    <select
                      value={splitTime(formData.endTime).minute}
                      onChange={(e) =>
                        handleTimeSelectChange(
                          'endTime',
                          'minute',
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                      required
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}분
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-[#EEF2FF] p-4 rounded-xl flex justify-between items-center border border-[#A5B4FC]">
                <label className="text-sm font-bold text-[#1E3A8A] flex flex-col">
                  <span>수당시간 (직접 입력)</span>
                  <span className="text-xs text-[#4F46E5] mt-0.5 font-medium">
                    ※ 정규시간(09~18시) 제외, 최대 4시간
                  </span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleFormChange}
                    step="0.5"
                    min="0"
                    max="4"
                    className="w-20 px-2 py-1 text-right text-xl font-extrabold text-[#1E3A8A] bg-white border border-[#A5B4FC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    required
                  />
                  <span className="text-xl font-extrabold text-[#1E3A8A]">
                    시간
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  근무내역(상세히 기재)
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleFormChange}
                  placeholder="예: 독거노인 가정 긴급 방문 및 상담 지원"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E3A8A] outline-none resize-none"
                  required
                ></textarea>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={!userName || isLoading}
                  className="w-full py-3.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold rounded-xl disabled:bg-gray-300 flex items-center justify-center space-x-2"
                >
                  <CheckCircle size={20} />
                  <span>
                  {workType === 'pre'
                  ? '사전 신청 등록하기'
                  : '사후 확인 등록하기'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
