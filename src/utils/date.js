const excelDateToJSDate = require('./attachements.util');

const util_date = {
    esBisiesto(anio) {
        return (anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0);
    },

    canBeParsedAsDate(value) {
        if (value == null || value === '' || value === 0) return false;

        // Si es un número, probablemente venga del formato Excel
        const parsedValue = typeof value === 'number' ? excelDateToJSDate.excelDateToJSDate(value) : value;

        const d = new Date(parsedValue);
        return d instanceof Date && !isNaN(d.getTime());
    },

    getDiffDates(start_date, end_date) {
        const diffTime = Math.abs(end_date - start_date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    }
}

module.exports = util_date;