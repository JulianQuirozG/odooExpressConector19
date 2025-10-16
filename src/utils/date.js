const util_date = {
    esBisiesto(anio) {
        return (anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0);
    }
}

module.exports = util_date;