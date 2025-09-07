// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDX882cvhwQgfhbsLFn69Q2l-TUQUR5IBk",
  authDomain: "codingkan-factory-apps.firebaseapp.com",
  databaseURL: "https://codingkan-factory-apps-default-rtdb.firebaseio.com",
  projectId: "codingkan-factory-apps",
  storageBucket: "codingkan-factory-apps.firebasestorage.app",
  messagingSenderId: "188856222342",
  appId: "1:188856222342:android:ae0e1873684da414cec707"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const nisnInput = document.getElementById('nisnInput');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginBtnSpinner = document.getElementById('loginBtnSpinner');
const loginError = document.getElementById('loginError');

const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userNISN = document.getElementById('userNISN');
const userPoints = document.getElementById('userPoints');
const pointsStatus = document.getElementById('pointsStatus');
const totalCases = document.getElementById('totalCases');
const cleanRecords = document.getElementById('cleanRecords');
const violations = document.getElementById('violations');
const casesContainer = document.getElementById('casesContainer');

// Utility functions
function formatDate(dateString) {
  if (!dateString) return 'Tanggal tidak tersedia';
  
  try {
    const date = new Date(dateString);
    const options = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    };
    return date.toLocaleDateString('id-ID', options);
  } catch (error) {
    return dateString; // Return original if formatting fails
  }
}

