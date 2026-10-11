/**
 * WareFlow - Sistem Manajemen Gudang & Logistik Distributor Danone-AQUA
 * Google Apps Script Web App (HtmlService) + Google Sheets Database
 *
 * Bahasa Antarmuka & Dokumentasi: Bahasa Indonesia
 */

// Konstanta Nama Sheet Database
const SHEETS = {
  USERS: 'Users',
  PRODUK: 'Produk',
  PIHAK: 'Pihak',
  TRANSAKSI: 'Transaksi',
  OPNAME: 'Opname',
  OPNAME_DETAIL: 'OpnameDetail'
};

// Header Kolom untuk Setiap Sheet
const HEADERS = {
  USERS: ['email', 'nama', 'role', 'aktif', 'created_at'],
  PRODUK: ['sku', 'nama_produk', 'kategori', 'pcs_per_karton', 'stok_minimum_karton', 'lead_time_hari', 'harga_karton', 'aktif', 'avg_penjualan_harian_karton'],
  PIHAK: ['id_pihak', 'nama_pihak', 'jenis', 'kontak', 'alamat', 'aktif'],
  TRANSAKSI: ['id_transaksi', 'timestamp', 'jenis', 'arah', 'sku', 'qty_pcs', 'pihak', 'no_dokumen', 'catatan', 'user_email'],
  OPNAME: ['id_opname', 'tanggal_buka', 'tanggal_tutup', 'status', 'dibuka_oleh', 'ditutup_oleh', 'catatan', 'snapshot_sistem_json'],
  OPNAME_DETAIL: ['id_detail', 'id_opname', 'sku', 'qty_sistem_pcs', 'qty_hitung_pcs', 'user_email', 'timestamp', 'catatan']
};

// Jenis Transaksi Masuk & Keluar yang Sah
const JENIS_TRX = {
  MASUK: ['PABRIK', 'TRANSFER_MASUK', 'RETUR_ARMADA'],
  KELUAR: ['TRANSFER_KELUAR', 'KANVAS', 'MUAT_ARMADA'],
  PENYESUAIAN: 'PENYESUAIAN'
};

// Role yang Tersedia
const ROLES = {
  ADMIN: 'admin',
  KEPALA_GUDANG: 'kepala_gudang',
  KEPALA_DEPO: 'kepala_depo'
};

/**
 * Entry point Web App (GET request)
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('WareFlow - Distributor Aqua')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Mendapatkan Spreadsheet yang aktif atau terikat
 */
function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (propId) {
      try {
        ss = SpreadsheetApp.openById(propId);
      } catch (e) {
        throw new Error('Gagal membuka Spreadsheet dengan ID ' + propId + ': ' + e.message);
      }
    }
  }
  if (!ss) {
    throw new Error('Spreadsheet tidak terikat. Pastikan Apps Script dibuat melalui Google Sheets (menu Ekstensi > Apps Script) atau tambahkan Script Property "SPREADSHEET_ID" di Pengaturan Proyek Apps Script.');
  }
  return ss;
}

/**
 * Membaca seluruh data dari sheet secara batch (getValues)
 * Mengembalikan array of objects sesuai header baris pertama
 */
function getSheetDataBatch(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return []; // Hanya header atau kosong
  
  var headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var results = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = { _rowIndex: i + 1 };
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      obj[headers[j]] = val;
      if (val !== '' && val !== null && val !== undefined) hasData = true;
    }
    if (hasData) {
      results.push(obj);
    }
  }
  return results;
}

/**
 * Mengambil informasi user yang sedang aktif berdasarkan Session Google
 */
function getCurrentUser() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    // Mode fallback jika dijalankan tanpa login domain atau test environment
    email = Session.getEffectiveUser().getEmail() || 'demo.user@danone-distrib.co.id';
  }
  
  var users = getSheetDataBatch(SHEETS.USERS);
  var matchedUser = null;
  
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).trim().toLowerCase() === email.trim().toLowerCase()) {
      matchedUser = users[i];
      break;
    }
  }
  
  if (!matchedUser) {
    return {
      authenticated: false,
      registered: false,
      email: email,
      role: null,
      aktif: false
    };
  }
  
  var isAktif = matchedUser.aktif === true || String(matchedUser.aktif).toLowerCase() === 'true';
  return {
    authenticated: true,
    registered: true,
    email: matchedUser.email,
    nama: matchedUser.nama,
    role: matchedUser.role,
    aktif: isAktif
  };
}

/**
 * Validasi Role Pengguna di Sisi Server
 */
function validateRole(allowedRoles) {
  var user = getCurrentUser();
  if (!user.registered || !user.aktif) {
    throw new Error('Akses Ditolak: Akun Anda (' + user.email + ') belum terdaftar atau belum diaktifkan oleh Admin.');
  }
  
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('Akses Ditolak: Peran "' + user.role + '" tidak memiliki otorisasi untuk melakukan tindakan ini.');
  }
  
  return user;
}

/**
 * Mengajukan permohonan akses baru (jika email tidak terdaftar)
 */
