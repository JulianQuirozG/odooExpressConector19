const excelDateToJSDate = require('./attachements.util');

/**
 * Utilidades para manejo de fechas en el sistema de nómina electrónica.
 * 
 * Proporciona funciones especializadas para validación, conversión y cálculos de fechas,
 * especialmente diseñadas para el procesamiento de archivos Excel y operaciones
 * de nómina que requieren manejo preciso de fechas y períodos laborales.
 * 
 * @namespace util_date
 * @version 1.2.0
 * @author Sistema de Nómina Electrónica
 * @since 1.0.0
 */
const util_date = {
    /**
     * Determina si un año específico es bisiesto según el calendario gregoriano.
     * 
     * @param {number} anio - El año a verificar (formato de 4 dígitos, ej: 2024)
     * 
     * @returns {boolean} true si el año es bisiesto, false en caso contrario
     * 
     */
    esBisiesto(anio) {
        return (anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0);
    },

    /**
     * Valida si un valor puede ser parseado como una fecha válida.
     * 
     * @param {*} value - Valor a validar (puede ser string, number, Date, null, undefined)
     * 
     * @returns {boolean} true si el valor puede ser parseado como fecha válida, false en caso contrario
     * 
     */
    canBeParsedAsDate(value) {
        try {
            if (value == null || value === '' || value === 0) return false;

            // Si es un número, probablemente venga del formato Excel
            const parsedValue = typeof value === 'number' ? excelDateToJSDate.excelDateToJSDate(value) : value;

            const d = new Date(parsedValue);
            const isValidDate = d instanceof Date && !isNaN(d.getTime());
            return isValidDate;
        } catch (error) {
            console.error('Error en canBeParsedAsDate:', error);
            return false;
        }
    },

    /**
     * Calcula la diferencia en días entre dos fechas, incluyendo ambos días extremos.
     * 
     * @param {Date} start_date - Fecha de inicio del período
     * @param {Date} end_date - Fecha de fin del período
     * 
     * @returns {number} Número de días entre las fechas (incluyendo ambos extremos)
     * 
     */
    getDiffDates(start_date, end_date) {
        try {
            if (!this.canBeParsedAsDate(start_date) || !this.canBeParsedAsDate(end_date)) return 0;
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            
            const diffTime = Math.abs(end_date - start_date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays;
        } catch (error) {
            console.error('Error en getDiffDates:', error);
            return 0;
        }
    }
}

module.exports = util_date;