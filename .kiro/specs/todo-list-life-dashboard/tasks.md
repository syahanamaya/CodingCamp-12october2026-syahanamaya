# Implementation Plan: To-Do List Life Dashboard

## Overview

Implementasi dashboard web satu-halaman menggunakan HTML, CSS, dan Vanilla JavaScript. Setiap widget (GreetingWidget, FocusTimer, TodoList, QuickLinks) dibangun secara modular dengan Module Pattern, kemudian diwiring bersama oleh `App.init()`. Data persisten disimpan via Local Storage menggunakan modul `Storage` terpusat.

---

## Tasks

- [x] 1. Buat struktur file proyek dan kerangka HTML
  - Buat `index.html` dengan struktur HTML5 semantik: header untuk Greeting/Clock, section untuk FocusTimer, section untuk TodoList, section untuk QuickLinks
  - Buat folder `css/` dengan file kosong `style.css`
  - Buat folder `js/` dengan file kosong `app.js`
  - Tambahkan `<link rel="stylesheet" href="css/style.css">` dan `<script src="js/app.js" defer>` ke `index.html`
  - Sertakan placeholder DOM element dengan `id` yang konsisten untuk setiap widget (clock, date, greeting, timer-display, dll.)
  - _Requirements: 5.1, 5.2_

- [x] 2. Implementasi modul Storage
  - [x] 2.1 Tulis modul `Storage` di `js/app.js`
    - Implementasi `Storage.isAvailable()` dengan try/catch test-write ke localStorage
    - Implementasi `Storage.save(key, data)` dengan `JSON.stringify` + `localStorage.setItem`, tangkap `SecurityError` dan `QuotaExceededError`
    - Implementasi `Storage.load(key)` dengan `localStorage.getItem` + `JSON.parse`, kembalikan `null` jika gagal
    - Definisikan `Storage.KEYS = { TASKS: 'dashboard_tasks', LINKS: 'dashboard_links' }`
    - _Requirements: 3.9, 3.10, 3.11, 4.6, 4.7, 4.8, 5.4, 5.6_

  - [ ]* 2.2 Tulis property test untuk persistensi tugas round-trip
    - **Property 7: Persistensi tugas round-trip (serialize → deserialize)**
    - **Validates: Requirements 3.9, 3.10**

  - [ ]* 2.3 Tulis property test untuk persistensi link round-trip
    - **Property 9: Persistensi link round-trip (serialize → deserialize)**
    - **Validates: Requirements 4.6, 4.7**