function submitAccessRequest(nama, catatan) {
  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  if (!email) {
    throw new Error('Email Google tidak terdeteksi dari sesi aktif.');
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    if (!sheet) {
      setup();
      sheet = ss.getSheetByName(SHEETS.USERS);
    }
    
    var users = getSheetDataBatch(SHEETS.USERS);
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).trim().toLowerCase() === email.trim().toLowerCase()) {
        if (users[i].aktif === true || String(users[i].aktif).toLowerCase() === 'true') {
          return { success: true, message: 'Akun Anda sudah terdaftar dan aktif. Silakan segarkan halaman.' };
        } else {
          return { success: true, message: 'Permohonan akses Anda sudah tercatat dan sedang menunggu persetujuan Admin.' };
        }
      }
    }
    
    // Tambah baris baru dengan aktif = false
    var newRow = [
      email,
      nama || email.split('@')[0],
      ROLES.KEPALA_DEPO, // Default role pemohon
      false, // Belum aktif
      new Date().toISOString()
    ];
    sheet.appendRow(newRow);
    
    return { success: true, message: 'Permohonan akses berhasil dikirim. Menunggu persetujuan Admin.' };
  } catch (err) {
    throw new Error('Gagal mengajukan akses: ' + err.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menghitung stok saat ini untuk semua SKU dari sheet Transaksi (sum masuk - sum keluar)
 * Aturan Inti: Stok TIDAK disimpan di database; selalu dihitung real-time per SKU.
 */
function calculateStockPcsMap() {
  var transactions = getSheetDataBatch(SHEETS.TRANSAKSI);
  var stockMap = {}; // sku -> total_pcs
  
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    var sku = String(t.sku).trim();
    if (!sku) continue;
    
    var qty = Number(t.qty_pcs) || 0;
    var arah = String(t.arah).trim().toUpperCase();
    
    if (!stockMap[sku]) stockMap[sku] = 0;
    
    if (arah === 'MASUK') {
      stockMap[sku] += qty;
    } else if (arah === 'KELUAR') {
      stockMap[sku] -= qty;
    }
  }
  
  return stockMap;
}

/**
 * Mendapatkan data ringkasan Dashboard
 */
function getDashboardData() {
  // Hanya user aktif yang boleh melihat
  var user = validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  var products = getSheetDataBatch(SHEETS.PRODUK);
  var transactions = getSheetDataBatch(SHEETS.TRANSAKSI);
  var stockPcsMap = calculateStockPcsMap();
  
  var totalKarton = 0;
  var totalPcsLepasan = 0;
  var lowStockProducts = [];
  var skuStockList = [];
  
  // Format produk & evaluasi status stok
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var isAktif = p.aktif === true || String(p.aktif).toLowerCase() === 'true';
    if (!isAktif) continue;
    
    var sku = String(p.sku).trim();
    var currentPcs = stockPcsMap[sku] || 0;
    var pcsPerKtn = Number(p.pcs_per_karton) || 1;
    var minKtn = Number(p.stok_minimum_karton) || 0;
    var minPcs = minKtn * pcsPerKtn;
    
    var karton = Math.floor(currentPcs / pcsPerKtn);
    var sisaPcs = currentPcs % pcsPerKtn;
    
    totalKarton += karton;
    totalPcsLepasan += sisaPcs;
    
    var status = 'AMAN';
    if (currentPcs <= 0) {
      status = 'HABIS';
    } else if (currentPcs < minPcs) {
      status = 'KRITIS';
    } else if (currentPcs <= minPcs * 1.25) {
      status = 'MENIPIS';
    }
    
    var item = {
      sku: sku,
      nama_produk: p.nama_produk,
      kategori: p.kategori,
      pcs_per_karton: pcsPerKtn,
      stok_minimum_karton: minKtn,
      current_pcs: currentPcs,
      current_karton: karton,
      current_sisa_pcs: sisaPcs,
      status: status,
      lead_time_hari: Number(p.lead_time_hari) || 2
    };
    
    skuStockList.push(item);
    if (status === 'KRITIS' || status === 'HABIS') {
      lowStockProducts.push(item);
    }
  }
  
  // 10 Transaksi Terakhir
  var recentTransactions = transactions.slice(-10).reverse().map(function(t) {
    return {
      id_transaksi: t.id_transaksi,
      timestamp: t.timestamp,
      jenis: t.jenis,
      arah: t.arah,
      sku: t.sku,
      qty_pcs: Number(t.qty_pcs) || 0,
      pihak: t.pihak,
      no_dokumen: t.no_dokumen,
      catatan: t.catatan,
      user_email: t.user_email
    };
  });
  
  // Perhitungan Data Grafik Masuk vs Keluar 30 Hari Terakhir
  var chartData = calculate30DayInOut(transactions);
  
  return {
    user: user,
    total_karton: totalKarton,
    total_pcs_lepasan: totalPcsLepasan,
    critical_sku_count: lowStockProducts.length,
    low_stock_products: lowStockProducts,
    sku_stocks: skuStockList,
    recent_transactions: recentTransactions,
    chart_30_days: chartData
  };
}

/**
 * Menghitung agregasi masuk vs keluar per hari selama 30 hari terakhir
 */
