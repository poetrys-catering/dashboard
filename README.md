# Poetry's Catering - Web Apps Management System

Sistem Manajemen Operasional & Invoice terpadu untuk **Poetry's Catering** yang dirancang dengan antarmuka modern (Glassmorphic Dark & Light Theme) dan terintegrasi langsung dengan database **Google Sheets** menggunakan Google Apps Script API.

---

## 🌟 Fitur Utama

### 1. Sistem Invoice & Riwayat Pembayaran Bertahap
*   **Buat & Edit Invoice**: Form pembuatan invoice dinamis dengan fitur autocomplete pilihan menu, diskon (persen/nominal), biaya tambahan, dan kalkulasi otomatis.
*   **Pembayaran Bertahap (Cicilan)**: Pengguna dapat mencatat beberapa kali pembayaran (cicilan) per invoice dengan tanggal, metode pembayaran (BCA, Mandiri, Cash, dll.), serta catatan tambahan.
*   **Sisa Tagihan (Piutang)**: Kalkulasi real-time sisa tagihan kustomer berdasarkan total cicilan yang telah dibayar.
*   **Dua Langkah Import Excel**: Pengamanan proses import data invoice masal menggunakan pop-up modal interaktif (Pilih File -> Review -> Mulai Import).

### 2. PDF Invoice & Integrasi WhatsApp
*   **Ekspor PDF Instan**: Print template PDF invoice berkualitas tinggi, rapi, lengkap dengan tanda tangan digital dan riwayat cicilan pembayaran di bagian bawah.
*   **WhatsApp Reminders**: Kirim link tagihan invoice interaktif kepada pelanggan secara langsung melalui WhatsApp hanya dalam satu klik.
*   **Short Link Internal**: Mengubah tautan muatan invoice yang panjang menjadi tautan ringkas dinamis menggunakan Apps Script (`?s=Abc123`) untuk integrasi kirim pesan yang lebih rapi.

### 3. Master Menu & Penjadwalan (Schedules)
*   **Manajemen Produk**: Tambah, edit, hapus produk katering dengan format harga Rupiah otomatis saat mengetik.
*   **Penyaringan Data**: Pencarian cepat, filter kota/wilayah pengantaran (Serang, Tangerang, Cilegon, dll.), dan filter status pesanan.
*   **Kalender Pengiriman (Schedules)**: Pencatatan jadwal pengantaran katering harian berdasarkan pesanan pelanggan.

---

## 🛠️ Stack Teknologi
*   **Frontend UI**: Single Page Application (SPA) berbasis Vanilla HTML5, CSS3 Custom Properties (Gold & Dark Mode), dan Vanilla JavaScript (ES6+).
*   **Ikonografi**: [Lucide Icons](https://lucide.dev/) untuk render ikon UI modern.
*   **Library Parsing**: [SheetJS (XLSX.js)](https://sheetjs.com/) untuk ekspor/impor data Excel langsung di browser.
*   **Database & API Backend**: Google Sheets API yang diekspos melalui Google Apps Script (`google_apps_script.js`).

---

## 📋 Struktur Kolom Database (Google Sheets)

Pastikan spreadsheet Anda di Google Sheets memiliki tab sheet dengan nama dan kepala kolom (headers) berikut agar sinkronisasi data berjalan lancar:

### Tab 1: `Invoices`
Headers (Baris 1):
`invoiceNumber`, `customerName`, `customerPhone`, `cateringDate`, `cateringLocation`, `items`, `totalAmount`, `paidAmount`, `paymentHistory`, `status`, `notes`, `createdAt`, `discount`, `discountType`, `additionalFee`

> [!NOTE]
> Kolom **`paymentHistory`** akan diisi otomatis oleh aplikasi berupa teks JSON terenkripsi yang berisi riwayat cicilan pelanggan.

### Tab 2: `Menus`
Headers (Baris 1):
`id`, `name`, `price`, `unit`, `description`, `status`

### Tab 3: `Schedules`
Headers (Baris 1):
`id`, `invoiceNumber`, `customerName`, `deliveryDate`, `deliveryTime`, `location`, `status`, `notes`

### Tab 4: `Users`
Headers (Baris 1):
`id`, `username`, `password`, `role`, `status`

---

## 🚀 Panduan Setup & Deploy

### Langkah 1: Deploy Google Apps Script
1.  Buka [Google Sheets](https://sheets.google.com/) Anda dan buat spreadsheet baru.
2.  Buat tab sheet: `Invoices`, `Menus`, `Schedules`, dan `Users` dengan header masing-masing seperti tabel di atas.
3.  Klik **Ekstensi** -> **Apps Script**.
4.  Salin seluruh kode dari berkas [`google_apps_script.js`](./google_apps_script.js) ke editor Apps Script Anda.
5.  Klik **Terapkan (Deploy)** -> **Penerapan Baru (New Deployment)**.
6.  Pilih jenis: **Aplikasi Web (Web App)**.
7.  Setel hak akses: *"Siapa saja yang memiliki link"* (Anyone).
8.  Salin **URL Web App** yang dihasilkan (contoh: `https://script.google.com/macros/s/AKfy.../exec`).

### Langkah 2: Hubungkan Aplikasi Website
1.  Buka file [`app.js`](./app.js).
2.  Cari bagian `DEFAULT_API_URL` di baris atas, lalu ganti dengan **URL Web App** yang Anda salin dari langkah sebelumnya:
    ```javascript
    DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfy.../exec',
    ```
3.  Simpan file.

### Langkah 3: Deploy ke GitHub Pages (Hosting Gratis)
1.  Unggah (Push) seluruh berkas project Anda ke repositori GitHub.
2.  Buka halaman **Settings** repositori Anda di GitHub.
3.  Pilih menu **Pages** di kolom menu sebelah kiri.
4.  Pada bagian **Build and deployment**, setel source-nya ke cabang `main` / `master` dan folder `/ (root)`.
5.  Klik **Save**. Website manajemen katering Anda akan online secara otomatis dalam 1-2 menit!