- [x] 3. Implementasi GreetingWidget
  - [x] 3.1 Tulis modul `GreetingWidget` di `js/app.js`
    - Implementasi `GreetingWidget.formatTime(date)` → string `HH:MM:SS` dengan zero-padding
    - Implementasi `GreetingWidget.formatDate(date)` → string `"Kamis, 16 Oktober 2026"` menggunakan array nama hari dan nama bulan Bahasa Indonesia
    - Implementasi `GreetingWidget.getGreeting(hour)` → teks salam berdasarkan rentang jam (05–11 Pagi, 12–17 Siang, 18–20 Sore, 21–04 Malam)
    - Implementasi `GreetingWidget.update()` yang memanggil `new Date()`, update DOM clock/date/greeting, dan handle error `isNaN` (tampilkan `"--:--:--"` dan `"Halo"`)
    - Implementasi `GreetingWidget.init()` yang memanggil `update()` sekali lalu `setInterval(update, 1000)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.2 Tulis property test untuk greeting sesuai rentang jam
    - **Property 1: Greeting sesuai rentang jam**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**

  - [ ]* 3.3 Tulis property test untuk format waktu selalu valid
    - **Property 2: Format waktu selalu valid**
    - **Validates: Requirements 1.1**

- [x] 4. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanya pengguna jika ada pertanyaan.

- [x] 5. Implementasi FocusTimer
  - [x] 5.1 Tulis modul `FocusTimer` di `js/app.js`
    - Definisikan `FocusTimer.DURATION_SECONDS = 1500` dan state awal `{ remaining: 1500, isRunning: false, intervalId: null }`
    - Implementasi `FocusTimer.formatTime(seconds)` → string `"MM:SS"` dengan zero-padding
    - Implementasi `FocusTimer.render()` yang update DOM tampilan waktu, enable/disable tombol Start dan Stop sesuai state `isRunning`
    - Implementasi `FocusTimer.tick()` yang kurangi `remaining` sebesar 1 dan panggil `onComplete()` jika `remaining === 0`
    - Implementasi `FocusTimer.start()`, `FocusTimer.stop()`, `FocusTimer.reset()` sesuai state machine (idle ↔ running → completed)
    - Implementasi `FocusTimer.onComplete()` yang hentikan timer, tampilkan indikator visual "Sesi Selesai!", dan mainkan `AudioContext` beep (dengan fallback jika tidak didukung)
    - Implementasi `FocusTimer.init()` yang render awal dan pasang event listener pada tombol Start, Stop, Reset
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 5.2 Tulis property test untuk countdown FocusTimer monoton menurun
    - **Property 11: FocusTimer countdown selalu menurun monoton**
    - **Validates: Requirements 2.3, 2.8**

  - [ ]* 5.3 Tulis property test untuk FocusTimer reset ke durasi awal
    - **Property 12: FocusTimer reset selalu mengembalikan ke durasi awal**
    - **Validates: Requirements 2.6, 2.7**

- [x] 6. Implementasi TodoList
  - [x] 6.1 Tulis struktur data dan fungsi bantu TodoList di `js/app.js`
    - Definisikan `TodoList.tasks = []` dan `TodoList.editingId = null`
    - Implementasi pembuatan ID unik menggunakan `crypto.randomUUID()` dengan fallback ke `Date.now() + Math.random()`
    - Implementasi `TodoList.save()` dan `TodoList.load()` yang memanggil `Storage.save/load` dengan key `TASKS`
    - _Requirements: 3.9, 3.10, 3.11_

  - [x] 6.2 Implementasi `TodoList.render()` dengan event delegation
    - Bangun ulang DOM `<ul>` dengan satu `<li>` per task; setiap item memiliki tombol centang, teks task, tombol edit, tombol hapus
    - Gunakan `data-id` dan `data-action` attribute pada setiap tombol
    - Pasang satu event listener pada container `<ul>` untuk menangkap semua klik via event delegation
    - Tampilkan teks dicoret (CSS `text-decoration: line-through`) untuk task dengan `done: true`
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 6.3 Implementasi CRUD TodoList (add, edit, toggle, delete)
    - Implementasi `TodoList.addTask(text)`: validasi `trim()` (1–500 karakter), buat Task baru dengan `done: false`, push ke array, panggil `save()` dan `render()`; tampilkan indikator error inline jika input tidak valid
    - Implementasi `TodoList.editTask(id)`: set `editingId`, render ulang item dalam mode edit (input field + tombol Simpan + tombol Batal)
    - Implementasi `TodoList.saveEdit(id, text)`: validasi teks baru, update `task.text`, set `editingId = null`, panggil `save()` dan `render()`
    - Implementasi `TodoList.cancelEdit(id)`: set `editingId = null`, panggil `render()`
    - Implementasi `TodoList.toggleTask(id)`: balik `task.done`, panggil `save()` dan `render()`
    - Implementasi `TodoList.deleteTask(id)`: filter array, panggil `save()` dan `render()`
    - Tangani keydown Enter (simpan) dan Escape (batal) pada input edit
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 6.4 Implementasi `TodoList.init()`
    - Panggil `TodoList.load()`, render awal, pasang event listener pada tombol "Tambah" dan input field (keydown Enter)
    - _Requirements: 3.10_

  - [ ]* 6.5 Tulis property test untuk penambahan tugas valid
    - **Property 3: Penambahan tugas menambah panjang daftar**
    - **Validates: Requirements 3.1**

  - [ ]* 6.6 Tulis property test untuk penolakan input tidak valid
    - **Property 4: Input tidak valid tidak mengubah daftar tugas**
    - **Validates: Requirements 3.2**

  - [ ]* 6.7 Tulis property test untuk toggle selesai round-trip
    - **Property 5: Toggle selesai bersifat idempoten ganda**
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 6.8 Tulis property test untuk penghapusan tugas
    - **Property 6: Penghapusan tugas mengurangi panjang daftar**
    - **Validates: Requirements 3.8**

- [x] 7. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanya pengguna jika ada pertanyaan.

- [x] 8. Implementasi QuickLinks
  - [x] 8.1 Tulis struktur data dan fungsi bantu QuickLinks di `js/app.js`
    - Definisikan `QuickLinks.links = []`
    - Implementasi `QuickLinks.normalizeUrl(url)`: tambahkan `"https://"` jika URL tidak diawali `"http://"` atau `"https://"`
    - Implementasi `QuickLinks.validateUrl(url)`: kembalikan `true` jika URL setelah normalisasi diawali `http://` atau `https://`
    - Implementasi `QuickLinks.save()` dan `QuickLinks.load()` yang memanggil `Storage.save/load` dengan key `LINKS`
    - _Requirements: 4.3, 4.6, 4.7, 4.8_

  - [x] 8.2 Implementasi `QuickLinks.render()` dan event delegation
    - Bangun ulang DOM daftar kartu/tombol link; setiap kartu memiliki nama tampilan, tombol buka (target="_blank" + rel="noopener noreferrer"), dan tombol hapus
    - Pasang satu event listener pada container untuk klik hapus via event delegation menggunakan `data-id`
    - _Requirements: 4.4, 4.5_

  - [x] 8.3 Implementasi `QuickLinks.addLink(name, url)` dan `QuickLinks.deleteLink(id)`
    - `addLink`: validasi nama (1–50 karakter setelah trim) dan URL (tidak kosong), normalisasi URL, validasi hasil normalisasi, buat Link baru, panggil `save()` dan `render()`; tampilkan indikator error inline pada field yang salah
    - `deleteLink`: filter array, panggil `save()` dan `render()`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 8.4 Implementasi `QuickLinks.init()`
    - Panggil `QuickLinks.load()`, render awal, pasang event listener pada tombol "Tambah Link"
    - _Requirements: 4.7_

  - [ ]* 8.5 Tulis property test untuk normalisasi URL
    - **Property 8: Normalisasi URL selalu menghasilkan URL dengan protokol**
    - **Validates: Requirements 4.3**

  - [ ]* 8.6 Tulis property test untuk penghapusan link
    - **Property 10: Penghapusan link mengurangi panjang daftar**
    - **Validates: Requirements 4.5**