function calculate30DayInOut(transactions) {
  var now = new Date();
  var dates = [];
  var mapIn = {};
  var mapOut = {};
  
  // Buat 30 hari ke belakang
  for (var d = 29; d >= 0; d--) {
    var dt = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    var dateStr = Utilities.formatDate(dt, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
    dates.push(dateStr);
    mapIn[dateStr] = 0;
    mapOut[dateStr] = 0;
  }
  
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (!t.timestamp) continue;
    var txDate = new Date(t.timestamp);
    var txDateStr = Utilities.formatDate(txDate, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
    
    if (mapIn.hasOwnProperty(txDateStr)) {
      var qty = Number(t.qty_pcs) || 0;
      var arah = String(t.arah).trim().toUpperCase();
      if (arah === 'MASUK') {
        mapIn[txDateStr] += qty;
      } else if (arah === 'KELUAR') {
        mapOut[txDateStr] += qty;
      }
    }
  }
  
  var inbound = [];
  var outbound = [];
  for (var j = 0; j < dates.length; j++) {
    inbound.push(mapIn[dates[j]]);
    outbound.push(mapOut[dates[j]]);
  }
  
  return {
    labels: dates,
    inbound: inbound,
    outbound: outbound
  };
}

/**
 * Mengambil daftar produk & stok terkini
 */
function getProductsAndStock() {
  validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  var products = getSheetDataBatch(SHEETS.PRODUK);
  var stockPcsMap = calculateStockPcsMap();
  
  return products.map(function(p) {
    var sku = String(p.sku).trim();
    var currentPcs = stockPcsMap[sku] || 0;
    var pcsPerKtn = Number(p.pcs_per_karton) || 1;
    var minKtn = Number(p.stok_minimum_karton) || 0;
    var minPcs = minKtn * pcsPerKtn;
    
    var karton = Math.floor(currentPcs / pcsPerKtn);
    var sisaPcs = currentPcs % pcsPerKtn;
    
    var status = 'AMAN';
    if (currentPcs <= 0) status = 'HABIS';
    else if (currentPcs < minPcs) status = 'KRITIS';
    else if (currentPcs <= minPcs * 1.25) status = 'MENIPIS';
    
    return {
      sku: sku,
      nama_produk: p.nama_produk,
      kategori: p.kategori,
      pcs_per_karton: pcsPerKtn,
      stok_minimum_karton: minKtn,
      lead_time_hari: Number(p.lead_time_hari) || 2,
      harga_karton: Number(p.harga_karton) || 0,
      aktif: p.aktif === true || String(p.aktif).toLowerCase() === 'true',
      avg_penjualan_harian_karton: Number(p.avg_penjualan_harian_karton) || 0,
      current_pcs: currentPcs,
      current_karton: karton,
      current_sisa_pcs: sisaPcs,
      status: status
    };
  });
}

/**
 * Menyimpan / Mengubah Produk (Hanya Admin)
 */
function saveProduct(productData) {
  validateRole([ROLES.ADMIN]);
  
  var sku = String(productData.sku || '').trim().toUpperCase();
  if (!sku) throw new Error('SKU Produk wajib diisi.');
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PRODUK);
    var products = getSheetDataBatch(SHEETS.PRODUK);
    
    var foundIndex = -1;
    for (var i = 0; i < products.length; i++) {
      if (String(products[i].sku).trim().toUpperCase() === sku) {
        foundIndex = products[i]._rowIndex;
        break;
      }
    }
    
    var rowValues = [
      sku,
      productData.nama_produk || sku,
      productData.kategori || 'Umum',
      Number(productData.pcs_per_karton) || 1,
      Number(productData.stok_minimum_karton) || 10,
      Number(productData.lead_time_hari) || 2,
      Number(productData.harga_karton) || 0,
      productData.aktif !== false,
      Number(productData.avg_penjualan_harian_karton) || 0
    ];
    
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    
    return { success: true, message: 'Produk ' + sku + ' berhasil disimpan.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengambil daftar Pihak
 */
function getPartners() {
  validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  return getSheetDataBatch(SHEETS.PIHAK);
}

/**
 * Menyimpan / Mengubah Pihak (Hanya Admin)
 */
function savePartner(partnerData) {
  validateRole([ROLES.ADMIN]);
  
  var namaPihak = String(partnerData.nama_pihak || '').trim();
  if (!namaPihak) throw new Error('Nama Pihak wajib diisi.');
  
  var idPihak = partnerData.id_pihak || ('PHK-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss'));
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PIHAK);
    var partners = getSheetDataBatch(SHEETS.PIHAK);
    
    var foundIndex = -1;
    for (var i = 0; i < partners.length; i++) {
      if (String(partners[i].id_pihak).trim() === idPihak) {
        foundIndex = partners[i]._rowIndex;
        break;
      }
    }
    
    var rowValues = [
      idPihak,
      namaPihak,
      partnerData.jenis || 'OUTLET',
      partnerData.kontak || '',
      partnerData.alamat || '',
      partnerData.aktif !== false
    ];
    
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    
    return { success: true, message: 'Pihak ' + namaPihak + ' berhasil disimpan.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengambil daftar User (Hanya Admin)
 */
function getUsers() {
  validateRole([ROLES.ADMIN]);
  return getSheetDataBatch(SHEETS.USERS);
}

/**
 * Menyimpan / Mengubah Pengguna (Hanya Admin)
 */
function saveUser(userData) {
  validateRole([ROLES.ADMIN]);
  
  var email = String(userData.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email pengguna wajib diisi.');
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    var users = getSheetDataBatch(SHEETS.USERS);
    
    var foundIndex = -1;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).trim().toLowerCase() === email) {
        foundIndex = users[i]._rowIndex;
        break;
      }
    }
    
    var rowValues = [
      email,
      userData.nama || email.split('@')[0],
      userData.role || ROLES.KEPALA_DEPO,
      userData.aktif === true || String(userData.aktif).toLowerCase() === 'true',
      userData.created_at || new Date().toISOString()
    ];
    
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    
    return { success: true, message: 'Pengguna ' + email + ' berhasil disimpan.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Toggle Status Aktif Pengguna (Hanya Admin)
 */
function toggleUserActive(email, aktif) {
  validateRole([ROLES.ADMIN]);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    var users = getSheetDataBatch(SHEETS.USERS);
    
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).trim().toLowerCase() === email.trim().toLowerCase()) {
        sheet.getRange(users[i]._rowIndex, 4).setValue(aktif);
        return { success: true, message: 'Status user ' + email + ' diubah menjadi ' + (aktif ? 'Aktif' : 'Nonaktif') };
      }
    }
    throw new Error('User dengan email ' + email + ' tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menyimpan Transaksi Gudang
 * ATURAN INTI:
 * - Gunakan LockService
 * - Tolak transaksi keluar jika stok tidak mencukupi
 * - Validasi kewenangan role untuk jenis transaksi tertentu
 */
function saveTransaction(txData) {
  var user = validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  var jenis = String(txData.jenis || '').trim().toUpperCase();
  var sku = String(txData.sku || '').trim().toUpperCase();
  var qtyPcs = Number(txData.qty_pcs) || 0;
  var pihak = String(txData.pihak || '').trim();
  var noDokumen = String(txData.no_dokumen || '').trim();
  var catatan = String(txData.catatan || '').trim();
  
  if (!jenis) throw new Error('Jenis transaksi wajib dipilih.');
  if (!sku) throw new Error('SKU produk wajib dipilih.');
  if (qtyPcs <= 0) throw new Error('Kuantitas (pcs) harus lebih besar dari 0.');
  
  // Tentukan Arah: MASUK atau KELUAR
  var arah = '';
  if (JENIS_TRX.MASUK.indexOf(jenis) !== -1) {
    arah = 'MASUK';
  } else if (JENIS_TRX.KELUAR.indexOf(jenis) !== -1) {
    arah = 'KELUAR';
  } else {
    throw new Error('Jenis transaksi "' + jenis + '" tidak valid.');
  }
  
  // Otorisasi role: kepala_depo HANYA boleh KANVAS, MUAT_ARMADA, RETUR_ARMADA
  if (user.role === ROLES.KEPALA_DEPO) {
    var allowedDepo = ['KANVAS', 'MUAT_ARMADA', 'RETUR_ARMADA'];
    if (allowedDepo.indexOf(jenis) === -1) {
      throw new Error('Akses Ditolak: Kepala Depo hanya berwenang mencatat KANVAS, MUAT_ARMADA, dan RETUR_ARMADA.');
    }
  }
  
  var lock = LockService.getScriptLock();
  try {
    // Kunci script untuk mencegah race condition mutasi stok
    var gotLock = lock.tryLock(10000);
    if (!gotLock) {
      throw new Error('Sistem sedang memproses transaksi lain. Silakan coba kembali dalam beberapa detik.');
    }
    
    // Periksa stok terkini jika transaksi KELUAR
    if (arah === 'KELUAR') {
      var stockMap = calculateStockPcsMap();
      var currentStock = stockMap[sku] || 0;
      
      if (qtyPcs > currentStock) {
        // Ambil info produk untuk pesan error yang ramah
        var products = getSheetDataBatch(SHEETS.PRODUK);
        var pcsPerKtn = 1;
        for (var p = 0; p < products.length; p++) {
          if (String(products[p].sku).trim().toUpperCase() === sku) {
            pcsPerKtn = Number(products[p].pcs_per_karton) || 1;
            break;
          }
        }
        var currentKtn = Math.floor(currentStock / pcsPerKtn);
        var currentSisa = currentStock % pcsPerKtn;
        var reqKtn = Math.floor(qtyPcs / pcsPerKtn);
        var reqSisa = qtyPcs % pcsPerKtn;
        
        throw new Error(
          'Transaksi Ditolak: Stok ' + sku + ' tidak mencukupi!\n' +
          'Sisa stok saat ini: ' + currentKtn + ' Karton (' + currentStock + ' pcs).\n' +
          'Permintaan keluar: ' + reqKtn + ' Karton (' + qtyPcs + ' pcs).'
        );
      }
    }
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TRANSAKSI);
    var idTrx = 'TRX-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
    var timestamp = new Date().toISOString();
    
    var newRow = [
      idTrx,
      timestamp,
      jenis,
      arah,
      sku,
      qtyPcs,
      pihak,
      noDokumen,
      catatan,
      user.email
    ];
    
    sheet.appendRow(newRow);
    
    return {
      success: true,
      message: 'Transaksi ' + jenis + ' (' + sku + ') sebesar ' + qtyPcs + ' pcs berhasil dicatat.',
      id_transaksi: idTrx
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menyimpan Stok Sistem Awal per SKU (Hanya Super Admin)
 * Menyesuaikan saldo sistem secara transaksional dengan audit trail
 */
function setInitialStock(sku, karton, pcs, catatan, tanggal) {
  var user = validateRole([ROLES.ADMIN]);
  
  sku = String(sku || '').trim().toUpperCase();
  if (!sku) throw new Error('SKU produk wajib dipilih.');
  
  var ktn = Math.max(0, Number(karton) || 0);
  var lepasan = Math.max(0, Number(pcs) || 0);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var products = getSheetDataBatch(SHEETS.PRODUK);
    var targetProd = null;
    for (var i = 0; i < products.length; i++) {
      if (String(products[i].sku).trim().toUpperCase() === sku) {
        targetProd = products[i];
        break;
      }
    }
    if (!targetProd) throw new Error('Produk dengan SKU ' + sku + ' tidak ditemukan.');
    
    var pcsPerKtn = Number(targetProd.pcs_per_karton) || 1;
    var targetTotalPcs = (ktn * pcsPerKtn) + lepasan;
    
    var stockMap = calculateStockPcsMap();
    var currentStockPcs = stockMap[sku] || 0;
    var selisihPcs = targetTotalPcs - currentStockPcs;
    
    if (selisihPcs === 0) {
      return {
        success: true,
        message: 'Stok sistem ' + sku + ' sudah tepat (' + ktn + ' Karton + ' + lepasan + ' pcs = ' + targetTotalPcs + ' pcs). Tidak diperlukan transaksi penyesuaian.'
      };
    }
    
    var ss = getSpreadsheet();
    var trxSheet = ss.getSheetByName(SHEETS.TRANSAKSI);
    var arah = selisihPcs > 0 ? 'MASUK' : 'KELUAR';
    var absQty = Math.abs(selisihPcs);
    var idTrx = 'TRX-INIT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '-' + sku;
    var txTimestamp = tanggal ? new Date(tanggal).toISOString() : new Date().toISOString();
    
    var txRow = [
      idTrx,
      txTimestamp,
      'PENYESUAIAN',
      arah,
      sku,
      absQty,
      'SALDO AWAL GUDANG',
      'SALDO-AWAL',
      catatan || ('Inisialisasi Stok Sistem Awal: ' + ktn + ' Ktn ' + lepasan + ' pcs (Target ' + targetTotalPcs + ' pcs, Penyesuaian ' + (selisihPcs > 0 ? '+' : '') + selisihPcs + ' pcs)'),
      user.email
    ];
    
    trxSheet.appendRow(txRow);
    
    return {
      success: true,
      message: 'Stok sistem ' + sku + ' berhasil diset ke ' + ktn + ' Karton + ' + lepasan + ' pcs (' + targetTotalPcs + ' pcs). Transaksi ' + arah + ' sebesar ' + absQty + ' pcs telah dicatat.',
      id_transaksi: idTrx
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menyimpan Batch Stok Sistem Awal dan Acuan Rata-rata Penjualan Forecast (Hanya Super Admin)
 * items: Array of { sku, karton, pcs, avg_sales_karton }
 */
function saveBatchInitialStockAndForecast(items, tanggal, catatan) {
  var user = validateRole([ROLES.ADMIN]);
  
  if (!items || !items.length) {
    throw new Error('Data item inisialisasi tidak boleh kosong.');
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    var ss = getSpreadsheet();
    var prodSheet = ss.getSheetByName(SHEETS.PRODUK);
    var trxSheet = ss.getSheetByName(SHEETS.TRANSAKSI);
    
    var products = getSheetDataBatch(SHEETS.PRODUK);
    var stockMap = calculateStockPcsMap();
    
    var prodMap = {}; // sku -> product row
    for (var p = 0; p < products.length; p++) {
      prodMap[String(products[p].sku).trim().toUpperCase()] = products[p];
    }
    
    var nowStr = new Date().toISOString();
    var txTimestamp = tanggal ? new Date(tanggal).toISOString() : nowStr;
    var adjustedStockCount = 0;
    var updatedForecastCount = 0;
    
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var sku = String(itm.sku || '').trim().toUpperCase();
      if (!sku || !prodMap[sku]) continue;
      
      var prod = prodMap[sku];
      var pcsPerKtn = Number(prod.pcs_per_karton) || 1;
      
      // 1. Update Rata-rata Penjualan untuk Forecast di Sheet Produk
      if (itm.avg_sales_karton !== undefined && itm.avg_sales_karton !== null && itm.avg_sales_karton !== '') {
        var avgSales = Math.max(0, Number(itm.avg_sales_karton) || 0);
        prodSheet.getRange(prod._rowIndex, 9).setValue(avgSales);
        updatedForecastCount++;
      }
      
      // 2. Cek dan simpan penyesuaian stok sistem awal jika diisi
      if (itm.karton !== undefined && itm.karton !== null && itm.karton !== '') {
        var ktn = Math.max(0, Number(itm.karton) || 0);
        var lepasan = Math.max(0, Number(itm.pcs) || 0);
        var targetTotalPcs = (ktn * pcsPerKtn) + lepasan;
        
        var currentPcs = stockMap[sku] || 0;
        var selisih = targetTotalPcs - currentPcs;
        
        if (selisih !== 0) {
          var arah = selisih > 0 ? 'MASUK' : 'KELUAR';
          var absQty = Math.abs(selisih);
          var idTrx = 'TRX-INIT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900) + '-' + sku;
          
          var txRow = [
            idTrx,
            txTimestamp,
            'PENYESUAIAN',
            arah,
            sku,
            absQty,
            'SALDO AWAL GUDANG',
            'SALDO-AWAL',
            catatan || ('Inisialisasi Stok Sistem Awal: ' + ktn + ' Ktn ' + lepasan + ' pcs (Target ' + targetTotalPcs + ' pcs, Penyesuaian ' + (selisih > 0 ? '+' : '') + selisih + ' pcs)'),
            user.email
          ];
          
          trxSheet.appendRow(txRow);
          stockMap[sku] = targetTotalPcs; // Update stok memori
          adjustedStockCount++;
        }
      }
    }
    
    return {
      success: true,
      message: 'Inisialisasi berhasil: ' + adjustedStockCount + ' mutasi stok awal dicatat, ' + updatedForecastCount + ' acuan rata-rata forecast diperbarui.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengambil Riwayat Transaksi dengan Filter
 */
function getTransactionHistory(filter) {
  validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  filter = filter || {};
  var transactions = getSheetDataBatch(SHEETS.TRANSAKSI);
  
  var startDate = filter.start_date ? new Date(filter.start_date) : null;
  var endDate = filter.end_date ? new Date(filter.end_date) : null;
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }
  
  var filtered = transactions.filter(function(t) {
    if (!t.id_transaksi) return false;
    
    // Filter tanggal
    if (t.timestamp) {
      var dt = new Date(t.timestamp);
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
    }
    
    // Filter jenis
    if (filter.jenis && filter.jenis !== 'ALL') {
      if (String(t.jenis).toUpperCase() !== String(filter.jenis).toUpperCase()) return false;
    }
    
    // Filter pihak
    if (filter.pihak && filter.pihak !== 'ALL') {
      if (String(t.pihak).toLowerCase().indexOf(String(filter.pihak).toLowerCase()) === -1) return false;
    }
    
    // Filter SKU
    if (filter.sku && filter.sku !== 'ALL') {
      if (String(t.sku).toUpperCase() !== String(filter.sku).toUpperCase()) return false;
    }
    
    // Filter teks pencarian (search query)
    if (filter.query) {
      var q = String(filter.query).toLowerCase();
      var matchDoc = String(t.no_dokumen || '').toLowerCase().indexOf(q) !== -1;
      var matchPihak = String(t.pihak || '').toLowerCase().indexOf(q) !== -1;
      var matchSku = String(t.sku || '').toLowerCase().indexOf(q) !== -1;
      var matchTrx = String(t.id_transaksi || '').toLowerCase().indexOf(q) !== -1;
      if (!matchDoc && !matchPihak && !matchSku && !matchTrx) return false;
    }
    
    return true;
  });
  
  return filtered.reverse();
}

/**
 * Mengambil sesi opname yang sedang TERBUKA (jika ada)
 */
function getActiveOpnameSession() {
  validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  var opnameList = getSheetDataBatch(SHEETS.OPNAME);
  var activeOpname = null;
  
  for (var i = opnameList.length - 1; i >= 0; i--) {
    if (String(opnameList[i].status).toUpperCase() === 'TERBUKA') {
      activeOpname = opnameList[i];
      break;
    }
  }
  
  if (!activeOpname) return null;
  
  // Ambil detail hitungan
  var details = getSheetDataBatch(SHEETS.OPNAME_DETAIL);
  var sessionDetails = details.filter(function(d) {
    return String(d.id_opname).trim() === String(activeOpname.id_opname).trim();
  });
  
  // Ambil snapshot sistem
  var snapshot = {};
  if (activeOpname.snapshot_sistem_json) {
    try {
      snapshot = JSON.parse(activeOpname.snapshot_sistem_json);
    } catch (e) {
      snapshot = {};
    }
  }
  
  // Hitung agregat hitungan fisik per SKU (akumulasi banyak user)
  var countSummary = {}; // sku -> total_hitung_pcs
  for (var j = 0; j < sessionDetails.length; j++) {
    var d = sessionDetails[j];
    var s = String(d.sku).trim();
    if (!countSummary[s]) countSummary[s] = 0;
    countSummary[s] += Number(d.qty_hitung_pcs) || 0;
  }
  
  return {
    opname: activeOpname,
    snapshot_sistem: snapshot,
    details: sessionDetails,
    count_summary: countSummary
  };
}

/**
 * Membuka Sesi Stock Opname
 * ATURAN INTI:
 * - Otoritas: admin, kepala_gudang
 * - Bekukan stok sistem saat ini (qty_sistem_pcs) untuk semua SKU aktif
 */
function openOpnameSession(catatan) {
  var user = validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG]);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // Pastikan tidak ada sesi yang masih TERBUKA
    var opnameList = getSheetDataBatch(SHEETS.OPNAME);
    for (var i = 0; i < opnameList.length; i++) {
      if (String(opnameList[i].status).toUpperCase() === 'TERBUKA') {
        throw new Error('Masih ada sesi opname (' + opnameList[i].id_opname + ') yang sedang TERBUKA. Harap tutup sesi tersebut terlebih dahulu.');
      }
    }
    
    // Bekukan stok sistem saat ini
    var products = getSheetDataBatch(SHEETS.PRODUK);
    var stockMap = calculateStockPcsMap();
    var snapshot = {};
    
    for (var p = 0; p < products.length; p++) {
      var sku = String(products[p].sku).trim();
      var isAktif = products[p].aktif === true || String(products[p].aktif).toLowerCase() === 'true';
      if (isAktif && sku) {
        snapshot[sku] = stockMap[sku] || 0;
      }
    }
    
    var idOpname = 'OPN-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss');
    var timestamp = new Date().toISOString();
    
    var rowValues = [
      idOpname,
      timestamp,
      '', // tanggal_tutup kosong
      'TERBUKA',
      user.email,
      '', // ditutup_oleh kosong
      catatan || 'Stock Opname Rutin DC',
      JSON.stringify(snapshot)
    ];
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.OPNAME);
    sheet.appendRow(rowValues);
    
    return {
      success: true,
      message: 'Sesi Stock Opname ' + idOpname + ' berhasil dibuka. Stok sistem telah dibekukan.',
      id_opname: idOpname
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengisi Hitungan Fisik Opname (Multi-user: admin, kepala_gudang, kepala_depo)
 */
function submitOpnameCount(countData) {
  var user = validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  var idOpname = String(countData.id_opname || '').trim();
  var sku = String(countData.sku || '').trim().toUpperCase();
  var qtyHitungPcs = Number(countData.qty_hitung_pcs) || 0;
  var catatan = String(countData.catatan || '').trim();
  
  if (!idOpname) throw new Error('ID Sesi Opname tidak ditemukan.');
  if (!sku) throw new Error('SKU produk wajib dipilih.');
  if (qtyHitungPcs < 0) throw new Error('Kuantitas hitung fisik tidak boleh negatif.');
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // Periksa status opname
    var opnameList = getSheetDataBatch(SHEETS.OPNAME);
    var activeOpname = null;
    for (var i = 0; i < opnameList.length; i++) {
      if (String(opnameList[i].id_opname).trim() === idOpname) {
        activeOpname = opnameList[i];
        break;
      }
    }
    
    if (!activeOpname || String(activeOpname.status).toUpperCase() !== 'TERBUKA') {
      throw new Error('Sesi opname ' + idOpname + ' sudah ditutup atau tidak valid.');
    }
    
    var snapshot = {};
    try {
      snapshot = JSON.parse(activeOpname.snapshot_sistem_json);
    } catch(e) {}
    
    var qtySistem = snapshot[sku] || 0;
    var idDetail = 'OPND-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
    var timestamp = new Date().toISOString();
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.OPNAME_DETAIL);
    
    var rowValues = [
      idDetail,
      idOpname,
      sku,
      qtySistem,
      qtyHitungPcs,
      user.email,
      timestamp,
      catatan
    ];
    
    sheet.appendRow(rowValues);
    
    return {
      success: true,
      message: 'Hitungan fisik untuk ' + sku + ' (' + qtyHitungPcs + ' pcs) oleh ' + user.email + ' berhasil dicatat.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menutup Sesi Stock Opname & Membuat Transaksi PENYESUAIAN Otomatis
 * ATURAN INTI:
 * - Otoritas: admin, kepala_gudang
 * - Banyak user mengisi qty_hitung per SKU dijumlahkan
 * - Selisih (total_hitung - qty_sistem) jadi transaksi PENYESUAIAN
 */
function closeOpnameSession(opnameId) {
  var user = validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG]);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    var ss = getSpreadsheet();
    var opnameSheet = ss.getSheetByName(SHEETS.OPNAME);
    var trxSheet = ss.getSheetByName(SHEETS.TRANSAKSI);
    
    var opnameList = getSheetDataBatch(SHEETS.OPNAME);
    var targetOpname = null;
    var targetRowIndex = -1;
    
    for (var i = 0; i < opnameList.length; i++) {
      if (String(opnameList[i].id_opname).trim() === opnameId.trim()) {
        targetOpname = opnameList[i];
        targetRowIndex = opnameList[i]._rowIndex;
        break;
      }
    }
    
    if (!targetOpname) throw new Error('Sesi opname ' + opnameId + ' tidak ditemukan.');
    if (String(targetOpname.status).toUpperCase() !== 'TERBUKA') {
      throw new Error('Sesi opname ' + opnameId + ' sudah dalam status DITUTUP.');
    }
    
    // Parse snapshot sistem yang dibekukan
    var snapshot = {};
    try {
      snapshot = JSON.parse(targetOpname.snapshot_sistem_json);
    } catch (e) {
      snapshot = {};
    }
    
    // Ambil semua detail entri hitungan untuk sesi ini
    var details = getSheetDataBatch(SHEETS.OPNAME_DETAIL);
    var aggregatedCounts = {}; // sku -> sum(qty_hitung)
    
    for (var d = 0; d < details.length; d++) {
      if (String(details[d].id_opname).trim() === opnameId.trim()) {
        var s = String(details[d].sku).trim();
        var q = Number(details[d].qty_hitung_pcs) || 0;
        if (!aggregatedCounts[s]) aggregatedCounts[s] = 0;
        aggregatedCounts[s] += q;
      }
    }
    
    // Buat daftar penyesuaian untuk setiap SKU yang tercatat
    var penyesuaianList = [];
    var allSkus = Object.keys(snapshot);
    for (var k in aggregatedCounts) {
      if (allSkus.indexOf(k) === -1) allSkus.push(k);
    }
    
    var nowTimestamp = new Date().toISOString();
    
    for (var sIdx = 0; sIdx < allSkus.length; sIdx++) {
      var currSku = allSkus[sIdx];
      var qtySistem = snapshot[currSku] || 0;
      var qtyFisik = aggregatedCounts[currSku];
      
      // Jika SKU sama sekali tidak dihitung, anggap fisik = sistem (tidak ada penyesuaian)
      if (qtyFisik === undefined) continue;
      
      var selisih = qtyFisik - qtySistem;
      if (selisih !== 0) {
        var arah = selisih > 0 ? 'MASUK' : 'KELUAR';
        var absQty = Math.abs(selisih);
        var trxId = 'TRX-ADJ-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '-' + currSku;
        
        var trxRow = [
          trxId,
          nowTimestamp,
          'PENYESUAIAN',
          arah,
          currSku,
          absQty,
          'AUDIT INTERNAL DC',
          opnameId,
          'Penyesuaian Opname Fisik: ' + qtyFisik + ' vs Sistem: ' + qtySistem + ' (Selisih ' + (selisih > 0 ? '+' : '') + selisih + ' pcs)',
          user.email
        ];
        
        trxSheet.appendRow(trxRow);
        penyesuaianList.push({
          sku: currSku,
          selisih: selisih,
          arah: arah,
          qty_pcs: absQty
        });
      }
    }
    
    // Update status Opname menjadi DITUTUP
    opnameSheet.getRange(targetRowIndex, 3).setValue(nowTimestamp); // tanggal_tutup
    opnameSheet.getRange(targetRowIndex, 4).setValue('DITUTUP'); // status
    opnameSheet.getRange(targetRowIndex, 6).setValue(user.email); // ditutup_oleh
    
    return {
      success: true,
      message: 'Sesi Opname ' + opnameId + ' berhasil ditutup. ' + penyesuaianList.length + ' transaksi PENYESUAIAN telah dibuat otomatis.',
      penyesuaian: penyesuaianList
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menghitung Forecast & Saran Order Pembelian
 * ATURAN INTI:
 * - Rata-rata keluar harian dari 8 minggu terakhir (bobot lebih besar untuk minggu terbaru)
 * - Titik pesan ulang = rata-rata harian x lead time + stok pengaman (10%)
 * - Tampilkan "SKU X habis dalam N hari, saran order Y karton"
 */
function getForecastData() {
  validateRole([ROLES.ADMIN, ROLES.KEPALA_GUDANG, ROLES.KEPALA_DEPO]);
  
  var products = getSheetDataBatch(SHEETS.PRODUK);
  var transactions = getSheetDataBatch(SHEETS.TRANSAKSI);
  var stockMap = calculateStockPcsMap();
  
  var now = new Date();
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var MS_PER_WEEK = 7 * MS_PER_DAY;
  
  // Hitung pengeluaran per SKU per minggu (w=1 paling lampau, w=8 paling baru)
  // Bobot: w dari 1 s/d 8. Total bobot = 1+2+3+4+5+6+7+8 = 36.
  var totalBobot = 36;
  var skuWeeklyOut = {}; // sku -> array of 8 numbers
  
  for (var p = 0; p < products.length; p++) {
    var s = String(products[p].sku).trim();
    skuWeeklyOut[s] = [0, 0, 0, 0, 0, 0, 0, 0];
  }
  
  var cutoff8WeeksAgo = new Date(now.getTime() - 56 * MS_PER_DAY);
  
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (String(t.arah).trim().toUpperCase() !== 'KELUAR') continue;
    if (!t.timestamp) continue;
    
    var tDate = new Date(t.timestamp);
    if (tDate < cutoff8WeeksAgo || tDate > now) continue;
    
    var sku = String(t.sku).trim();
    if (!skuWeeklyOut[sku]) skuWeeklyOut[sku] = [0, 0, 0, 0, 0, 0, 0, 0];
    
    var diffMs = now.getTime() - tDate.getTime();
    var weekIndexFromNow = Math.floor(diffMs / MS_PER_WEEK); // 0 = minggu paling baru, 7 = 8 minggu lalu
    if (weekIndexFromNow >= 0 && weekIndexFromNow < 8) {
      var wIdx = 7 - weekIndexFromNow; // 0 = paling lampau, 7 = paling baru
      skuWeeklyOut[sku][wIdx] += Number(t.qty_pcs) || 0;
    }
  }
  
  var results = [];
  
  for (var j = 0; j < products.length; j++) {
    var prod = products[j];
    var isAktif = prod.aktif === true || String(prod.aktif).toLowerCase() === 'true';
    if (!isAktif) continue;
    
    var currentSku = String(prod.sku).trim();
    var pcsPerKtn = Number(prod.pcs_per_karton) || 1;
    var leadTimeHari = Number(prod.lead_time_hari) || 2;
    var currentStockPcs = stockMap[currentSku] || 0;
    var currentStockKtn = Math.floor(currentStockPcs / pcsPerKtn);
    
    var weeklyOut = skuWeeklyOut[currentSku] || [0, 0, 0, 0, 0, 0, 0, 0];
    
    // Hitung rata-rata harian tertimbang (Weighted Moving Average)
    var weightedSumPcsDaily = 0;
    for (var w = 0; w < 8; w++) {
      var weight = w + 1; // 1 s/d 8
      var dailyAverageWeekW = weeklyOut[w] / 7;
      weightedSumPcsDaily += dailyAverageWeekW * weight;
    }
    var actualWmaDailyPcs = weightedSumPcsDaily / totalBobot;
    var actualWmaDailyKtn = Number((actualWmaDailyPcs / pcsPerKtn).toFixed(1));
    
    // Cek apakah ada data acuan rata-rata penjualan yang dimasukkan oleh Super Admin
    var baselineSalesKtn = Number(prod.avg_penjualan_harian_karton) || 0;
    var rataRataKeluarHarianPcs = 0;
    var rataRataKeluarHarianKtn = 0;
    var tipeAcuan = 'AKTUAL_8_MINGGU';
    
    if (baselineSalesKtn > 0) {
      // Prioritaskan acuan rata-rata penjualan dari Super Admin sebagai patokan forecast
      rataRataKeluarHarianKtn = baselineSalesKtn;
      rataRataKeluarHarianPcs = baselineSalesKtn * pcsPerKtn;
      tipeAcuan = 'ACUAN_ADMIN';
    } else if (actualWmaDailyPcs > 0) {
      rataRataKeluarHarianPcs = actualWmaDailyPcs;
      rataRataKeluarHarianKtn = actualWmaDailyKtn;
      tipeAcuan = 'AKTUAL_8_MINGGU';
    } else {
      rataRataKeluarHarianPcs = 0;
      rataRataKeluarHarianKtn = 0;
      tipeAcuan = 'BELUM_ADA_DATA';
    }
    
    // Titik Pesan Ulang (Reorder Point) = rata-rata harian x lead time + stok pengaman (10%)
    var leadTimeDemandPcs = rataRataKeluarHarianPcs * leadTimeHari;
    var safetyStockPcs = leadTimeDemandPcs * 0.10;
    var titikPesanUlangPcs = leadTimeDemandPcs + safetyStockPcs;
    var titikPesanUlangKtn = Math.ceil(titikPesanUlangPcs / pcsPerKtn);
    
    // Sisa hari (Run-out Days)
    var sisaHari = null;
    var sisaHariFormatted = 'Aman (> 30 Hari)';
    if (rataRataKeluarHarianPcs > 0) {
      sisaHari = currentStockPcs / rataRataKeluarHarianPcs;
      sisaHariFormatted = sisaHari.toFixed(1) + ' Hari';
    } else {
      sisaHari = 999;
    }
    
    // Saran Order Karton
    var saranOrderKtn = 0;
    var statusUrgency = 'AMAN';
    
    if (currentStockPcs <= titikPesanUlangPcs) {
      // Perlu pesan agar mencapai target aman (2x lead time demand + safety stock)
      var targetStockPcs = (leadTimeDemandPcs * 2) + safetyStockPcs;
      var defisitPcs = Math.max(0, targetStockPcs - currentStockPcs);
      saranOrderKtn = Math.ceil(defisitPcs / pcsPerKtn);
      if (saranOrderKtn === 0) saranOrderKtn = Math.ceil(titikPesanUlangPcs / pcsPerKtn);
      
      if (sisaHari !== null && sisaHari <= leadTimeHari) {
        statusUrgency = 'KRITIS';
      } else {
        statusUrgency = 'REORDER';
      }
    }
    
    var teksRingkasan = currentSku + ' habis dalam ' + sisaHariFormatted + ', saran order ' + saranOrderKtn + ' karton';
    
    results.push({
      sku: currentSku,
      nama_produk: prod.nama_produk,
      kategori: prod.kategori,
      pcs_per_karton: pcsPerKtn,
      lead_time_hari: leadTimeHari,
      current_stock_pcs: currentStockPcs,
      current_stock_ktn: currentStockKtn,
      rata_rata_harian_pcs: Math.round(rataRataKeluarHarianPcs),
      rata_rata_harian_ktn: Number(rataRataKeluarHarianKtn.toFixed(1)),
      tipe_acuan: tipeAcuan,
      acuan_admin_ktn: baselineSalesKtn,
      aktual_8_minggu_ktn: actualWmaDailyKtn,
      titik_pesan_ulang_pcs: Math.round(titikPesanUlangPcs),
      titik_pesan_ulang_ktn: titikPesanUlangKtn,
      sisa_hari: sisaHari !== null ? Number(sisaHari.toFixed(1)) : 999,
      sisa_hari_formatted: sisaHariFormatted,
      saran_order_ktn: saranOrderKtn,
      status_urgency: statusUrgency,
      teks_ringkasan: teksRingkasan
    });
  }
  
  return results;
}

/**
 * SETUP(): Membuat Sheet & Header Otomatis jika Belum Ada
 */
function setup() {
  var ss = getSpreadsheet();
  
  for (var key in SHEETS) {
    var sheetName = SHEETS[key];
    var sheet = ss.getSheetByName(sheetName);
    var headers = HEADERS[key];
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Periksa apakah baris pertama sudah berisi header
    var existingValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var isHeaderSet = existingValues[0] && String(existingValues[0]).trim() !== '';
    
    if (!isHeaderSet) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#00569e')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else if (key === 'PRODUK') {
      // Pastikan kolom ke-9 avg_penjualan_harian_karton ada di header
      if (existingValues.length < headers.length || !existingValues[8]) {
        sheet.getRange(1, headers.length).setValue(headers[headers.length - 1])
          .setFontWeight('bold')
          .setBackground('#00569e')
          .setFontColor('#ffffff');
      }
    }
  }
  
  // Pastikan setidaknya ada 1 Super Admin dari user yang membuat
  var users = getSheetDataBatch(SHEETS.USERS);
  if (users.length === 0) {
    var creatorEmail = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'admin@wareflow.internal';
    var userSheet = ss.getSheetByName(SHEETS.USERS);
    userSheet.appendRow([
      creatorEmail,
      'Admin Utama DC',
      ROLES.ADMIN,
      true,
      new Date().toISOString()
    ]);
  }
  
  return 'Setup sheet berhasil. Semua struktur sheet dan header kolom telah diverifikasi.';
}

/**
 * SEED DEMO(): Mengisi 10 Produk Aqua Contoh, Pihak, Akun 3 Role, dan Transaksi Historis 8 Minggu
 */
function seedDemo() {
  setup();
  var ss = getSpreadsheet();
  
  // 1. Seed Users (3 Role)
  var userSheet = ss.getSheetByName(SHEETS.USERS);
  var currentUsers = getSheetDataBatch(SHEETS.USERS);
  var userEmails = currentUsers.map(function(u) { return String(u.email).toLowerCase(); });
  
  var demoUsers = [
    ['admin@danone-distrib.co.id', 'Andi Pratama', ROLES.ADMIN, true, new Date().toISOString()],
    ['gudang@danone-distrib.co.id', 'Bambang Sudiro', ROLES.KEPALA_GUDANG, true, new Date().toISOString()],
    ['depo@danone-distrib.co.id', 'Rian Hendrawan', ROLES.KEPALA_DEPO, true, new Date().toISOString()],
    ['pemohon@danone-distrib.co.id', 'Siti Rahmawati', ROLES.KEPALA_DEPO, false, new Date().toISOString()]
  ];
  
  for (var u = 0; u < demoUsers.length; u++) {
    if (userEmails.indexOf(demoUsers[u][0].toLowerCase()) === -1) {
      userSheet.appendRow(demoUsers[u]);
    }
  }
  
  // 2. Seed 10 Produk Aqua Resmi
  var prodSheet = ss.getSheetByName(SHEETS.PRODUK);
  var currentProds = getSheetDataBatch(SHEETS.PRODUK);
  var prodSkus = currentProds.map(function(p) { return String(p.sku).toUpperCase(); });
  
  var demoProducts = [
    ['AQ-GAL-19L', 'Aqua Galon 19 Liter', 'Galon', 1, 500, 2, 21000, true, 80],
    ['AQ-BTL-330', 'Aqua Botol Mini 330ml', 'Botol', 24, 200, 2, 42000, true, 35],
    ['AQ-BTL-600', 'Aqua Botol Sedang 600ml', 'Botol', 24, 350, 2, 51000, true, 55],
    ['AQ-BTL-1500', 'Aqua Botol Besar 1500ml', 'Botol', 12, 250, 2, 49000, true, 40],
    ['AQ-CUP-220', 'Aqua Cup Gelas 220ml', 'Cup', 48, 400, 3, 34000, true, 60],
    ['AQ-REF-380S', 'Aqua Reflections Still 380ml', 'Reflections', 24, 80, 4, 185000, true, 12],
    ['AQ-REF-380SP', 'Aqua Reflections Sparkling 380ml', 'Reflections', 24, 60, 4, 210000, true, 10],
    ['AQ-CLG-750', 'Aqua Click n Go 750ml', 'Botol', 18, 120, 3, 76000, true, 18],
    ['AQ-LIF-500', 'Aqua Life 500ml (100% Recycled)', 'Botol', 24, 150, 3, 68000, true, 25],
    ['MZ-LYC-500', 'Mizone Lychee Lemon 500ml', 'Isotonik', 12, 100, 2, 45000, true, 15]
  ];
  
  for (var p = 0; p < demoProducts.length; p++) {
    if (prodSkus.indexOf(demoProducts[p][0].toUpperCase()) === -1) {
      prodSheet.appendRow(demoProducts[p]);
    }
  }
  
  // 3. Seed Pihak
  var pihakSheet = ss.getSheetByName(SHEETS.PIHAK);
  var currentPihak = getSheetDataBatch(SHEETS.PIHAK);
  var pihakNames = currentPihak.map(function(ph) { return String(ph.nama_pihak).toLowerCase(); });
  
  var demoPihak = [
    ['PHK-001', 'Pabrik Danone Aqua Ciherang', 'PABRIK', '0251-8241001', 'Jl. Raya Ciherang No. 1, Bogor', true],
    ['PHK-002', 'Pabrik Danone Aqua Subang', 'PABRIK', '0260-412002', 'Kawasan Industri Subang Blok C', true],
    ['PHK-003', 'Depo Distribusi Bekasi Barat', 'DEPO', '021-8899101', 'Jl. KH Noer Ali No. 45, Bekasi', true],
    ['PHK-004', 'Depo Distribusi Tangerang', 'DEPO', '021-5544202', 'Jl. Daan Mogot KM 19, Tangerang', true],
    ['PHK-005', 'Agen Grosir Makmur Jaya', 'OUTLET', '0812-8888-1234', 'Pasar Induk Kramat Jati, Jakarta', true],
    ['PHK-006', 'Toko Berkah Air Segar', 'OUTLET', '0813-7777-5678', 'Jl. Raya Pulogadung No. 12', true],
    ['PHK-007', 'Armada Kanvas Rute JTM-01', 'KANVAS', '0818-0909-0011', 'Truk B 9120 UXT (Bpk Joko)', true],
    ['PHK-008', 'Armada Kanvas Rute JTM-02', 'KANVAS', '0818-0909-0022', 'Truk B 9450 UXT (Bpk Sukardi)', true]
  ];
  
  for (var h = 0; h < demoPihak.length; h++) {
    if (pihakNames.indexOf(demoPihak[h][1].toLowerCase()) === -1) {
      pihakSheet.appendRow(demoPihak[h]);
    }
  }
  
  // 4. Seed Transaksi Historis 8 Minggu (jika transaksi masih kosong atau sedikit)
  var trxSheet = ss.getSheetByName(SHEETS.TRANSAKSI);
  var currentTrx = getSheetDataBatch(SHEETS.TRANSAKSI);
  
  if (currentTrx.length < 10) {
    var now = new Date();
    var MS_PER_DAY = 24 * 60 * 60 * 1000;
    
    // Inbound awal besar 56 hari yang lalu untuk semua produk
    for (var k = 0; k < demoProducts.length; k++) {
      var prodItem = demoProducts[k];
      var skuCode = prodItem[0];
      var pcsPerK = prodItem[3];
      var initialKtn = prodItem[4] * 3; // 3x stok minimum
      var initialPcs = initialKtn * pcsPerK;
      
      var dtInitial = new Date(now.getTime() - 55 * MS_PER_DAY);
      trxSheet.appendRow([
        'TRX-INIT-' + (1000 + k),
        dtInitial.toISOString(),
        'PABRIK',
        'MASUK',
        skuCode,
        initialPcs,
        'Pabrik Danone Aqua Ciherang',
        'SJ-INIT-2025-' + (k + 1),
        'Saldo Awal Pengiriman Pabrik',
        'admin@danone-distrib.co.id'
      ]);
    }
    
    // Pola Transaksi Mingguan untuk 8 Minggu Terakhir
    // Minggu ke-1 s/d 8 (minggu ke-8 semakin baru)
    var weeklySalesFactor = [0.7, 0.8, 0.85, 0.9, 1.0, 1.1, 1.25, 1.4]; // Tren naik
    
    for (var week = 0; week < 8; week++) {
      var factor = weeklySalesFactor[week];
      var daysAgo = (7 - week) * 7 + 3; // hari dalam minggu itu
      var txDate = new Date(now.getTime() - daysAgo * MS_PER_DAY);
      
      // Pengeluaran Kanvas / Muat Armada
      for (var sp = 0; sp < demoProducts.length; sp++) {
        var pData = demoProducts[sp];
        var sCode = pData[0];
        var ppk = pData[3];
        var baseKtnWeekly = Math.floor(pData[4] * 0.4 * factor);
        var outPcs = baseKtnWeekly * ppk;
        
        var randomArmada = (sp % 2 === 0) ? 'Armada Kanvas Rute JTM-01' : 'Toko Berkah Air Segar';
        var txType = (sp % 2 === 0) ? 'KANVAS' : 'MUAT_ARMADA';
        
        trxSheet.appendRow([
          'TRX-OUT-W' + (week + 1) + '-' + sp,
          txDate.toISOString(),
          txType,
          'KELUAR',
          sCode,
          outPcs,
          randomArmada,
          'DO-2025-W' + (week + 1) + '-' + (100 + sp),
          'Distribusi Rutin Mingguan',
          'gudang@danone-distrib.co.id'
        ]);
      }
      
      // Inbound Replenishment Pabrik setiap 2 minggu
      if (week % 2 === 1) {
        for (var inp = 0; inp < 4; inp++) { // top 4 produk
          var inProd = demoProducts[inp];
          var inKtn = Math.floor(inProd[4] * 0.9);
          var inPcs = inKtn * inProd[3];
          var inDate = new Date(txDate.getTime() + 1 * MS_PER_DAY);
          
          trxSheet.appendRow([
            'TRX-IN-W' + (week + 1) + '-' + inp,
            inDate.toISOString(),
            'PABRIK',
            'MASUK',
            inProd[0],
            inPcs,
            'Pabrik Danone Aqua Ciherang',
            'SJ-DANONE-' + (week * 10 + inp),
            'Penerimaan Pasokan Pabrik',
            'admin@danone-distrib.co.id'
          ]);
        }
      }
    }
  }
  
  return 'seedDemo() berhasil dijalankan: 10 Produk Aqua, 8 Rekanan, 4 Akun Pengguna, dan transaksi 8 minggu telah dimuat.';
}
