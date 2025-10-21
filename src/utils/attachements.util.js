const moment = require("moment");

// 🔹 Fecha Excel → YYYY-MM-DD
function excelDateToJSDate(serial) {
    if (!serial || isNaN(serial)) return null;
 
    const utc_days = Math.floor(serial - 25569 + 1); // +1 para corregir desfase Excel
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
 
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractional_day);
    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
 
    let newdate = new Date(
        date_info.getFullYear(),
        date_info.getMonth(),
        date_info.getDate(),
        hours,
        minutes,
        seconds
    );
    return moment(newdate).format("YYYY-MM-DD");
}

module.exports = {
    excelDateToJSDate
};