- [x] 9. Wiring: Buat `App.init()` dan inisialisasi semua modul
  - [x] 9.1 Tulis `App.init()` di `js/app.js`
    - Implementasi `App.init()` yang memanggil `Storage.isAvailable()` terlebih dahulu; jika `false`, tampilkan banner peringatan non-blocking satu kali di DOM
    - Panggil `GreetingWidget.init()`, `FocusTimer.init()`, `TodoList.init()`, `QuickLinks.init()` secara berurutan
    - Pasang event listener `DOMContentLoaded` yang memanggil `App.init()`
    - _Requirements: 5.2, 5.3, 5.6_

- [x] 10. Implementasi CSS dan responsivitas
  - [x] 10.1 Tulis `css/style.css` untuk layout dan styling semua widget
    - Terapkan CSS Grid atau Flexbox untuk layout dashboard yang menampilkan keempat widget
    - Implementasi responsive breakpoint: mobile (320px–767px) widget ditumpuk vertikal, desktop (768px+) widget ditampilkan dalam grid
    - Styling indikator visual: teks dicoret untuk task selesai, error state (border merah) untuk input tidak valid, indikator "Sesi Selesai!" untuk FocusTimer
    - Pastikan tidak ada horizontal scrolling pada lebar layar 320px–1920px
    - _Requirements: 5.5_

- [x] 11. Checkpoint final — Pastikan semua test lulus
  - Pastikan semua test lulus dan seluruh widget berfungsi terintegrasi. Tanya pengguna jika ada pertanyaan.

---

## Notes

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk pengembangan MVP yang lebih cepat
- Setiap task merujuk ke requirement spesifik untuk keterlacakan
- Property test menggunakan library **fast-check** (via CDN pada test runner browser atau npm)
- Minimum **100 iterasi per property test** sesuai desain
- Setiap property test harus diberi komentar: `// Feature: todo-list-life-dashboard, Property {N}: {deskripsi singkat}`
- Unit test fokus pada skenario konkret dan kondisi batas (contoh: `getGreeting(5)` → "Selamat Pagi")
- Checkpoint memastikan validasi inkremental sebelum lanjut ke modul berikutnya

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "8.1"] },
    { "id": 5, "tasks": ["6.3", "8.2"] },
    { "id": 6, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "8.3"] },
    { "id": 7, "tasks": ["8.4", "8.5", "8.6"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["10.1"] }
  ]
}
```
