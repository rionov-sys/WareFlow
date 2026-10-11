# WareFlow - Sistem Manajemen Gudang & Logistik Distributor Danone-AQUA

Aplikasi web manajemen gudang responsif (*mobile-first*) untuk distributor resmi Danone-AQUA, dibangun dengan arsitektur **Google Apps Script Web App (`HtmlService`)** dan **Google Sheets** sebagai basis data real-time, dilengkapi dukungan **PWA (Progressive Web App)** dan sistem ekspor multi-format (CSV, Excel `.xlsx`, PDF).

---

## 📋 Daftar Isi
1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur & Aturan Inti](#-arsitektur--aturan-inti)
3. [Struktur Sheets (Database)](#-struktur-sheets-database)
4. [Sistem Login & Manajemen Role](#-sistem-login--manajemen-role)
5. [Halaman & Modul Aplikasi](#-halaman--modul-aplikasi)
6. [Panduan Instalasi & Deploy ke Google Apps Script](#-panduan-instalasi--deploy-ke-google-apps-script)
7. [Inisialisasi Awal: `setup()` dan `seedDemo()`](#-inisialisasi-awal-setup-dan-seeddemo)
8. [Fitur Ekspor Dokumen](#-fitur-ekspor-dokumen)
9. [Pengujian Lokal (Standalone Preview)](#-pengujian-lokal-standalone-preview)

---

## 🌟 Fitur Utama
- **Mobile-First & Responsif**: Mengadopsi sistem desain *Hydraulic Precision* dengan tata letak optimal untuk smartphone operator/checker gudang (dock navigasi bawah ergonomis) dan monitor stasiun desktop (sidebar persistif).
- **Stok Real-Time Tanpa Penyimpanan Statis**: Kuantitas stok tidak pernah disimpan sebagai angka statis di database; selalu dikalkulasikan secara dinamis dari agregasi transaksi mutasi (*sum* masuk - *sum* keluar).
- **Proteksi Concurrency dengan `LockService`**: Mencegah *race condition* dan otomatis menolak transaksi keluar jika kuantitas melebihi stok fisik yang tersedia.
- **Validasi Otoritas di Sisi Server**: Pengecekan peran (*role-based access control*) diverifikasi secara ketat pada setiap pemanggilan fungsi backend `Code.gs`, bukan hanya manipulasi tampilan antarmuka.
- **Stock Opname Multi-User**: Pembekuan stok sistem saat pembukaan sesi, pengisian hitungan fisik oleh banyak checker sekaligus dengan akumulasi otomatis per SKU, dan penutupan sesi yang otomatis menghasilkan transaksi `PENYESUAIAN`.
- **Forecast Pengadaan (WMA 8-Minggu)**: Proyeksi kehabisan stok (*run-out days*) dan saran kuantitas order pembelian ke pabrik Danone menggunakan rata-rata keluar harian berbobot (*Weighted Moving Average*) dengan bobot lebih tinggi pada minggu terkini + *safety stock* 10%.
- **Ekspor Dokumen Fleksibel**: Tombol ekspor instan di tabel Riwayat, Katalog Stok, dan Forecast ke format CSV, Excel `.xlsx` (via SheetJS), dan PDF siap cetak (via jsPDF + AutoTable).
- **Progressive Web App (PWA)**: Dilengkapi `manifest.json` dan `sw.js` sehingga dapat diinstal (*Add to Home Screen*) pada perangkat Android/iOS handheld scanner operator.

---

## ⚙️ Arsitektur & Aturan Inti

1. **Satuan Kuantitas**:
   - Seluruh kuantitas transaksi di database disimpan dalam satuan **Pcs**.
   - Pada antarmuka pengguna, kuantitas ditampilkan dalam kombinasi **Karton + Pcs** berdasarkan atribut `pcs_per_karton` masing-masing produk (contoh: *1.240 Karton + 12 Pcs* atau *1.240 Galon/Unit* untuk Aqua Galon 19L).
2. **Kategori & Jenis Transaksi**:
   - **Masuk (`MASUK`)**:
     - `PABRIK`: Penerimaan pasokan truk tronton dari pabrik (Ciherang / Subang).
     - `TRANSFER_MASUK`: Penerimaan mutasi stok dari depo/cabang lain (1 baris per kejadian tanpa konfirmasi terima terpisah).
     - `RETUR_ARMADA`: Pengembalian galon kosong, klaim cacat kemasan, atau sisa muatan armada.
   - **Keluar (`KELUAR`)**:
     - `TRANSFER_KELUAR`: Pengiriman transfer ke cabang depo lain (1 baris per kejadian).
     - `KANVAS`: Pemuatan air mineral ke armada kanvas rute harian.
     - `MUAT_ARMADA`: Pemuatan pesanan langsung ke truk pelanggan grosir/agen.
   - **Otomatis**:
     - `PENYESUAIAN`: Dibuat otomatis saat penutupan sesi Stock Opname (selisih positif tercatat sebagai Masuk; selisih negatif tercatat sebagai Keluar).
3. **Pencegahan Defisit Stok**:
   - Setiap transaksi keluar mengunci eksekusi via `LockService.getScriptLock()`.
   - Backend membaca transaksi, mengkalkulasi saldo stok terkini SKU terkait, dan melempar eksepsi penolakan jika kuantitas keluar melebihi stok yang ada di gudang.

---

## 📊 Struktur Sheets (Database)

Fungsi `setup()` akan secara otomatis membuat dan memformat 6 sheet berikut di Google Sheets:

### 1. `Users`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `email` | String | Email akun Google pengguna (`Session.getActiveUser().getEmail()`) |
| `nama` | String | Nama lengkap operator / petugas |
| `role` | String | Peran: `admin`, `kepala_gudang`, atau `kepala_depo` |
| `aktif` | Boolean | Status persetujuan login (`TRUE` = aktif, `FALSE` = menunggu persetujuan) |
| `created_at` | ISO String | Waktu pembuatan akun / permohonan akses |

### 2. `Produk`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `sku` | String | Kode unik SKU (contoh: `AQ-GAL-19L`, `AQ-BTL-600`) |
| `nama_produk` | String | Nama resmi produk Danone-AQUA |
| `kategori` | String | Kategori: `Galon`, `Botol`, `Cup`, `Reflections`, `Isotonik` |
| `pcs_per_karton` | Number | Faktor konversi (contoh: 1 untuk galon, 24 untuk botol 600ml, 48 untuk cup) |
| `stok_minimum_karton` | Number | Ambang batas aman replenishment (dalam karton) |
| `lead_time_hari` | Number | Estimasi waktu tiba kiriman pabrik (standar: 2-3 hari) |
| `harga_karton` | Number | Estimasi nilai per karton |
| `aktif` | Boolean | Status keaktifan produk |
| `avg_penjualan_harian_karton` | Number | Acuan rata-rata penjualan harian (karton/hari) untuk kalkulasi forecast |

### 3. `Pihak`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id_pihak` | String | ID identifikasi rekanan (contoh: `PHK-001`) |
| `nama_pihak` | String | Nama pabrik, depo cabang, toko grosir, atau armada |
| `jenis` | String | Klasifikasi: `PABRIK`, `DEPO`, `OUTLET`, `KANVAS`, `ARMADA` |
| `kontak` | String | Nomor telepon / PIC |
| `alamat` | String | Alamat depo / rute armada / nomor plat truk |
| `aktif` | Boolean | Status rekanan aktif |

### 4. `Transaksi`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id_transaksi` | String | Nomor unik tiket transaksi (`TRX-YYYYMMDD-XXXX`) |
| `timestamp` | ISO String | Waktu pencatatan mutasi fisik |
| `jenis` | String | `PABRIK`, `TRANSFER_MASUK`, `RETUR_ARMADA`, `TRANSFER_KELUAR`, `KANVAS`, `MUAT_ARMADA`, `PENYESUAIAN` |
| `arah` | String | `MASUK` atau `KELUAR` |
| `sku` | String | SKU produk yang dimutasikan |
| `qty_pcs` | Number | Jumlah fisik dalam satuan Pcs |
| `pihak` | String | Nama asal atau tujuan barang |
| `no_dokumen` | String | Nomor Surat Jalan (SJ), Delivery Order (DO), atau ID Opname |
| `catatan` | String | Keterangan tambahan (nomor plat armada, nama supir, dll) |
| `user_email` | String | Email petugas yang melakukan transaksi |

### 5. `Opname`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id_opname` | String | ID audit opname (`OPN-YYYYMMDD-XXXX`) |
| `tanggal_buka` | ISO String | Waktu sesi dibuka & stok sistem dibekukan |
| `tanggal_tutup` | ISO String | Waktu sesi ditutup (kosong jika sedang berlangsung) |
| `status` | String | `TERBUKA` atau `DITUTUP` |
| `dibuka_oleh` | String | Email petugas yang membuka sesi |
| `ditutup_oleh` | String | Email petugas yang menutup sesi |
| `catatan` | String | Keterangan sesi audit |
| `snapshot_sistem_json` | JSON String | Cadangan snapshot kuantitas pcs sistem per SKU saat sesi dibuka |

### 6. `OpnameDetail`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id_detail` | String | ID baris hitungan (`OPND-YYYYMMDD-XXXX`) |
| `id_opname` | String | Relasi ke ID Opname aktif |
| `sku` | String | SKU produk yang dihitung |
| `qty_sistem_pcs` | Number | Stok sistem saat pembukaan sesi |
| `qty_hitung_pcs` | Number | Jumlah fisik yang dihitung pada entri ini (dalam pcs) |
| `user_email` | String | Petugas yang memasukkan hitungan fisik |
| `timestamp` | ISO String | Waktu entri hitungan |
| `catatan` | String | Catatan zona rak / keterangan fisik |

---

## 🔐 Sistem Login & Manajemen Role

Aplikasi memanfaatkan Google Single Sign-On bawaan:
```javascript
Session.getActiveUser().getEmail();
```

### Mekanisme Pengajuan Akses:
1. Jika email Google pengguna **tidak ditemukan** di sheet `Users`:
   - Aplikasi otomatis menampilkan halaman **"Ajukan Akses"**.
   - Pengguna mengisi nama lengkap dan catatan penugasan.
   - Sistem menambahkan baris baru pada sheet `Users` dengan atribut `aktif = FALSE`.
2. Admin dapat melihat daftar pemohon akses pada menu **Kelola Admin &rarr; Users** dan menekan tombol **"Aktifkan / Setujui"**.

### Matriks Otoritas Peran (Role-Based Access Control):
| Modul / Fungsi | `admin` | `kepala_gudang` | `kepala_depo` |
| :--- | :---: | :---: | :---: |
| Lihat Dashboard & Grafik Throughput | ✅ | ✅ | ✅ |
| Lihat Katalog Produk & Stok Real-Time | ✅ | ✅ | ✅ |
| Transaksi `PABRIK` & `TRANSFER_MASUK` | ✅ | ✅ | ❌ |
| Transaksi `TRANSFER_KELUAR` | ✅ | ✅ | ❌ |
| Transaksi `KANVAS`, `MUAT_ARMADA`, `RETUR_ARMADA` | ✅ | ✅ | ✅ |
| Buka Sesi Stock Opname | ✅ | ✅ | ❌ |
| Kirim Hitungan Fisik Stock Opname | ✅ | ✅ | ✅ |
| Tutup Sesi Opname (Generate Penyesuaian) | ✅ | ✅ | ❌ |
| Lihat Forecast & Rekomendasi Reorder | ✅ | ✅ | ✅ |
| Inisialisasi Saldo Stok Awal & Acuan Forecast | ✅ | ❌ | ❌ |
| Kelola Master (Users, Produk, Pihak) | ✅ | ❌ | ❌ |

---

## 📱 Halaman & Modul Aplikasi

1. **Dashboard Gudang (`view-dashboard`)**:
   - Kartu KPI: Total stok fisik (Karton + Pcs lepas), Jumlah SKU di bawah safety stock, dan status audit opname.
   - Peringatan banner interaktif untuk SKU kritis.
   - Grafik batang interaktif throughput masuk vs keluar selama 30 hari terakhir.
   - Tabel 10 transaksi mutasi terbaru dan daftar cepat SKU yang mendekati kehabisan.
2. **Katalog Produk & Stok (`view-products`)**:
   - Daftar kartu produk responsif dengan penanda status warna (*Safe*, *Warning*, *Critical*).
   - Filter cepat berdasarkan kategori (*Galon*, *Botol*, *Cup*, *Reflections*, dll) dan status stok.
   - Pencarian cerdas (SKU, nama produk).
   - Modal tambah/edit master SKU (khusus Admin).
3. **Input Transaksi (`view-transaction`)**:
   - Tab beralih ergonomis: **BARANG MASUK** vs **BARANG KELUAR**.
   - Pratinjau langsung sisa stok gudang saat SKU dipilih.
   - Kalkulator terintegrasi: input kuantitas karton + pcs lepasan langsung dijumlahkan ke total pcs fisik.
   - Validasi defisit instan sebelum formulir dikirim.
4. **Riwayat Transaksi (`view-history`)**:
   - Tabel mutasi detail dengan pencarian multi-parameter (No. Dokumen, SKU, Pihak, Petugas).
   - Filter rentang tanggal fleksibel (*Hari Ini*, *7 Hari*, *Bulan Ini*, atau kalender kustom).
   - Tombol ekspor data tersaring ke CSV, Excel `.xlsx`, dan PDF resmi.
5. **Stock Opname (`view-opname`)**:
   - Alur audit fisik terstruktur: Buka Sesi &rarr; Input Hitungan Multi-User &rarr; Konsolidasi &rarr; Tutup Sesi.
   - Penjumlahan akumulatif otomatis untuk SKU yang sama dari berbagai petugas checker.
   - Matriks perbandingan: Stok Sistem (beku) vs Total Hitung Fisik vs Varian Selisih.
   - Otomatisasi pembuatan tiket `PENYESUAIAN` ke ledger transaksi saat penutupan sesi.
6. **Forecast & Saran Order (`view-forecast`)**:
   - Perhitungan laju pengeluaran harian memprioritaskan parameter acuan admin (`avg_penjualan_harian_karton`) atau fallback otomatis ke *Weighted Moving Average* (WMA) 8 minggu terakhir ($w \in \{1..8\}$) jika data transaksi mencukupi.
   - Titik Pesan Ulang (*Reorder Point* / ROP):
     $$\text{ROP} = (\text{Laju Harian} \times \text{Lead Time}) + 10\% \text{ Safety Stock}$$
   - Estimasi sisa hari kehabisan stok (*Run-out Days*) dan rekomendasi order pembelian dalam satuan karton.
   - Tombol pintas khusus Super Admin untuk langsung menyesuaikan baseline stok & laju penjualan.
7. **Kelola Admin (`view-admin`)**:
   - Tab **Users**: Tambah operator, ubah peran, dan aktivasi akun pemohon.
   - Tab **Produk**: Master SKU, rasio isi karton, harga karton, ambang batas minimum, dan acuan rata-rata jual.
   - Tab **Pihak**: Direktori pabrik Danone, depo satelit, dan armada distribusi.
   - Tab **Inisialisasi Stok & Forecast**:
     - Pengaturan saldo awal fisik gudang (Karton + Pcs lepasan) untuk mengkalibrasi sistem saat implementasi pertama kali.
     - Sistem secara cerdas menghitung selisih matematis (`targetPcs - currentPcs`) dan membuat transaksi audit `PENYESUAIAN` resmi (`SALDO AWAL GUDANG`) tanpa melanggar prinsip keutuhan ledger transaksi.
     - Penentuan angka rata-rata penjualan harian (Karton/Hari) per SKU yang menjadi acuan langsung pada formula kalkulasi ROP dan saran order pembelian.
     - Tombol *Salin Stok Saat Ini*, kalkulasi delta interaktif real-time, serta fitur simpan per baris maupun simpan massal (*batch save*).

---

## 🚀 Panduan Instalasi & Deploy ke Google Apps Script

### Langkah 1: Buat Google Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet, misalnya: `WareFlow - Database Gudang DC Cakung`.

### Langkah 2: Buka Apps Script Editor
1. Pada menu Google Sheets, klik **Extensions (Ekstensi)** &rarr; **Apps Script**.
2. Beri nama proyek Apps Script: `WareFlow-App`.

### Langkah 3: Masukkan Kode Aplikasi
1. Buka file `Code.gs` di editor Apps Script, hapus kode bawaan, dan salin seluruh isi dari file [`Code.gs`](file:///d:/DATA%20PRIBADI%20RIO/PROJECT-VIBE%20CODING/PRODUCTION/WareFlow/Code.gs) di repositori ini.
2. Buat file HTML baru:
   - Klik tombol **+** di panel sebelah kiri &rarr; pilih **HTML**.
   - Beri nama file: `index` (Apps Script akan menambahkan ekstensi `.html`).
   - Salin seluruh isi dari file [`index.html`](file:///d:/DATA%20PRIBADI%20RIO/PROJECT-VIBE%20CODING/PRODUCTION/WareFlow/index.html).
3. Simpan proyek dengan menekan tombol **Save** (`Ctrl + S`).

### Langkah 4: Jalankan Inisialisasi Database
1. Pada toolbar atas editor Apps Script, pilih fungsi **`setup`** dari daftar dropdown fungsi.
2. Klik tombol **Run (Jalankan)**.
3. Berikan izin otorisasi (*Review Permissions*) akun Google Anda.
4. Fungsi `setup()` akan membuat seluruh sheet dan menambahkan email akun Anda sebagai **Super Admin**.
5. *(Opsional untuk pengujian)*: Pilih fungsi **`seedDemo`** lalu klik **Run** untuk memuat 10 produk Aqua, rekanan, dan data transaksi historis 8 minggu.

### Langkah 5: Deploy sebagai Web App
1. Klik tombol biru **Deploy** di pojok kanan atas &rarr; pilih **New deployment**.
2. Klik ikon gerigi di sebelah kiri *Select type* &rarr; pilih **Web app**.
3. Konfigurasikan:
   - **Description**: `WareFlow Production v1.0`
   - **Execute as**: **User accessing the web app** (atau *Me* jika dalam domain Google Workspace yang sama)
   - **Who has access**: **Anyone with Google Account** (atau organisasi Anda)
4. Klik **Deploy**.
5. Salin tautan **Web App URL** yang diberikan. Buka di browser atau bagikan ke tim operasional gudang!

---

## 🧪 Inisialisasi Awal: `setup()` dan `seedDemo()`

- **`setup()`**:
  Membuat 6 sheet utama jika belum tersedia, mengatur baris header tebal dengan warna tema korporat biru Danone, membekukan baris pertama (*frozen header*), dan mendaftarkan pembuat sebagai Admin.
- **`seedDemo()`**:
  Mengisi data simulasi lengkap yang mencakup:
  - **4 Akun Contoh**: Admin (`admin@danone-distrib.co.id`), Kepala Gudang (`gudang@danone-distrib.co.id`), Kepala Depo (`depo@danone-distrib.co.id`), dan 1 pemohon belum aktif.
  - **10 Produk Resmi Aqua**: Galon 19L, Botol 330ml, 600ml, 1500ml, Cup 220ml, Reflections Still/Sparkling 380ml, Click n Go 750ml, Aqua Life 500ml, Mizone 500ml.
  - **6 Rekanan Pihak**: Pabrik Ciherang, Pabrik Subang, Depo Bekasi, Agen Grosir Makmur Jaya, Toko Berkah Air, Armada Kanvas.
  - **Transaksi Mutasi 8 Minggu**: Saldo awal masuk dan mutasi keluar mingguan dengan tren realistis untuk menguji modul forecast dan grafik.

---

## 📄 Fitur Ekspor Dokumen

Aplikasi mendukung 3 format ekspor yang diproses langsung di sisi klien (*client-side*) tanpa membebani kuota eksekusi Google Apps Script:
1. **CSV**: Dihasilkan dengan *Blob generator* JavaScript murni untuk integrasi data mentah.
2. **Excel (`.xlsx`)**: Dihasilkan via pustaka [SheetJS (xlsx.full.min.js)](https://sheetjs.com) dengan header rapi dan nama sheet terdefinisi.
3. **PDF**: Dihasilkan via [jsPDF](https://parall.ax/products/jspdf) dan [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) dengan kop dokumen resmi WareFlow, stempel waktu pencetakan, dan penomoran halaman otomatis.

---

## 💻 Pengujian Lokal (Standalone Preview)

Aplikasi telah dilengkapi **Dual-Bridge Architecture**:
- Jika dibuka di dalam Google Apps Script, aplikasi memanggil `google.script.run`.
- Jika dibuka di browser lokal (misal: `http://localhost:3000` atau via `file://`), aplikasi otomatis mendeteksi ketiadaan objek `google.script` dan beralih ke **Mock LocalStorage Backend** yang disematkan langsung di dalam `index.html`.

Untuk menjalankan server pratinjau lokal:
```bash
node server.js
```
Lalu buka peramban Anda di:
```
http://localhost:3000
```
Seluruh fungsionalitas (input transaksi, stock opname, ubah produk, ekspor Excel/PDF/CSV, filter riwayat, dan grafik) dapat diuji secara penuh!
