// ===== CONFIGURACIÓN DE CREDENCIALES Y CONSTANTES =====
// IMPORTANTE: Este archivo contiene credenciales sensibles.
// No lo subas a repositorios públicos (GitHub, etc.).
// Si usás Git, agregalo a .gitignore.

const CONFIG = {
  // Google Sheets API v4 - Solo lectura
  GOOGLE_API_KEY: 'AIzaSyCaecrBrqHicmaOFOh4suyVe62m4Ffs9Mw',

  // Google Sheet fijo con datos de CUP / DDD / SIT
  DATA_SHEET_ID: '1unZH-Dihf89gHQaZPrrC4CiddBwIcqhKhoue__2eT1Y',
  DATA_RANGES: {
    cup: 'CUP!A1:J1000',
    ddd: 'DDD!A1:G1000',
    sit: 'SIT!A1:H1000'
  },

  // Usuarios y sus Sheets
  USUARIOS: {
    carlos: {
      nombre: 'Carlos',
      sheetId: '1yDvv9Tg-fxJ4tDB8_8mbc6dL6hzDlJysSWXlZOQ4Cxg',
      metaMedicos: 9,
      metaFarmacias: 2
    },
    esposa: {
      nombre: 'Esposa',
      sheetId: '', // Configurar después
      metaMedicos: 13,
      metaFarmacias: 3
    }
  },

  // Ranges de las hojas
  RANGES: {
    medicos: 'Medicos!A1:O1000',
    farmacias: 'Farmacias!A1:G1000'
  }
};