// Create case card
function createCaseCard(caseData) {
  const isClean = caseData.caseType === "Anda Bersih" || caseData.pointsDeducted === 0;
  
  // Calculate progress
  let progressPercent = 0;
  if (caseData.finalPoints !== undefined) {
    progressPercent = Math.max(0, Math.min(100, caseData.finalPoints));
  } else if (caseData.pointsDeducted !== undefined) {
    progressPercent = Math.max(0, Math.min(100, 100 - caseData.pointsDeducted));
  } else {
    progressPercent = 100;
  }
  
  // Progress bar color
  let progressColor = 'bg-green-500';
  if (progressPercent < 80) progressColor = 'bg-yellow-500';
  if (progressPercent < 60) progressColor = 'bg-red-500';

  // Get date from various possible fields
  const caseDate = caseData.date || caseData.tanggalKasus || null;
  const formattedDate = formatDate(caseDate);

  const card = document.createElement('div');
  card.className = 'bg-white rounded-24 p-6 shadow-lg card-hover mb-4';
  
  card.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div class="flex items-center space-x-3">
        <i class="fas ${isClean ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-yellow-500'} text-xl"></i>
        <div>
          <h6 class="font-semibold text-gray-800">${caseData.caseType || 'Tidak tercatat'}</h6>
          <p class="text-gray-500 text-xs mt-1">
            <i class="fas fa-calendar-alt mr-1"></i>${formattedDate}
          </p>
          ${caseData.details && caseData.details.trim() ? `
            <p class="text-gray-600 text-sm mt-1">${caseData.details}</p>
          ` : ''}
        </div>
      </div>
      <span class="px-3 py-1 rounded-24 text-sm font-medium ${isClean ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
        ${caseData.pointsDeducted && caseData.pointsDeducted > 0 ? 
          `-${caseData.pointsDeducted}` : 'Bersih'}
      </span>
    </div>
     
    
    ${caseData.initialPoints !== undefined && caseData.finalPoints !== undefined ? `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-gray-50 rounded-24 p-3 text-center">
          <p class="text-gray-600 text-sm">Poin Awal</p>
          <p class="font-bold text-gray-800">${caseData.initialPoints}</p>
        </div>
        <div class="bg-gray-50 rounded-24 p-3 text-center">
          <p class="text-gray-600 text-sm">Poin Akhir</p>
          <p class="font-bold ${caseData.finalPoints >= caseData.initialPoints ? 'text-green-600' : 'text-red-600'}">${caseData.finalPoints}</p>
        </div>
      </div>
    ` : ''}
    
    <div class="w-full bg-gray-200 rounded-24 h-2 mb-2">
      <div class="progress-bar ${progressColor} h-2 rounded-24" style="width: ${progressPercent}%"></div>
    </div>
    <p class="text-center text-sm text-gray-600">${progressPercent}% poin tersisa</p>
  `;
  
  return card;
}

// Loading and empty states
function showLoading() {
  casesContainer.innerHTML = `
    <div class="text-center py-12">
      <i class="fas fa-spinner fa-spin text-3xl text-gray-400 mb-4"></i>
      <p class="text-gray-600">Memuat data...</p>
    </div>
  `;
}

function showEmptyState() {
  casesContainer.innerHTML = `
    <div class="text-center py-12">
      <i class="fas fa-check-circle text-5xl text-green-500 mb-4"></i>
      <h6 class="text-xl font-semibold text-green-600 mb-2">Tidak Ada Kasus</h6>
      <p class="text-gray-600">Catatan bersih</p>
    </div>
  `;
}

// Load user data
async function loadUserData(nisn) {
  try {
    showLoading();
    
    const usersSnapshot = await get(child(ref(db), "users"));
    const casesSnapshot = await get(child(ref(db), "cases"));
    
    let userData = null;
    let userCases = [];
    let currentPoints = 100;

    // Find user data
    if (usersSnapshot.exists()) {
      usersSnapshot.forEach(childSnap => {
        const data = childSnap.val();
        if (data.nisn === nisn || data.uid === nisn) {
          userData = {
            id: childSnap.key,
            name: data.name || `User ${nisn}`,
            points: data.points || 100,
            ...data
          };
          currentPoints = data.points || 100;
        }
      });
    }

    // Get user cases
    if (casesSnapshot.exists()) {
      casesSnapshot.forEach(childSnap => {
        const caseData = childSnap.val();
        if (caseData.nisn === nisn || caseData.uid === nisn) {
          userCases.push({ id: childSnap.key, ...caseData });
        }
      });
    }

    // Create user data from cases if not found
    if (!userData && userCases.length > 0) {
      const latestCase = userCases.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
      userData = {
        name: latestCase.name || `User ${nisn}`,
        points: latestCase.finalPoints || 100,
        nisn: nisn
      };
      currentPoints = latestCase.finalPoints || 100;
    }

    if (!userData) {
      throw new Error('User not found');
    }

    // Update user info
    userName.textContent = userData.name;
    userNISN.textContent = userData.nisn || nisn;
    userPoints.textContent = currentPoints;
    
    if (userData.name) {
      userAvatar.innerHTML = userData.name.charAt(0).toUpperCase();
    }
    
    // Update status
    if (currentPoints >= 90) {
      pointsStatus.textContent = "Sangat Baik";
      pointsStatus.className = "text-green-200 text-sm";
    } else if (currentPoints >= 75) {
      pointsStatus.textContent = "Baik";
      pointsStatus.className = "text-yellow-200 text-sm";
    } else if (currentPoints >= 60) {
      pointsStatus.textContent = "Perlu Perhatian";
      pointsStatus.className = "text-orange-200 text-sm";
    } else {
      pointsStatus.textContent = "Kritis";
      pointsStatus.className = "text-red-200 text-sm";
    }

    // Update stats
    totalCases.textContent = userCases.length;
    const cleanCount = userCases.filter(c => c.caseType === "Anda Bersih" || c.pointsDeducted === 0).length;
    cleanRecords.textContent = cleanCount;
    violations.textContent = userCases.length - cleanCount;

    // Display cases
    if (userCases.length === 0) {
      showEmptyState();
      return userData;
    }

    // Sort by timestamp (newest first)
    userCases.sort((a, b) => {
      const aTime = a.timestamp || new Date(a.date).getTime() || 0;
      const bTime = b.timestamp || new Date(b.date).getTime() || 0;
      return bTime - aTime;
    });

    // Clear container and add cases
    casesContainer.innerHTML = '';
    userCases.forEach(caseData => {
      const card = createCaseCard(caseData);
      casesContainer.appendChild(card);
    });

    return userData;

  } catch (error) {
    console.error('Error loading data:', error);
    casesContainer.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-24 p-6 text-center">
        <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-2"></i>
        <p class="text-red-700">${error.message === 'User not found' ? 'NISN tidak ditemukan' : 'Gagal memuat data'}</p>
      </div>
    `;
    throw error;
  }
}

// Event listeners
nisnInput.addEventListener('input', () => {
  const value = nisnInput.value.trim();
  loginBtn.disabled = value.length === 0;
  nisnInput.classList.remove('border-red-500');
  loginError.classList.add('hidden');
});

// Handle login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nisn = nisnInput.value.trim();
  
  if (!nisn) {
    nisnInput.classList.add('border-red-500');
    loginError.textContent = 'NISN harus diisi!';
    loginError.classList.remove('hidden');
    return;
  }
  
  // Show loading
  loginBtn.disabled = true;
  loginBtnText.textContent = 'Memuat...';
  loginBtnSpinner.classList.remove('hidden');
  
  try {
    await loadUserData(nisn);
    
    // Success - switch to dashboard
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
  } catch (error) {
    nisnInput.classList.add('border-red-500');
    loginError.textContent = error.message === 'User not found' ? 
      'NISN tidak ditemukan!' : 
      'Terjadi kesalahan. Silakan coba lagi.';
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtnText.textContent = 'Masuk';
    loginBtnSpinner.classList.add('hidden');
  }
});

// Initial focus
setTimeout(() => nisnInput.focus(), 500);
