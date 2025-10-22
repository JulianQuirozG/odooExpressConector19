const XLSX = require('xlsx');
const { payrollStruct } = require('../structs/payroll/payrrol.struct');
const path = require('path');
const { validateBody } = require('./validateBody.middleware');
const { payrollExcelSchema } = require('../schemas/payroll/excelPayrollSchema');

const reportPayrollsByExcel = async (req, res, next) => {
   try {
      const errors = [];
      if (!req.file) return res.status(400).json({ statusCode: 400, error: 'No se ha subido ningún archivo' });

      if (path.extname(req.file.originalname).toLowerCase() !== '.xlsx') return res.status(400).json({ statusCode: 400, error: 'El archivo debe ser de tipo .xlsx' });

      // Ahora necesito obtener la hoja Nomina
      const bookExcel = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      if (!bookExcel.SheetNames.includes('Nomina')) return res.status(400).json({ statusCode: 400, error: 'El archivo Excel no contiene la hoja Nomina' });
      const idSheet = bookExcel.SheetNames.indexOf('Nomina')
      const sheetName = bookExcel.SheetNames[idSheet];
      
      if (!sheetName) return res.status(400).json({ statusCode: 400, message: `Hoja Nomina no encontrada`, data: [] });

      const ws = bookExcel.Sheets[sheetName];

      //defino el rango de la A a la CF
      const ref = XLSX.utils.decode_range(ws['!ref']);
      const start = { r: 7, c: 0 };   
      const end = { r: ref.e.r, c: 83 };     
      const rangeStr = XLSX.utils.encode_range(start, end);

      //obtengo las claves del objeto de la estructura de la nomina para usarlas como nombre de las columnas
      const KEYS = Object.keys(payrollStruct);

      const rows = XLSX.utils.sheet_to_json(ws, {
         header: KEYS,
         range: rangeStr,
         raw: true,
         blankrows: false, // ya omite filas 100% vacías
         defval: null,      // rellena celdas vacías con 0
      });


      const startPeriod = { r: 1, c: 13 };   //r:(row inicial del archivo),c (A = col 0 del archivo)
      const endPeriod = { r: 4, c: 13 };     // r = ultima row activa, AU = (col 46 (0-based) del archivo)
      const rangeStrPeriod = XLSX.utils.encode_range(startPeriod, endPeriod);

      //obtengo los datos del periodo que se encuentran en el encabezado (1, 13) - (4, 13)
      const periodData = XLSX.utils.sheet_to_json(ws, {
         header: ["Fecha_generacion", "periodo_Inicio", "periodo_Fin", "tipo_periodo_Nomina"],
         range: rangeStrPeriod,
         defval: 0,      // rellena celdas vacías con 0
         blankrows: true
      });

      periodData.map(item => Object.values(item)[0] ? null : errors.push({ value_error: `Faltan datos en el campo ${Object.keys(item)[0]} encabezado del periodo de la nomina` }));
      
   
      rows.map((row, index) => {
         // Validaciones básicas por fila
         if (row.numero == "TOTALES") return; // Omitir fila de totales
         payrollExcelSchema.safeParse(row).success ? null : errors.push({ row: row.numero, value_error: `Errores de validación en la fila ${index+1}`, data: (payrollExcelSchema.safeParse(row).error.issues.map(issue => (issue.path))).join(', ') });
      });

      if(errors.length > 0){
         return res.status(400).json({ statusCode: 400, error: 'Errores en el archivo Excel', data: errors });
      }

      next();
   } catch (error) {
      console.error('Error processing Excel file:', error);
      res.status(500).json({ error: 'Error processing Excel file' });
   }
};

module.exports = { reportPayrollsByExcel };