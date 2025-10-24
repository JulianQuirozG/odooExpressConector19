const XLSX = require('xlsx');

const excel_util = {

    /**
     * Extrae datos de una hoja específica de un archivo Excel en un rango definido.
     * 
     * Esta función utilitaria proporciona una interfaz flexible y robusta para extraer 
     * datos estructurados de archivos Excel (.xlsx, .xls) utilizando la librería XLSX.
     * Permite especificar rangos personalizados, headers dinámicos y maneja múltiples
     * formatos de datos con validaciones exhaustivas.
     * 
     * @param {*} file 
     * @param {*} sheetName 
     * @param {*} startRow 
     * @param {*} endRow 
     * @param {*} startCol 
     * @param {*} endCol 
     * @param {*} headers 
     * @returns 
     */
    get_excel_data(file, sheetName, startRow = 0, endRow = null, startCol = 0, endCol = null, headers) {
        try {
            // Verifica si el archivo está presente
            if (!file) return { success: false, error: false, message: 'Archivo Excel es requerido', data: [] };

            //Verificar si el archivo es un buffer
            if (!Buffer.isBuffer(file.buffer)) return { success: false, error: false, message: 'El archivo proporcionado no es un buffer válido', data: [] };

            // Lee el archivo Excel desde el buffer
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });

            //obtengo la hoja Nomina
            const idSheet = workbook.SheetNames.map(name => name.toLowerCase().trim()).indexOf(sheetName.toLowerCase().trim());

            // Verifica si la hoja existe
            if (idSheet === -1) return { success: false, error: false, message: `La hoja "${sheetName}" no existe en el archivo Excel`, data: [] };

            // Obtiene la hoja por su nombre
            const worksheet = workbook.Sheets[workbook.SheetNames[idSheet]];

            //Preparo el rango a leer
            const ref = XLSX.utils.decode_range(worksheet['!ref']);
            const start = { r: startRow, c: startCol };
            const end = { r: endRow !== null ? endRow : ref.e.r, c: endCol !== null ? endCol : ref.e.c };
            const rangeStr = XLSX.utils.encode_range(start, end);

            //obtengo las claves del objeto de la estructura proporcionada
            const KEYS = headers ? Object.keys(headers) : ((endCol || 0) - startCol + 1);

            // Convierte la hoja a JSON usando el rango especificado
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: KEYS || 1,
                range: rangeStr,
                raw: true,
                blankrows: false,
                defval: null,
            });

            // Retorna los datos extraídos
            return { success: true, error: false, message: 'Datos extraídos con éxito', data: rows };
        } catch (error) {
            console.error('Error al leer el archivo Excel:', error);
            return { success: false, error: true, message: 'Error al leer el archivo Excel: ' + error.message, data: [] };
        }
    }
}

module.exports = excel_util;